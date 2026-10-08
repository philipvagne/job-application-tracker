import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_BOOKMARK_VERSION, readAddHash } from './addPayload'
import { buildBookmarklet, isLocalAddress } from './bookmarkletSource'

const APP = 'https://tracker.example.workers.dev/'
const PAGE = 'https://careers.example.com/jobs/42?ref=a&b=c#apply'
const LABELS = { open: 'Open in Job tracker', close: 'Close' }
const API = 'https://jobsearch.api.jobtechdev.se/ad/'
/** The most the bookmark address may be, in characters. It was 3500 before the Platsbanken adapter and the fallback box (about 6000 now); browsers accept far more. */
const LENGTH_LIMIT = 6200

interface FakeResponse {
  status: number
  text: () => Promise<string>
}

interface FetchInit {
  signal?: AbortSignal
  [key: string]: unknown
}

type FakeFetch = (url: string, init: FetchInit) => Promise<FakeResponse>

interface Page {
  href?: string
  title?: string
  ogTitle?: string
  /** The text of each ld+json script. */
  blocks?: string[]
  /** The page's fetch. Left out, the page has none. */
  fetch?: FakeFetch
  /** navigator.userActivation. Left out, the browser has none. */
  userActivation?: { isActive: boolean }
}

interface Opened {
  url: string
  target: unknown
  features: unknown
}

interface FakeElement {
  tag: string
  id: string
  href: string
  target: string
  rel: string
  textContent: string
  type: string
  style: Record<string, string>
  parentNode: FakeElement | null
  children: FakeElement[]
  onclick: (() => void) | null
  appendChild: (child: FakeElement) => void
  removeChild: (child: FakeElement) => void
  focus: () => void
}

function fakeElement(tag: string): FakeElement {
  const el: FakeElement = {
    tag,
    id: '',
    href: '',
    target: '',
    rel: '',
    textContent: '',
    type: '',
    style: {},
    parentNode: null,
    children: [],
    onclick: null,
    appendChild: (child) => {
      child.parentNode = el
      el.children.push(child)
    },
    removeChild: (child) => {
      el.children = el.children.filter((c) => c !== child)
      child.parentNode = null
    },
    focus: () => {},
  }
  return el
}

/** Starts the bookmarklet on a fake page. Whatever it opens or shows is collected; async work is up to the test. */
function start(page: Page, appUrl = APP) {
  const link = buildBookmarklet(appUrl, LABELS)
  if (link === null) throw new Error('no bookmarklet')
  expect(link.startsWith('javascript:void')).toBe(true)
  // Browsers decode a javascript: address before running it.
  const code = decodeURIComponent(link.slice('javascript:'.length))
  const href = page.href ?? PAGE
  const url = new URL(href)
  const opened: Opened[] = []
  const fetchCalls: { url: string; init: FetchInit }[] = []
  const body = fakeElement('body')
  const fakeLocation = { href, origin: url.origin, pathname: url.pathname, hostname: url.hostname }
  const fakeDocument = {
    title: page.title ?? '',
    body,
    querySelectorAll: () => (page.blocks ?? []).map((textContent) => ({ textContent })),
    querySelector: () =>
      page.ogTitle === undefined ? null : { getAttribute: (name: string) => (name === 'content' ? page.ogTitle : null) },
    getElementById: (id: string) => body.children.find((c) => c.id === id) ?? null,
    createElement: (tag: string) => fakeElement(tag),
  }
  const fakeWindow = {
    open: (target: string, name: unknown, features: unknown) => {
      opened.push({ url: target, target: name, features })
      return null
    },
  }
  const fakeNavigator = page.userActivation === undefined ? {} : { userActivation: page.userActivation }
  const pageFetch = page.fetch
  const fakeFetch =
    pageFetch === undefined
      ? undefined
      : (requestUrl: string, init: FetchInit) => {
          fetchCalls.push({ url: requestUrl, init })
          return pageFetch(requestUrl, init)
        }
  const result: unknown = new Function('location', 'document', 'window', 'navigator', 'fetch', `return ${code}`)(
    fakeLocation,
    fakeDocument,
    fakeWindow,
    fakeNavigator,
    fakeFetch,
  )
  expect(result).toBeUndefined()
  return { opened, fetchCalls, body }
}

