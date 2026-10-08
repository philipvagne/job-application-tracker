import { describe, expect, it } from 'vitest'
import { readAddHash } from './addPayload'
import { buildBookmarklet, isLocalAddress } from './bookmarkletSource'

const APP = 'https://tracker.example.workers.dev/'
const PAGE = 'https://careers.example.com/jobs/42?ref=a&b=c#apply'

interface Page {
  href?: string
  title?: string
  ogTitle?: string
  /** The text of each ld+json script. */
  blocks?: string[]
}

/** Runs the bookmarklet against a fake page and returns what it opened. */
function run(page: Page, appUrl = APP): { url: string; target: unknown; features: unknown }[] {
  const link = buildBookmarklet(appUrl)
  if (link === null) throw new Error('no bookmarklet')
  expect(link.startsWith('javascript:void')).toBe(true)
  // Browsers decode a javascript: address before running it.
  const code = decodeURIComponent(link.slice('javascript:'.length))
  const href = page.href ?? PAGE
  const url = new URL(href)
  const opened: { url: string; target: unknown; features: unknown }[] = []
  const fakeLocation = { href, origin: url.origin, pathname: url.pathname }
  const fakeDocument = {
    title: page.title ?? '',
    querySelectorAll: () => (page.blocks ?? []).map((textContent) => ({ textContent })),
    querySelector: () =>
      page.ogTitle === undefined ? null : { getAttribute: (name: string) => (name === 'content' ? page.ogTitle : null) },
  }
  const fakeWindow = {
    open: (target: string, name: unknown, features: unknown) => {
      opened.push({ url: target, target: name, features })
      return null
    },
  }
  const result: unknown = new Function('location', 'document', 'window', `return ${code}`)(fakeLocation, fakeDocument, fakeWindow)
  expect(result).toBeUndefined()
  return opened
}

function job(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Frontendutvecklare', hiringOrganization: { '@type': 'Organization', name: 'Acme AB' }, ...extra }
}

function only<T>(items: T[]): T {
  const [item] = items
  if (item === undefined || items.length !== 1) throw new Error(`expected exactly one call, got ${items.length}`)
  return item
}

function prefillOf(opened: { url: string }[]) {
  const { url } = only(opened)
  expect(url.startsWith(`${APP}#`)).toBe(true)
  const result = readAddHash(url.slice(APP.length))
  if (result.kind !== 'prefill') throw new Error(`not accepted: ${result.kind}`)
  return result.prefill
}

