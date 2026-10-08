import { describe, expect, it } from 'vitest'
import { CURRENT_BOOKMARK_VERSION, MAX_ADD_TEXT_LENGTH, cleanAddText, readAddHash } from './addPayload'

const enc = encodeURIComponent
/** What a payload without a bookmark version reads as. */
const BASE = { bookmarkVersion: 1, outdatedBookmark: true }
const LINK = 'https://www.example.com/jobs/123?ref=a&b=c'

function hash(fields: Record<string, string>, prefix = '#add=1&v=1'): string {
  return prefix + Object.entries(fields).map(([k, v]) => `&${k}=${enc(v)}`).join('')
}

describe('readAddHash', () => {
  it('reads a link with company and role', () => {
    expect(readAddHash(hash({ u: LINK, jo: 'Acme AB', jt: 'Frontendutvecklare' }))).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'Acme AB', role: 'Frontendutvecklare', ...BASE },
    })
  })

  it('reads a link alone, with empty company and role', () => {
    expect(readAddHash(hash({ u: LINK }))).toEqual({ kind: 'prefill', prefill: { link: LINK, company: '', role: '', ...BASE } })
  })

  it('works with or without the leading #', () => {
    expect(readAddHash(hash({ u: LINK }).slice(1)).kind).toBe('prefill')
  })

  it('ignores the page title and unknown fields', () => {
    expect(readAddHash(hash({ u: LINK, dt: 'Some page - Site', x: 'y' }))).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: '', role: '', ...BASE },
    })
  })

  it('keeps å, ä, ö and other letters', () => {
    const result = readAddHash(hash({ u: LINK, jo: 'Östersunds kommun', jt: 'Systemutvecklare – Åre' }))
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'Östersunds kommun', role: 'Systemutvecklare – Åre', ...BASE },
    })
  })

  it('is none when it is not an add payload', () => {
    for (const value of ['', '#', '#top', '#section-2', '#x=1&v=1&u=https%3A%2F%2Fa.se', '#address=1', '#nadd=1']) {
      expect(readAddHash(value)).toEqual({ kind: 'none' })
    }
  })

  it('is invalid for the wrong or a missing version', () => {
    expect(readAddHash(`#add=1&v=2&u=${enc(LINK)}`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`#add=1&u=${enc(LINK)}`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`#add=1&v=&u=${enc(LINK)}`)).toEqual({ kind: 'invalid' })
  })

  it('is invalid without a usable http(s) link', () => {
    for (const u of [
      '',
      '   ',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<b>x</b>',
      'file:///etc/passwd',
      'ftp://a.se/x',
      '//a.se/x',
      'not a link',
      'https://a.se/with space',
      `https://a.se/${'x'.repeat(2100)}`,
    ]) {
      expect(readAddHash(hash({ u }))).toEqual({ kind: 'invalid' })
    }
    expect(readAddHash('#add=1&v=1')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when a field is given twice, so nothing ambiguous is used', () => {
    expect(readAddHash(`${hash({ u: LINK })}&u=${enc('https://other.se')}`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`${hash({ u: LINK, jo: 'A' })}&jo=B`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`${hash({ u: LINK, jt: 'A' })}&jt=B`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`${hash({ u: LINK })}&v=1`)).toEqual({ kind: 'invalid' })
  })

  it('is invalid for a huge fragment', () => {
    expect(readAddHash(hash({ u: LINK, jo: 'x'.repeat(9000) }))).toEqual({ kind: 'invalid' })
  })

  it('cuts a long company and role instead of refusing the link', () => {
    const result = readAddHash(hash({ u: LINK, jo: 'c'.repeat(500), jt: 'r'.repeat(500) }))
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'c'.repeat(MAX_ADD_TEXT_LENGTH), role: 'r'.repeat(MAX_ADD_TEXT_LENGTH), ...BASE },
    })
  })

  it('survives garbage', () => {
    for (const value of ['#add', '#add=', '#add=1&&&===&%', '#add=1&v=1&u=%E0%A4%A', '#add=1&v=1&u=%', '#%%%%', '####add=1']) {
      const result = readAddHash(value)
      expect(['none', 'invalid']).toContain(result.kind)
    }
  })

  it('removes markup from company and role; what is left is plain text', () => {
    const result = readAddHash(hash({ u: LINK, jo: '<img src=x onerror=alert(1)>Acme', jt: '<b>Dev</b>' }))
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'Acme', role: 'Dev', ...BASE },
    })
  })

  it('keeps a lone < as plain text', () => {
    const result = readAddHash(hash({ u: LINK, jt: 'C <3 Dev' }))
    expect(result).toMatchObject({ prefill: { role: 'C <3 Dev' } })
  })
})