/** Runs the bookmarklet against a fake page and returns what it opened. */
function run(page: Page, appUrl = APP): Opened[] {
  return start(page, appUrl).opened
}

function job(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Frontendutvecklare', hiringOrganization: { '@type': 'Organization', name: 'Acme AB' }, ...extra }
}

function only<T>(items: T[]): T {
  const [item] = items
  if (item === undefined || items.length !== 1) throw new Error(`expected exactly one call, got ${items.length}`)
  return item
}

/** Everything the tracker would read from the address the bookmarklet opened. */
function fullPrefillOf(opened: { url: string }[]) {
  const { url } = only(opened)
  expect(url.startsWith(`${APP}#`)).toBe(true)
  const result = readAddHash(url.slice(APP.length))
  if (result.kind !== 'prefill') throw new Error(`not accepted: ${result.kind}`)
  return result.prefill
}

/** The link, company and role only. */
function prefillOf(opened: { url: string }[]) {
  const { link, company, role } = fullPrefillOf(opened)
  return { link, company, role }
}

describe('buildBookmarklet', () => {
  it('is a javascript: address that parses', () => {
    const link = buildBookmarklet(APP, LABELS)
    expect(link).not.toBeNull()
    expect(() => new Function(decodeURIComponent((link ?? '').slice('javascript:'.length)))).not.toThrow()
  })

  it('stays small, on one line, and has no raw spaces or quotes', () => {
    const link = buildBookmarklet(APP, LABELS) ?? ''
    expect(link.length).toBeLessThan(LENGTH_LIMIT)
    expect(link).not.toMatch(/[\s"<>#]/)
  })

  it('contains no link text except the tracker, the API and the Platsbanken ad address', () => {
    const code = decodeURIComponent((buildBookmarklet(APP, LABELS) ?? '').slice('javascript:'.length))
    expect(code).toContain(JSON.stringify(APP))
    expect(code).toContain(`'${API}'`)
    const rest = code
      .replace(JSON.stringify(APP), '')
      .replace(`'${API}'`, '')
      .replace("'https://arbetsformedlingen.se/platsbanken/annonser/'", '')
    expect(rest).not.toMatch(/https?:\/\/[a-z0-9]/i)
  })

  it('makes exactly one kind of request, with no other way out of the page', () => {
    const code = decodeURIComponent((buildBookmarklet(APP, LABELS) ?? '').slice('javascript:'.length))
    expect(code.match(/\bfetch\s*\(/g)).toHaveLength(1)
    expect(code).not.toMatch(/\b(XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|eval|innerHTML|outerHTML|document\.write|localStorage|sessionStorage|indexedDB|cookie)\b/)
  })

  it('asks the API without cookies or referrer, and sends the bookmark version', () => {
    const code = decodeURIComponent((buildBookmarklet(APP, LABELS) ?? '').slice('javascript:'.length))
    expect(code).toContain("credentials: 'omit'")
    expect(code).toContain("referrerPolicy: 'no-referrer'")
    expect(code).toContain(`var BV = ${CURRENT_BOOKMARK_VERSION};`)
  })

  it('refuses an address that is not http(s)', () => {
    expect(buildBookmarklet('file:///C:/tracker/index.html', LABELS)).toBeNull()
    expect(buildBookmarklet('javascript:alert(1)', LABELS)).toBeNull()
    expect(buildBookmarklet('', LABELS)).toBeNull()
  })

  it('opens a new tab without opener or referrer', () => {
    const call = only(run({ blocks: [JSON.stringify(job())] }))
    expect(call.target).toBe('_blank')
    expect(call.features).toBe('noopener,noreferrer')
  })

  it('puts the box words in as plain text, whatever characters they hold', () => {
    const odd = { open: 'Öppna \'x\' "y" `z` ${1} \\', close: '$&' }
    const link = buildBookmarklet(APP, odd) ?? ''
    const code = decodeURIComponent(link.slice('javascript:'.length))
    expect(code).toContain(JSON.stringify(odd.open))
    expect(code).toContain(JSON.stringify(odd.close))
    expect(() => new Function(code)).not.toThrow()
  })
})

describe('what the bookmarklet reads', () => {
  const LINK_ONLY = { link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: '', role: '' }

  it('takes the company from a JobPosting block and the link without its fragment, and leaves the role empty', () => {
    const prefill = prefillOf(run({ blocks: [JSON.stringify(job())], title: 'Jobb - Acme' }))
    expect(prefill).toEqual({ link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: 'Acme AB', role: '' })
  })

  it('never reads a job title, page title or og:title as a role, and sends no page title', () => {
    const opened = run({
      blocks: [JSON.stringify(job({ title: 'Bli en del av vårt fantastiska team!' }))],
      title: 'Slogan från sidtiteln',
      ogTitle: 'Slogan från og:title',
    })
    const { url } = only(opened)
    expect(url).not.toMatch(/fantastiska|Slogan|sidtiteln|og%3Atitle/i)
    expect(prefillOf(opened).role).toBe('')
    const names = Array.from(new URLSearchParams(url.slice(url.indexOf('#') + 1)).keys())
    expect(names.sort()).toEqual(['add', 'bv', 'jo', 'u', 'v'])
  })

  it('sends only the link, the version and the company, with the bookmark version', () => {
    const { url } = only(run({ blocks: [JSON.stringify(job())] }))
    expect(url.startsWith(`${APP}#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION}&u=`)).toBe(true)
    expect(fullPrefillOf([{ url }])).toMatchObject({ bookmarkVersion: CURRENT_BOOKMARK_VERSION, outdatedBookmark: false })
  })

  it('finds a JobPosting inside @graph', () => {
    const block = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'Site' }, job()] })
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ company: 'Acme AB', role: '' })
  })

  it('finds a JobPosting in a top-level array', () => {
    const block = JSON.stringify([{ '@type': 'BreadcrumbList' }, job()])
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ company: 'Acme AB' })
  })

  it('accepts @type as an array or a full schema.org address', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ '@type': ['Thing', 'JobPosting'] }))] }))).toMatchObject({ company: 'Acme AB' })
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ '@type': 'https://schema.org/JobPosting' }))] }))).toMatchObject({ company: 'Acme AB' })
  })

  it('reads the company when hiringOrganization is a plain string or a list', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: 'Plain AB' }))] })).company).toBe('Plain AB')
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: [{ name: 'First AB' }, { name: 'Second AB' }] }))] })).company).toBe('First AB')
  })

  it('leaves a missing company empty without guessing from the page title', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify({ '@type': 'JobPosting' })], title: 'Developer - Acme | Site' }))).toEqual(LINK_ONLY)
  })

  it('opens with the link alone when the page has no JSON-LD', () => {
    expect(prefillOf(run({}))).toEqual(LINK_ONLY)
    expect(prefillOf(run({ title: 'Developer - Acme | Site', ogTitle: 'Acme' }))).toEqual(LINK_ONLY)
  })

  it('picks the one JobPosting among several blocks', () => {
    const blocks = [JSON.stringify({ '@type': 'Organization', name: 'Wrong AB' }), JSON.stringify({ '@type': 'WebSite' }), JSON.stringify(job())]
    expect(prefillOf(run({ blocks }))).toMatchObject({ company: 'Acme AB' })
  })

  it('skips a block with broken JSON and still reads the next one', () => {
    expect(prefillOf(run({ blocks: ['{ not json', '', JSON.stringify(job())] }))).toMatchObject({ company: 'Acme AB' })
    expect(prefillOf(run({ blocks: ['{ not json'] })).company).toBe('')
  })

  it('does not read a JobPosting buried deeper than a few levels', () => {
    let nested: unknown = job()
    for (let i = 0; i < 8; i++) nested = { '@graph': [nested] }
    expect(prefillOf(run({ blocks: [JSON.stringify(nested)] })).company).toBe('')
  })

  it('skips a huge block', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ description: 'x'.repeat(600_000) }))] })).company).toBe('')
  })

  it('hands html entities and tags in the company to the tracker, which cleans them', () => {
    const block = JSON.stringify(job({ hiringOrganization: { name: '<b>Acme</b> R&amp;D AB' } }))
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ company: 'Acme R&D AB', role: '' })
  })

  it('makes no request on a company page, and the same rule holds with or without a page fetch', async () => {
    const withFetch = start({ blocks: [JSON.stringify(job())], fetch: () => Promise.reject(new Error('must not be called')) })
    expect(withFetch.fetchCalls).toEqual([])
    expect(prefillOf(withFetch.opened)).toEqual({ ...LINK_ONLY, company: 'Acme AB' })
  })
})

