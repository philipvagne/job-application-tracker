import { describe, expect, it } from 'vitest'
import { parsePastedList } from './pastedList'

describe('parsePastedList', () => {
  it('returns nothing for empty or blank text', () => {
    expect(parsePastedList('')).toEqual({ items: [], skipped: 0, duplicates: 0 })
    expect(parsePastedList('  \n\t\r\n   \n')).toEqual({ items: [], skipped: 0, duplicates: 0 })
  })

  it('turns a link into url, an empty company and an empty role', () => {
    expect(parsePastedList('https://www.acme.se/jobs/42')).toEqual({
      items: [{ url: 'https://www.acme.se/jobs/42', company: '', role: '' }],
      skipped: 0,
      duplicates: 0,
    })
  })

  it('leaves out links already in the list, and repeats within the paste, and counts them', () => {
    const existing = [{ url: 'https://www.a.se/job/1/?utm_source=x#top' }, { url: '' }]
    const text = ['https://a.se/job/1', 'https://b.se/x', 'https://B.se/x/', 'https://b.se/y'].join('\n')
    const r = parsePastedList(text, existing)
    expect(r.items.map((i) => i.url)).toEqual(['https://b.se/x', 'https://b.se/y'])
    expect(r.duplicates).toBe(2)
    expect(r.skipped).toBe(0)
  })

  it('trims lines and ignores blank ones, with any line ending', () => {
    const { items } = parsePastedList('  https://a.se  \r\n\r\n\thttps://b.se\n\n\rhttps://c.se')
    expect(items.map((i) => i.url)).toEqual(['https://a.se', 'https://b.se', 'https://c.se'])
  })

  it('skips lines that are not links, and does not turn them into companies', () => {
    expect(parsePastedList('Frontend Developer - Acme AB | LinkedIn')).toEqual({ items: [], skipped: 1, duplicates: 0 })
    expect(parsePastedList('Designer at Globex')).toEqual({ items: [], skipped: 1, duplicates: 0 })
    expect(parsePastedList('Initech')).toEqual({ items: [], skipped: 1, duplicates: 0 })
    expect(parsePastedList('x'.repeat(121))).toEqual({ items: [], skipped: 1, duplicates: 0 })
  })

  it('counts added, duplicate and skipped lines in a mixed paste', () => {
    const text = ['https://a.se/1', 'Initech', '', 'https://a.se/1', 'https://b.se/2', 'javascript:alert(1)'].join('\n')
    const r = parsePastedList(text, [{ url: 'https://b.se/2' }])
    expect(r.items.map((i) => i.url)).toEqual(['https://a.se/1'])
    expect(r.duplicates).toBe(2)
    expect(r.skipped).toBe(2)
  })

  it('skips links that are not http or https, and broken links', () => {
    const text = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,hi',
      'ftp://files.example.com/cv',
      'file:///C:/x',
      'https://',
      'https://bad host.se',
      'https://ok.se',
    ].join('\n')
    expect(parsePastedList(text)).toEqual({
      items: [{ url: 'https://ok.se', company: '', role: '' }],
      skipped: 7,
      duplicates: 0,
    })
  })

  it('reads at most 200 non-blank lines and counts the rest as skipped', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `https://example.com/${i}`)
    const { items, skipped } = parsePastedList(lines.join('\n\n'))
    expect(items).toHaveLength(200)
    expect(items[199]?.url).toBe('https://example.com/199')
    expect(skipped).toBe(50)
  })

  it('does not count blank lines against the cap', () => {
    expect(parsePastedList(`${'\n'.repeat(300)}https://a.se`).items).toHaveLength(1)
  })

  it('skips markup and emoji text instead of adding it', () => {
    expect(parsePastedList('<img src=x onerror=alert(1)>')).toEqual({ items: [], skipped: 1, duplicates: 0 })
    expect(parsePastedList('Östra Sjukhuset 🏥')).toEqual({ items: [], skipped: 1, duplicates: 0 })
  })
})
