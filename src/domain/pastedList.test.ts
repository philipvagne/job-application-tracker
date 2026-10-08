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

  it('splits a job title into role and company', () => {
    expect(parsePastedList('Frontend Developer - Acme AB | LinkedIn').items).toEqual([
      { url: '', company: 'Acme AB', role: 'Frontend Developer' },
    ])
    expect(parsePastedList('Designer at Globex').items[0]).toEqual({ url: '', company: 'Globex', role: 'Designer' })
  })

  it('uses the whole line as company when the title cannot be split', () => {
    expect(parsePastedList('Initech').items).toEqual([{ url: '', company: 'Initech', role: '' }])
    expect(parsePastedList('Acme: Developer').items[0]?.company).toBe('Acme: Developer')
  })

  it('accepts a company of exactly 120 characters and skips 121', () => {
    expect(parsePastedList('x'.repeat(120))).toEqual({
      items: [{ url: '', company: 'x'.repeat(120), role: '' }],
      skipped: 0,
      duplicates: 0,
    })
    expect(parsePastedList('x'.repeat(121))).toEqual({ items: [], skipped: 1, duplicates: 0 })
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

  it('keeps markup as plain text', () => {
    expect(parsePastedList('<img src=x onerror=alert(1)>').items[0]?.company).toBe('<img src=x onerror=alert(1)>')
  })

  it('handles emoji and non-Latin text', () => {
    expect(parsePastedList('Östra Sjukhuset 🏥').items[0]?.company).toBe('Östra Sjukhuset 🏥')
  })
})