describe('limits', () => {
  it('cuts a very long company so the address stays readable by the tracker', () => {
    const long = 'Å'.repeat(5000)
    const opened = run({ blocks: [JSON.stringify(job({ hiringOrganization: { name: long } }))] })
    const hash = only(opened).url.slice(APP.length)
    expect(hash.length).toBeLessThanOrEqual(7500 + 40)
    expect(Array.from(prefillOf(opened).company)).toHaveLength(200)
  })

  it('never splits a character when it cuts', () => {
    const long = '😀'.repeat(400)
    expect(Array.from(prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: { name: long } }))] })).company).every((c) => c === '😀')).toBe(true)
  })

  it('leaves out a field that cannot be encoded and keeps the link', () => {
    const prefill = prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: { name: 'ab\ud800cd' } }))] }))
    expect(prefill).toEqual({ ...{ link: 'https://careers.example.com/jobs/42?ref=a&b=c', role: '' }, company: '' })
  })

  it('drops the company rather than the link when the address would get too long', () => {
    // Every "{" takes three characters when encoded, so this link alone is about 6000 characters.
    const link = `https://careers.example.com/${'{'.repeat(2000)}`
    const long = 'Å'.repeat(300)
    const opened = run({ href: link, blocks: [JSON.stringify(job({ hiringOrganization: { name: long } }))] })
    const { url } = only(opened)
    expect(url).not.toContain('&jo=')
    expect(url.length - APP.length).toBeLessThan(8192)
    expect(new URLSearchParams(url.slice(url.indexOf('#') + 1)).get('u')).toBe(link)
  })

  it('cuts a very long link to origin and path, and gives up if that is too long as well', () => {
    const query = `?q=${'a'.repeat(3000)}`
    expect(prefillOf(run({ href: `https://careers.example.com/jobs/42${query}` })).link).toBe('https://careers.example.com/jobs/42')
    expect(run({ href: `https://careers.example.com/${'a'.repeat(3000)}` })).toEqual([])
  })
})

