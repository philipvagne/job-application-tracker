import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import sv from '../i18n/sv.json'
import { CURRENT_BOOKMARK_VERSION, MAX_ADD_TEXT_LENGTH, buildAddNote, cleanAddText, cleanIsoDate, readAddHash } from './addPayload'

const enc = encodeURIComponent
/** What a payload without the new fields reads as. */
const BASE = { occupation: '', deadline: '', outdatedBookmark: true }
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

describe('occupation, deadline and bookmark version', () => {
  const bv = `bv=${CURRENT_BOOKMARK_VERSION}`

  it('reads the occupation and the deadline', () => {
    const result = readAddHash(hash({ u: LINK, oc: 'Vårdare/Arbetshandledare/Boendestödjare', dl: '2026-11-08' }, `#add=1&v=1&${bv}`))
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: '', role: '', occupation: 'Vårdare/Arbetshandledare/Boendestödjare', deadline: '2026-11-08', outdatedBookmark: false },
    })
  })

  it('cleans the occupation like company and role, and cuts it', () => {
    const result = readAddHash(hash({ u: LINK, oc: '<b>Vårdare</b>&amp;Co' }))
    expect(result).toMatchObject({ prefill: { occupation: 'Vårdare &Co' } })
    const long = readAddHash(hash({ u: LINK, oc: 'o'.repeat(500) }))
    expect(long).toMatchObject({ prefill: { occupation: 'o'.repeat(MAX_ADD_TEXT_LENGTH) } })
  })

  it('leaves out a deadline that is not a real date, without refusing the payload', () => {
    for (const dl of ['', 'tomorrow', '2026-13-01', '2026-02-30', '2026-11-8', '2026-11-08T23:59:59', '<b>2026-11-08</b>', '08/11/2026']) {
      expect(readAddHash(hash({ u: LINK, dl }))).toMatchObject({ kind: 'prefill', prefill: { deadline: '' } })
    }
    expect(readAddHash(hash({ u: LINK, dl: '2028-02-29' }))).toMatchObject({ prefill: { deadline: '2028-02-29' } })
  })

  it('is invalid when oc, dl or bv is given twice', () => {
    expect(readAddHash(`${hash({ u: LINK, oc: 'A' })}&oc=B`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`${hash({ u: LINK, dl: '2026-11-08' })}&dl=2026-11-09`)).toEqual({ kind: 'invalid' })
    expect(readAddHash(`${hash({ u: LINK })}&bv=2&bv=2`)).toEqual({ kind: 'invalid' })
  })

  it('treats a missing or old bookmark version as outdated, and the current or a newer one as fine', () => {
    const outdated = (prefix: string) => {
      const result = readAddHash(hash({ u: LINK }, prefix))
      if (result.kind !== 'prefill') throw new Error(result.kind)
      return result.prefill.outdatedBookmark
    }
    expect(outdated('#add=1&v=1')).toBe(true)
    expect(outdated('#add=1&v=1&bv=1')).toBe(true)
    expect(outdated('#add=1&v=1&bv=')).toBe(true)
    expect(outdated('#add=1&v=1&bv=abc')).toBe(true)
    expect(outdated(`#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION}`)).toBe(false)
    expect(outdated(`#add=1&v=1&bv=${CURRENT_BOOKMARK_VERSION + 1}`)).toBe(false)
  })
})

describe('cleanIsoDate', () => {
  it('accepts real dates only', () => {
    expect(cleanIsoDate('2026-11-08')).toBe('2026-11-08')
    expect(cleanIsoDate(' 2026-11-08 ')).toBe('2026-11-08')
    expect(cleanIsoDate('2026-00-10')).toBe('')
    expect(cleanIsoDate('2027-02-29')).toBe('')
  })
})

describe('buildAddNote', () => {
  const prefill = { occupation: 'Vårdare/Arbetshandledare/Boendestödjare', deadline: '2026-11-08' }

  it('builds the note in Swedish', () => {
    const labels = { occupation: sv.quickAdd.noteOccupation, deadline: sv.quickAdd.noteDeadline }
    expect(buildAddNote(prefill, labels)).toBe('Yrke: Vårdare/Arbetshandledare/Boendestödjare\nSista ansökningsdag: 2026-11-08')
  })

  it('builds the note in English', () => {
    const labels = { occupation: en.quickAdd.noteOccupation, deadline: en.quickAdd.noteDeadline }
    expect(buildAddNote(prefill, labels)).toBe('Occupation: Vårdare/Arbetshandledare/Boendestödjare\nLast application date: 2026-11-08')
  })

  it('leaves out what is not known, and is empty when nothing is', () => {
    const labels = { occupation: 'Yrke', deadline: 'Sista ansökningsdag' }
    expect(buildAddNote({ occupation: '', deadline: '2026-11-08' }, labels)).toBe('Sista ansökningsdag: 2026-11-08')
    expect(buildAddNote({ occupation: 'Vårdare', deadline: '' }, labels)).toBe('Yrke: Vårdare')
    expect(buildAddNote({ occupation: '', deadline: '' }, labels)).toBe('')
  })
})
