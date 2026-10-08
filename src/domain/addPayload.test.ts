import { describe, expect, it } from 'vitest'
import { MAX_ADD_TEXT_LENGTH, cleanAddText, readAddHash } from './addPayload'

const enc = encodeURIComponent
const LINK = 'https://www.example.com/jobs/123?ref=a&b=c'

function hash(fields: Record<string, string>, prefix = '#add=1&v=1'): string {
  return prefix + Object.entries(fields).map(([k, v]) => `&${k}=${enc(v)}`).join('')
}

describe('readAddHash', () => {
  it('reads a link with company and role', () => {
    expect(readAddHash(hash({ u: LINK, jo: 'Acme AB', jt: 'Frontendutvecklare' }))).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'Acme AB', role: 'Frontendutvecklare' },
    })
  })

  it('reads a link alone, with empty company and role', () => {
    expect(readAddHash(hash({ u: LINK }))).toEqual({ kind: 'prefill', prefill: { link: LINK, company: '', role: '' } })
  })

  it('works with or without the leading #', () => {
    expect(readAddHash(hash({ u: LINK }).slice(1)).kind).toBe('prefill')
  })

  it('ignores the page title and unknown fields', () => {
    expect(readAddHash(hash({ u: LINK, dt: 'Some page - Site', x: 'y' }))).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: '', role: '' },
    })
  })

  it('keeps å, ä, ö and other letters', () => {
    const result = readAddHash(hash({ u: LINK, jo: 'Östersunds kommun', jt: 'Systemutvecklare – Åre' }))
    expect(result).toEqual({
      kind: 'prefill',
      prefill: { link: LINK, company: 'Östersunds kommun', role: 'Systemutvecklare – Åre' },
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
      prefill: { link: LINK, company: 'c'.repeat(MAX_ADD_TEXT_LENGTH), role: 'r'.repeat(MAX_ADD_TEXT_LENGTH) },
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
      prefill: { link: LINK, company: 'Acme', role: 'Dev' },
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