describe('pages that are not http(s)', () => {
  it.each(['about:blank', 'file:///C:/jobs/ad.html', 'data:text/html,hello', 'view-source:https://example.com/', 'chrome://settings/'])(
    'opens nothing on %s',
    (href) => {
      const link = buildBookmarklet(APP, LABELS) ?? ''
      const code = decodeURIComponent(link.slice('javascript:'.length))
      const opened: unknown[] = []
      // A fake that cannot give an origin, as these addresses do not have a usable one.
      new Function('location', 'document', 'window', code)(
        { href, origin: 'null', pathname: '' },
        { title: '', querySelectorAll: () => [], querySelector: () => null },
        { open: (...args: unknown[]) => opened.push(args) },
      )
      expect(opened).toEqual([])
    },
  )
})

describe('isLocalAddress', () => {
  it('recognises addresses on this computer', () => {
    for (const url of ['http://localhost:5173/', 'http://127.0.0.1:4173/', 'http://[::1]:5173/', 'https://app.localhost/']) {
      expect(isLocalAddress(url)).toBe(true)
    }
  })

  it('does not flag real addresses or nonsense', () => {
    for (const url of ['https://tracker.example.workers.dev/', 'https://localhost.example.com/', 'not a url', '']) {
      expect(isLocalAddress(url)).toBe(false)
    }
  })
})