describe('cleanAddText', () => {
  it('trims and collapses whitespace, including line breaks and tabs', () => {
    expect(cleanAddText('  Acme \n\t  AB  ')).toBe('Acme AB')
  })

  it('turns control characters into spaces', () => {
    expect(cleanAddText('Acme\u0000AB\u0007x')).toBe('Acme AB x')
  })

  it('removes invisible formatting and text-direction characters', () => {
    expect(cleanAddText('Ac​me‮ AB')).toBe('Acme AB')
  })

  it('decodes common entities once, as text', () => {
    expect(cleanAddText('R&amp;D &quot;Lead&quot; &#39;x&#39; &#x41; &nbsp;y')).toBe('R&D "Lead" \'x\' A y')
    expect(cleanAddText('&amp;lt;')).toBe('&lt;')
  })

  it('replaces HTML tags with a space, also ones that arrive as entities', () => {
    expect(cleanAddText('Senior<br>Developer')).toBe('Senior Developer')
    expect(cleanAddText('<b>Acme</b> AB')).toBe('Acme AB')
    expect(cleanAddText('Lead&lt;br/&gt;Dev')).toBe('Lead Dev')
    expect(cleanAddText('<p class="x">Hej</p>')).toBe('Hej')
  })

  it('leaves a lone < or > alone', () => {
    expect(cleanAddText('5 < 6 and 7 > 3')).toBe('5 < 6 and 7 > 3')
    expect(cleanAddText('a <3 b')).toBe('a <3 b')
  })

  it('leaves unknown or invalid entities as written', () => {
    expect(cleanAddText('&unknown; &#0; &#xD800; &#99999999;')).toBe('&unknown; &#0; &#xD800; &#99999999;')
  })

  it('cuts at the limit without splitting a character', () => {
    const text = '😀'.repeat(MAX_ADD_TEXT_LENGTH + 5)
    expect(Array.from(cleanAddText(text))).toHaveLength(MAX_ADD_TEXT_LENGTH)
  })

  it('is empty for whitespace only', () => {
    expect(cleanAddText(' \n ')).toBe('')
  })
})

describe('bookmark version', () => {
  const bv = `bv=${CURRENT_BOOKMARK_VERSION}`

  it('treats a missing or old bookmark version as outdated, and the current or a newer one as fine', () => {
    const outdated = (prefix: string) => {
      const result = readAddHash(hash({ u: LINK }, prefix))
      if (result.kind !== 'prefill') throw new Error(result.kind)
      return result.prefill.outdatedBookmark
    }
    expect(outdated('#add=1&v=1')).toBe(true)
    expect(outdated('#add=1&v=1&bv=1')).toBe(true)
    expect(outdated(`#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION - 1}`)).toBe(true)
    expect(outdated('#add=1&v=1&bv=')).toBe(true)
    expect(outdated('#add=1&v=1&bv=abc')).toBe(true)
    expect(outdated(`#add=1&v=1&${bv}`)).toBe(false)
    expect(outdated(`#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION + 1}`)).toBe(false)
  })

  it('reads the version the bookmark sent, and 1 when it said nothing usable', () => {
    const versionOf = (prefix: string) => {
      const result = readAddHash(hash({ u: LINK }, prefix))
      if (result.kind !== 'prefill') throw new Error(result.kind)
      return result.prefill.bookmarkVersion
    }
    expect(versionOf('#add=1&v=1&bv=2')).toBe(2)
    expect(versionOf(`#add=1&v=1&${bv}`)).toBe(CURRENT_BOOKMARK_VERSION)
    expect(versionOf('#add=1&v=1')).toBe(1)
    expect(versionOf('#add=1&v=1&bv=x')).toBe(1)
  })

  it('is invalid when bv is given twice', () => {
    expect(readAddHash(`${hash({ u: LINK })}&bv=3&bv=3`)).toEqual({ kind: 'invalid' })
  })
})

