import { describe, expect, it } from 'vitest'
import { accessibleTitle, applicationTitle, linkHint, titleParts } from './displayName'

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

  it('adds the role after the website name when the company is missing, to tell rows apart', () => {
    expect(applicationTitle({ company: '', role: ' Frontendutvecklare ', url: 'https://www.arbetsformedlingen.se/1' })).toBe(
      'arbetsformedlingen.se · Frontendutvecklare',
    )
    expect(applicationTitle({ company: '', role: '', url: 'https://www.arbetsformedlingen.se/1' })).toBe('arbetsformedlingen.se')
    expect(applicationTitle({ company: 'Acme', role: 'Dev', url: 'https://a.se' })).toBe('Acme')
  })
})

describe('titleParts', () => {
  it('gives the company, trimmed, and no host needed', () => {
    expect(titleParts({ company: ' Acme AB ', url: 'https://www.a.se/x' })).toEqual({ company: 'Acme AB', host: 'a.se' })
  })

  it('has no company for empty or blank text, and the host without www', () => {
    expect(titleParts({ company: '', url: 'https://www.jobs.example.se/a?x=1' })).toEqual({ company: null, host: 'jobs.example.se' })
    expect(titleParts({ company: '   ', url: 'http://careers.acme.com' })).toEqual({ company: null, host: 'careers.acme.com' })
  })

  it('has no host when the link is missing or not http(s)', () => {
    expect(titleParts({ company: 'Acme', url: '' })).toEqual({ company: 'Acme', host: null })
    expect(titleParts({ company: '', url: 'javascript:alert(1)' })).toEqual({ company: null, host: null })
    expect(titleParts({ company: '', url: 'not a link' })).toEqual({ company: null, host: null })
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

describe('accessibleTitle', () => {
  it('is the same as applicationTitle when there is a company or a role', () => {
    expect(accessibleTitle({ company: 'Acme', role: '', url: 'https://a.se/jobs/dev' })).toBe('Acme')
    expect(accessibleTitle({ company: '', role: 'Dev', url: 'https://www.a.se/jobs/other' })).toBe('a.se · Dev')
  })

  it('adds the path hint when there is no company and no role', () => {
    expect(accessibleTitle({ company: '', role: '', url: 'https://www.a.se/jobs/frontend-developer' })).toBe(
      'a.se · frontend developer',
    )
  })

  it('is just the website name when the link has no hint', () => {
    expect(accessibleTitle({ company: '', role: '', url: 'https://www.a.se/' })).toBe('a.se')
  })
})