describe('the fallback box when the browser has no click to spend', () => {
  it('opens the tab directly when the browser reports no user activation support', () => {
    const { opened, body } = start({ blocks: [JSON.stringify(job())] })
    expect(opened).toHaveLength(1)
    expect(body.children).toHaveLength(0)
  })

  it('opens the tab directly while the click is still active', () => {
    const { opened, body } = start({ blocks: [JSON.stringify(job())], userActivation: { isActive: true } })
    expect(opened).toHaveLength(1)
    expect(body.children).toHaveLength(0)
  })

  it('shows a box with a plain link instead when the click is no longer active', () => {
    const { opened, body } = start({ blocks: [JSON.stringify(job())], userActivation: { isActive: false } })
    expect(opened).toEqual([])
    const box = only(body.children)
    const [link, close] = box.children
    expect(link?.tag).toBe('a')
    expect(link?.href.startsWith(`${APP}#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION}&u=`)).toBe(true)
    expect(link?.target).toBe('_blank')
    expect(link?.rel).toBe('noopener noreferrer')
    expect(link?.textContent).toBe(LABELS.open)
    expect(close?.tag).toBe('button')
    expect(close?.type).toBe('button')
    expect(close?.textContent).toBe(LABELS.close)
    // The address in the box is one the tracker accepts.
    expect(readAddHash((link?.href ?? '').slice(APP.length))).toMatchObject({ kind: 'prefill', prefill: { company: 'Acme AB' } })
    close?.onclick?.()
    expect(body.children).toHaveLength(0)
  })
})

const PB_ID = '31572415'
const PB = `https://arbetsformedlingen.se/platsbanken/annonser/${PB_ID}`

function ad(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PB_ID,
    headline: 'Vill du bli vår nya kollega? Vi söker boendestödjare till Basvägen LSS',
    employer: { name: 'Humana AB' },
    occupation: { label: 'Vårdare/Arbetshandledare/Boendestödjare' },
    application_deadline: '2026-11-08T23:59:59',
    removed: false,
    removed_date: null,
    ...extra,
  }
}

function reply(body: string, status = 200): FakeFetch {
  return () => Promise.resolve({ status, text: () => Promise.resolve(body) })
}

function replyAd(extra: Record<string, unknown> = {}): FakeFetch {
  return reply(JSON.stringify(ad(extra)))
}

/** A request that never answers; it only ends when the bookmarklet aborts it. */
const never: FakeFetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
  })

/** Lets the bookmarklet's promises run. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

/** Runs it on a Platsbanken ad page with the given answer, and returns what the tracker would read. */
async function onPlatsbanken(fetchFn: FakeFetch | undefined, href = PB) {
  const started = start({ href, title: 'Annons - Platsbanken', fetch: fetchFn })
  await settle()
  return started
}

/** What the tracker reads when only the (canonical) link could be sent. */
function expectLinkOnly(opened: Opened[]): void {
  expect(fullPrefillOf(opened)).toEqual({ link: PB, company: '', role: '', bookmarkVersion: CURRENT_BOOKMARK_VERSION, outdatedBookmark: false })
}

