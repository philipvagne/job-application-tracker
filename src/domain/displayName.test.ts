import { describe, expect, it } from 'vitest'
import { applicationTitle, linkHint } from './displayName'

describe('applicationTitle', () => {
  it('is the company when there is one', () => {
    expect(applicationTitle({ company: ' Acme AB ', url: 'https://www.other.se/x' })).toBe('Acme AB')
  })

  it('is the website name without www when the company is empty', () => {
    expect(applicationTitle({ company: '', url: 'https://www.jobs.example.se/a/b?x=1' })).toBe('jobs.example.se')
    expect(applicationTitle({ company: '  ', url: 'http://careers.acme.com' })).toBe('careers.acme.com')
  })

  it('falls back to the link as written when it has no usable host', () => {
    expect(applicationTitle({ company: '', url: 'not a link' })).toBe('not a link')
  })

  it('keeps markup as plain text', () => {
    expect(applicationTitle({ company: '<b>x</b>', url: '' })).toBe('<b>x</b>')
  })
})

describe('linkHint', () => {
  it('reads a slug as words', () => {
    expect(linkHint('https://acme.teamtailor.com/jobs/4821-frontend-developer')).toBe('frontend developer')
    expect(linkHint('https://acme.se/careers/senior_data_engineer.html')).toBe('senior data engineer')
  })

  it('decodes percent-encoding, and survives bad encoding', () => {
    expect(linkHint('https://acme.se/jobb/webbutvecklare-g%C3%B6teborg')).toBe('webbutvecklare göteborg')
    expect(linkHint('https://acme.se/jobb/bad-%E0%A4%A-slug')).toContain('bad')
  })

  it('uses a short last segment such as a job number when nothing reads as words', () => {
    expect(linkHint('https://www.linkedin.com/jobs/view/3912345678')).toBe('3912345678')
  })

  it('only reads the last segment, so a shared prefix like "annonser" is not the hint', () => {
    expect(linkHint('https://arbetsformedlingen.se/platsbanken/annonser/12345678')).toBe('12345678')
  })

  it('does not treat a hash or uuid as words, or as a short id', () => {
    expect(linkHint('https://acme.se/j/3f2b8c1e-9d4a-4b7e-8c1d-2a5f6e7b8c9d')).toBeNull()
  })

  it('is null when the link has no path or no usable path', () => {
    expect(linkHint('https://acme.se')).toBeNull()
    expect(linkHint('https://acme.se/')).toBeNull()
    expect(linkHint('nonsense')).toBeNull()
    expect(linkHint(`https://acme.se/${'1'.repeat(40)}`)).toBeNull()
  })

  it('shortens a long slug', () => {
    const hint = linkHint(`https://acme.se/jobs/${'developer-'.repeat(20)}end`)
    expect(hint?.length).toBe(60)
    expect(hint?.endsWith('…')).toBe(true)
  })

  it('ignores the query string and keeps two jobs on one site apart', () => {
    const a = linkHint('https://acme.se/jobs/backend-engineer?utm_source=x')
    const b = linkHint('https://acme.se/jobs/product-designer?utm_source=x')
    expect(a).toBe('backend engineer')
    expect(b).toBe('product designer')
  })

  it('returns markup as plain text', () => {
    expect(linkHint('https://acme.se/jobs/%3Cimg%20src%3Dx%3E-dev')).toBe('<img src=x> dev')
  })
})