describe('payloads from older bookmarks', () => {
  const PB = 'https://arbetsformedlingen.se/platsbanken/annonser/31572415'
  const HEADLINE = 'Vill du bli vår nya kollega? Vi söker boendestödjare till Basvägen LSS'

  it('uses the headline in jt as the role, ignores oc and dl, and marks the bookmark as outdated (version 2)', () => {
    const v2 = hash(
      { u: PB, jt: HEADLINE, jo: 'Humana AB', oc: 'Vårdare/Arbetshandledare/Boendestödjare', dl: '2026-11-08', dt: 'Annons - Platsbanken' },
      '#add=1&v=1&bv=2',
    )
    const result = readAddHash(v2)
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: PB, company: 'Humana AB', role: HEADLINE, bookmarkVersion: 2, outdatedBookmark: true },
    })
    // Nothing for a note or a deadline is carried over: the prefill has exactly these fields.
    if (result.kind !== 'prefill') throw new Error(result.kind)
    expect(Object.keys(result.prefill).sort()).toEqual(['bookmarkVersion', 'company', 'link', 'outdatedBookmark', 'role'])
  })

  it('still accepts oc and dl given twice, or with nonsense, because they are not read', () => {
    const v2 = `${hash({ u: PB, jo: 'Humana AB', oc: 'A', dl: 'not a date' }, '#add=1&v=1&bv=2')}&oc=B&dl=2026-01-01`
    expect(readAddHash(v2)).toMatchObject({ kind: 'prefill', prefill: { company: 'Humana AB', outdatedBookmark: true } })
  })

  it('reads a version 1 payload with no bv the same way', () => {
    expect(readAddHash(hash({ u: PB, jt: HEADLINE, jo: 'Humana AB' }))).toEqual({
      kind: 'prefill',
      prefill: { link: PB, company: 'Humana AB', role: HEADLINE, bookmarkVersion: 1, outdatedBookmark: true },
    })
  })

  it('reads the current version as up to date, with the occupation as the role', () => {
    const current = hash({ u: PB, jt: 'Vårdare/Arbetshandledare/Boendestödjare', jo: 'Humana AB' }, `#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION}`)
    expect(readAddHash(current)).toEqual({
      kind: 'prefill',
      prefill: { link: PB, company: 'Humana AB', role: 'Vårdare/Arbetshandledare/Boendestödjare', bookmarkVersion: CURRENT_BOOKMARK_VERSION, outdatedBookmark: false },
    })
  })
})

describe('payloads from version 3 bookmarks', () => {
  it('uses jt as the role as before, ignores dt, and marks the bookmark as outdated', () => {
    const v3 = hash(
      { u: 'https://jobb.example.se/jobb/42', jt: 'Bli en del av vårt fantastiska team!', jo: 'Exempel AB', dt: 'Jobb - Exempel' },
      '#add=1&v=1&bv=3',
    )
    const result = readAddHash(v3)
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: 'https://jobb.example.se/jobb/42', company: 'Exempel AB', role: 'Bli en del av vårt fantastiska team!', bookmarkVersion: 3, outdatedBookmark: true },
    })
    expect(CURRENT_BOOKMARK_VERSION).toBeGreaterThan(3)
  })

  it('reads a current payload with only a link and a company as up to date, with an empty role', () => {
    const current = hash({ u: 'https://jobb.example.se/jobb/42', jo: 'Exempel AB' }, `#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION}`)
    expect(readAddHash(current)).toEqual({
      kind: 'prefill',
      prefill: { link: 'https://jobb.example.se/jobb/42', company: 'Exempel AB', role: '', bookmarkVersion: CURRENT_BOOKMARK_VERSION, outdatedBookmark: false },
    })
  })
})