describe('Platsbanken: the ad address', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    PB,
    `${PB}/`,
    `${PB}?utm_source=x&q=vård`,
    `${PB}/?q=1`,
    `${PB}#kontakt`,
    `https://www.arbetsformedlingen.se/platsbanken/annonser/${PB_ID}`,
    `https://ARBETSFORMEDLINGEN.SE/platsbanken/annonser/${PB_ID}`,
  ])('asks for the ad and saves the clean address, from %s', async (href) => {
    const { opened, fetchCalls } = await onPlatsbanken(replyAd(), href)
    expect(only(fetchCalls).url).toBe(`${API}${PB_ID}`)
    expect(fullPrefillOf(opened)).toMatchObject({ link: PB, company: 'Humana AB' })
  })

  it.each([
    'https://arbetsformedlingen.se/platsbanken/annonser/abc',
    'https://arbetsformedlingen.se/platsbanken/annonser/',
    'https://arbetsformedlingen.se/platsbanken/annonser',
    'https://arbetsformedlingen.se/platsbanken/annonser?p=1',
    'https://arbetsformedlingen.se/platsbanken/annonser/12a',
    'https://arbetsformedlingen.se/platsbanken/annonser/-1',
    'https://arbetsformedlingen.se/platsbanken/annonser/1234567890123',
    'https://arbetsformedlingen.se/platsbanken/annonser/31572415/extra',
    'https://arbetsformedlingen.se/platsbanken/annonser/31572415%2F..%2F',
    'https://arbetsformedlingen.se/platsbanken/',
    'https://arbetsformedlingen.se/',
    'https://arbetsformedlingen.se/other/platsbanken/annonser/31572415',
    'https://arbetsformedlingen.se.example.com/platsbanken/annonser/31572415',
    'https://example.com/platsbanken/annonser/31572415',
    'https://notarbetsformedlingen.se/platsbanken/annonser/31572415',
    'http://arbetsformedlingen.se/platsbanken/annonser/31572415',
  ])('makes no request on %s', async (href) => {
    const { opened, fetchCalls } = await onPlatsbanken(replyAd(), href)
    expect(fetchCalls).toEqual([])
    expect(fullPrefillOf(opened)).toMatchObject({ company: '', role: '' })
  })

  it('keeps the page address as the link when it is not an ad address', async () => {
    const href = 'https://arbetsformedlingen.se/platsbanken/annonser?p=1&k=x'
    const { opened } = await onPlatsbanken(replyAd(), href)
    expect(fullPrefillOf(opened).link).toBe(href)
  })

  it('makes no request on an ordinary job page, even when the page has a fetch', async () => {
    const { opened, fetchCalls } = await onPlatsbanken(replyAd(), PAGE)
    expect(fetchCalls).toEqual([])
    expect(fullPrefillOf(opened)).toMatchObject({ link: 'https://careers.example.com/jobs/42?ref=a&b=c' })
  })

  it('reads the company from the page’s own data and makes no request', async () => {
    const started = start({ blocks: [JSON.stringify(job())], fetch: replyAd() })
    await settle()
    expect(started.fetchCalls).toEqual([])
    expect(prefillOf(started.opened)).toEqual({ link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: 'Acme AB', role: '' })
  })
})