describe('buildBookmarklet', () => {
  it('is a javascript: address that parses', () => {
    const link = buildBookmarklet(APP)
    expect(link).not.toBeNull()
    expect(() => new Function(decodeURIComponent((link ?? '').slice('javascript:'.length)))).not.toThrow()
  })

  it('stays small, on one line, and has no raw spaces or quotes', () => {
    const link = buildBookmarklet(APP) ?? ''
    expect(link.length).toBeLessThan(3500)
    expect(link).not.toMatch(/[\s"<>#]/)
  })

  it('contains no link text except the address it was given', () => {
    const code = decodeURIComponent((buildBookmarklet(APP) ?? '').slice('javascript:'.length))
    expect(code).toContain(JSON.stringify(APP))
    expect(code.replace(JSON.stringify(APP), '')).not.toMatch(/https?:\/\/[a-z0-9]/i)
    expect(code).not.toMatch(/\b(fetch|XMLHttpRequest|eval|innerHTML|localStorage|cookie)\b/)
  })

  it('refuses an address that is not http(s)', () => {
    expect(buildBookmarklet('file:///C:/tracker/index.html')).toBeNull()
    expect(buildBookmarklet('javascript:alert(1)')).toBeNull()
    expect(buildBookmarklet('')).toBeNull()
  })

  it('opens a new tab without opener or referrer', () => {
    const call = only(run({ blocks: [JSON.stringify(job())] }))
    expect(call.target).toBe('_blank')
    expect(call.features).toBe('noopener,noreferrer')
  })
})

describe('what the bookmarklet reads', () => {
  it('takes title and company from a JobPosting block, the link without its fragment, and the page title', () => {
    const prefill = prefillOf(run({ blocks: [JSON.stringify(job())], title: 'Jobb - Acme' }))
    expect(prefill).toEqual({ link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: 'Acme AB', role: 'Frontendutvecklare' })
  })

  it('sends the page title as dt, from og:title when the page has no title', () => {
    const withTitle = only(run({ title: 'Page title' })).url
    expect(new URLSearchParams(withTitle.split('#')[1]).get('dt')).toBe('Page title')
    const withOg = only(run({ title: '', ogTitle: 'Open graph title' })).url
    expect(new URLSearchParams(withOg.split('#')[1]).get('dt')).toBe('Open graph title')
  })

  it('finds a JobPosting inside @graph', () => {
    const block = JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'Site' }, job()] })
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ company: 'Acme AB', role: 'Frontendutvecklare' })
  })

  it('finds a JobPosting in a top-level array', () => {
    const block = JSON.stringify([{ '@type': 'BreadcrumbList' }, job()])
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ role: 'Frontendutvecklare' })
  })

  it('accepts @type as an array or a full schema.org address', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ '@type': ['Thing', 'JobPosting'] }))] }))).toMatchObject({ role: 'Frontendutvecklare' })
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ '@type': 'https://schema.org/JobPosting' }))] }))).toMatchObject({ role: 'Frontendutvecklare' })
  })

  it('reads the company when hiringOrganization is a plain string or a list', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: 'Plain AB' }))] })).company).toBe('Plain AB')
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ hiringOrganization: [{ name: 'First AB' }, { name: 'Second AB' }] }))] })).company).toBe('First AB')
  })

  it('leaves a missing company or title empty without guessing from the page title', () => {
    const prefill = prefillOf(run({ blocks: [JSON.stringify({ '@type': 'JobPosting' })], title: 'Developer - Acme | Site' }))
    expect(prefill).toEqual({ link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: '', role: '' })
  })

  it('opens with the link alone when the page has no JSON-LD', () => {
    expect(prefillOf(run({}))).toEqual({ link: 'https://careers.example.com/jobs/42?ref=a&b=c', company: '', role: '' })
    expect(prefillOf(run({ title: 'Developer - Acme | Site' }))).toMatchObject({ company: '', role: '' })
  })

  it('picks the one JobPosting among several blocks', () => {
    const blocks = [JSON.stringify({ '@type': 'Organization', name: 'Wrong AB' }), JSON.stringify({ '@type': 'WebSite' }), JSON.stringify(job())]
    expect(prefillOf(run({ blocks }))).toMatchObject({ company: 'Acme AB', role: 'Frontendutvecklare' })
  })

  it('skips a block with broken JSON and still reads the next one', () => {
    expect(prefillOf(run({ blocks: ['{ not json', '', JSON.stringify(job())] }))).toMatchObject({ role: 'Frontendutvecklare' })
    expect(prefillOf(run({ blocks: ['{ not json'] })).role).toBe('')
  })

  it('does not read a JobPosting buried deeper than a few levels', () => {
    let nested: unknown = job()
    for (let i = 0; i < 8; i++) nested = { '@graph': [nested] }
    expect(prefillOf(run({ blocks: [JSON.stringify(nested)] })).role).toBe('')
  })

  it('skips a huge block', () => {
    expect(prefillOf(run({ blocks: [JSON.stringify(job({ description: 'x'.repeat(600_000) }))] })).role).toBe('')
  })

  it('hands html entities and tags to the tracker, which cleans them', () => {
    const block = JSON.stringify(job({ title: 'R&amp;D<br>Lead', hiringOrganization: { name: '<b>Acme</b> AB' } }))
    expect(prefillOf(run({ blocks: [block] }))).toMatchObject({ role: 'R&D Lead', company: 'Acme AB' })
  })
})

describe('limits', () => {
  it('cuts very long fields so the address stays readable by the tracker', () => {
    const long = 'Å'.repeat(5000)
    const opened = run({ blocks: [JSON.stringify(job({ title: long, hiringOrganization: { name: long } }))], title: long })
    const hash = only(opened).url.slice(APP.length)
    expect(hash.length).toBeLessThanOrEqual(7500 + 40)
    const prefill = prefillOf(opened)
    expect(Array.from(prefill.role)).toHaveLength(200)
    expect(Array.from(prefill.company)).toHaveLength(200)
  })

  it('never splits a character when it cuts', () => {
    const long = '😀'.repeat(400)
    expect(Array.from(prefillOf(run({ blocks: [JSON.stringify(job({ title: long }))] })).role).every((c) => c === '😀')).toBe(true)
  })

  it('leaves out a field that cannot be encoded and keeps the rest', () => {
    const prefill = prefillOf(run({ blocks: [JSON.stringify(job({ title: 'ab\ud800cd' }))] }))
    expect(prefill).toMatchObject({ role: '', company: 'Acme AB' })
  })

  it('drops the text fields rather than the link when the address would get too long', () => {
    const link = `https://careers.example.com/${'%C3%A5'.repeat(330)}`
    const long = 'Å'.repeat(300)
    const opened = run({ href: link, blocks: [JSON.stringify(job({ title: long, hiringOrganization: { name: long } }))], title: long })
    expect(prefillOf(opened).link).toBe(link)
    expect(only(opened).url.length - APP.length).toBeLessThan(8192)
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
      const link = buildBookmarklet(APP) ?? ''
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