describe('Platsbanken: the answer from the API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fills the company and, as the role, the occupation from a good answer', async () => {
    const { opened, fetchCalls } = await onPlatsbanken(replyAd())
    expect(fullPrefillOf(opened)).toEqual({
      link: PB,
      company: 'Humana AB',
      role: 'Vårdare/Arbetshandledare/Boendestödjare',
      bookmarkVersion: CURRENT_BOOKMARK_VERSION,
      outdatedBookmark: false,
    })
    const call = only(opened)
    expect(call.target).toBe('_blank')
    expect(call.features).toBe('noopener,noreferrer')
    expect(only(fetchCalls).init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } })
  })

  it('never sends the ad headline or the deadline, and uses no other fields than jt, jo and dt', async () => {
    const { opened } = await onPlatsbanken(replyAd({ headline: 'Unik rubrik XYZ', application_deadline: '2031-05-06T23:59:59' }))
    const { url } = only(opened)
    expect(url).not.toMatch(/XYZ|Unik|2031|05-06/)
    const names = Array.from(new URLSearchParams(url.slice(url.indexOf('#') + 1)).keys())
    expect(names.every((name) => ['add', 'v', 'bv', 'u', 'jt', 'jo', 'dt'].includes(name))).toBe(true)
  })

  it('opens as soon as the answer is in, not after the time limit', async () => {
    const started = start({ href: PB, fetch: replyAd() })
    expect(started.opened).toEqual([])
    await settle()
    expect(started.opened).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(started.opened).toHaveLength(1)
  })

  it('treats a removed ad like any other: company and role are still filled in', async () => {
    const { opened } = await onPlatsbanken(replyAd({ removed: true, removed_date: '2026-09-01T00:00:00' }))
    expect(fullPrefillOf(opened)).toMatchObject({ company: 'Humana AB', role: 'Vårdare/Arbetshandledare/Boendestödjare' })
  })

  it('leaves the role empty when the occupation is missing, and never falls back to the headline or the page title', async () => {
    const headline = { headline: 'Unik rubrik XYZ' }
    for (const occupation of [undefined, null, {}, { label: '' }, { label: '   ' }, { label: 5 }, { label: { text: 'x' } }, 'Vårdare', ['Vårdare']]) {
      const { opened } = await onPlatsbanken(replyAd({ ...headline, occupation }))
      expect(fullPrefillOf(opened)).toMatchObject({ link: PB, company: 'Humana AB', role: '' })
      expect(only(opened).url).not.toMatch(/XYZ|Unik/)
    }
  })

  it('works with a missing company: the role is still the occupation', async () => {
    for (const employer of [undefined, null, {}, { name: '' }, { name: 5 }, 'Humana AB']) {
      const { opened } = await onPlatsbanken(replyAd({ employer }))
      expect(fullPrefillOf(opened)).toMatchObject({ company: '', role: 'Vårdare/Arbetshandledare/Boendestödjare' })
    }
  })

  it('sends the link alone when there is neither company nor occupation', async () => {
    const { opened } = await onPlatsbanken(replyAd({ employer: undefined, occupation: undefined }))
    expectLinkOnly(opened)
  })

  it('ignores fields of the wrong type', async () => {
    const { opened } = await onPlatsbanken(replyAd({ employer: { name: 5 }, occupation: { label: { text: 'x' } }, headline: { text: 'x' } }))
    expectLinkOnly(opened)
  })

  it('only reads the documented fields', async () => {
    const { opened } = await onPlatsbanken(
      replyAd({ description: { text: 'SECRET DESCRIPTION' }, webpage_url: 'https://evil.example/', application_details: { email: 'a@b.se' }, workplace_address: { city: 'Umeå' } }),
    )
    const { url } = only(opened)
    expect(url).not.toMatch(/SECRET|evil|a%40b|Ume/)
  })

  it('hands hostile text on as text, which the tracker turns into plain text', async () => {
    const { opened } = await onPlatsbanken(
      replyAd({ employer: { name: '<script>alert(1)</script>Evil&amp;Co' }, occupation: { label: '<img src=x onerror=alert(1)>Vård‮' }, headline: '<b>HEAD</b>' }),
    )
    const prefill = fullPrefillOf(opened)
    expect(prefill.role).toBe('Vård')
    expect(prefill.company).not.toMatch(/[<>]/)
    expect(prefill.company).toContain('Evil&Co')
    expect(only(opened).url).not.toMatch(/HEAD/)
  })

  it('cuts huge fields so the address stays readable by the tracker', async () => {
    const { opened } = await onPlatsbanken(replyAd({ headline: 'h'.repeat(100_000), employer: { name: 'n'.repeat(100_000) }, occupation: { label: 'o'.repeat(100_000) } }))
    expect(only(opened).url.length).toBeLessThan(8192)
    const prefill = fullPrefillOf(opened)
    expect(prefill.role).toHaveLength(200)
    expect(prefill.company).toHaveLength(200)
  })

  it('does not read an answer that is far too big', async () => {
    const { opened } = await onPlatsbanken(reply(JSON.stringify(ad({ description: 'x'.repeat(1_100_000) }))))
    expectLinkOnly(opened)
  })

  it('does not use the page’s own job data on an ad page, so the role can only be the occupation', async () => {
    const withJobData = [JSON.stringify(job({ title: 'Rubrik från sidan' }))]
    const missing = start({ href: PB, blocks: withJobData, fetch: replyAd({ occupation: undefined }) })
    await settle()
    expect(fullPrefillOf(missing.opened)).toMatchObject({ company: 'Humana AB', role: '' })
    const failed = start({ href: PB, blocks: withJobData, fetch: reply('', 500) })
    await settle()
    expectLinkOnly(failed.opened)
    expect(only(failed.opened).url).not.toMatch(/Acme|Rubrik/)
  })
})

describe('Platsbanken: when the API does not help', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([404, 410, 429, 500, 503, 204, 301])('sends the link alone after HTTP %i', async (status) => {
    const { opened } = await onPlatsbanken(reply(JSON.stringify(ad()), status))
    expectLinkOnly(opened)
  })

  it.each(['', 'not json', '{ "employer": ', '<html>Maintenance</html>', 'null', '[]', '123', '"text"', 'true'])('sends the link alone for the answer %j', async (body) => {
    const { opened } = await onPlatsbanken(reply(body))
    expectLinkOnly(opened)
  })

  it('sends the link alone when the request fails', async () => {
    const { opened } = await onPlatsbanken(() => Promise.reject(new Error('Failed to fetch')))
    expectLinkOnly(opened)
  })

  it('sends the link alone when fetch throws at once', async () => {
    const { opened } = await onPlatsbanken(() => {
      throw new Error('blocked by the page')
    })
    expectLinkOnly(opened)
  })

  it('sends the link alone when reading the answer fails', async () => {
    const { opened } = await onPlatsbanken(() => Promise.resolve({ status: 200, text: () => Promise.reject(new Error('stream broke')) }))
    expectLinkOnly(opened)
  })

  it('sends the link alone when the page has no fetch', async () => {
    const { opened, fetchCalls } = await onPlatsbanken(undefined)
    expect(fetchCalls).toEqual([])
    expectLinkOnly(opened)
  })

  it('gives up after 2.5 seconds, aborts the request and opens with the link alone', async () => {
    const started = start({ href: PB, fetch: never })
    await vi.advanceTimersByTimeAsync(2499)
    expect(started.opened).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expectLinkOnly(started.opened)
    expect(only(started.fetchCalls).init.signal?.aborted).toBe(true)
  })

  it('opens once even if the answer arrives after the time limit', async () => {
    let answer: (response: FakeResponse) => void = () => {}
    const late: FakeFetch = () => new Promise((resolve) => (answer = resolve))
    const started = start({ href: PB, fetch: late })
    await vi.advanceTimersByTimeAsync(2500)
    expect(started.opened).toHaveLength(1)
    answer({ status: 200, text: () => Promise.resolve(JSON.stringify(ad())) })
    await vi.advanceTimersByTimeAsync(5000)
    expectLinkOnly(started.opened)
  })

  it('opens once even if the answer arrives together with the time limit', async () => {
    let answer: (response: FakeResponse) => void = () => {}
    const slow: FakeFetch = () => new Promise((resolve) => (answer = resolve))
    const started = start({ href: PB, fetch: slow })
    await vi.advanceTimersByTimeAsync(2499)
    answer({ status: 200, text: () => Promise.resolve(JSON.stringify(ad())) })
    await vi.advanceTimersByTimeAsync(1)
    expect(started.opened).toHaveLength(1)
  })

  it('shows the box with the link alone when the click has run out by the time the answer is in', async () => {
    const started = start({ href: PB, fetch: replyAd(), userActivation: { isActive: false } })
    await settle()
    expect(started.opened).toEqual([])
    const [link] = only(started.body.children).children
    expect(readAddHash((link?.href ?? '').slice(APP.length))).toMatchObject({ kind: 'prefill', prefill: { link: PB, company: 'Humana AB' } })
  })
})
