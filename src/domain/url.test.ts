import { describe, expect, it } from 'vitest'
import { cleanJobLink, hostOf, isHttpUrl, openableLink } from './url'

describe('isHttpUrl', () => {
  it.each([
    'http://example.com',
    'https://example.com/jobs/1?x=1#top',
    'HTTPS://EXAMPLE.COM',
    '  https://example.com  ',
    'https://localhost:3000/a',
    'https://xn--bcher-kva.example/ö',
  ])('accepts %j', (text) => {
    expect(isHttpUrl(text)).toBe(true)
  })

  it.each([
    '',
    '   ',
    'example.com',
    'www.example.com',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    'file:///etc/passwd',
    'ftp://example.com',
    'mailto:a@b.se',
    'blob:https://example.com/x',
    'https://',
    'http:///path',
    'https://exa mple.com',
    'https://example.com/a b',
    'https://example.com\nhttps://other.com',
    '//example.com',
    `https://example.com/${'a'.repeat(2100)}`,
  ])('rejects %j', (text) => {
    expect(isHttpUrl(text)).toBe(false)
  })

  it('rejects values that are not text', () => {
    for (const value of [undefined, null, 5, {}, ['https://a.se']]) expect(isHttpUrl(value)).toBe(false)
  })
})

describe('hostOf', () => {
  it('returns the host without www', () => {
    expect(hostOf('https://www.example.com/jobs/1')).toBe('example.com')
    expect(hostOf('http://WWW.Example.COM')).toBe('example.com')
    expect(hostOf('https://jobs.example.com')).toBe('jobs.example.com')
    expect(hostOf('https://example.com:8080/x')).toBe('example.com')
  })

  it('returns null for anything that is not an http(s) link', () => {
    expect(hostOf('javascript:alert(1)')).toBeNull()
    expect(hostOf('example.com')).toBeNull()
    expect(hostOf('')).toBeNull()
  })
})

describe('openableLink', () => {
  it('returns the trimmed text for http and https links', () => {
    expect(openableLink('  https://example.com/jobs/1?x=1  ')).toBe('https://example.com/jobs/1?x=1')
    expect(openableLink('http://example.com')).toBe('http://example.com')
  })

  it.each([
    '',
    '   ',
    'example.com',
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    'data:text/html,hi',
    'vbscript:x',
    'file:///etc/passwd',
    'ftp://example.com',
    'blob:https://example.com/x',
    'https://example.com/a b',
    `https://example.com/${'a'.repeat(3000)}`,
  ])('returns null for %j', (text) => {
    expect(openableLink(text)).toBeNull()
  })
})

describe('cleanJobLink', () => {
  const VIEW = 'https://www.linkedin.com/jobs/view/4469748142'

  it('turns a LinkedIn search page with currentJobId into the job page', () => {
    expect(cleanJobLink('https://www.linkedin.com/jobs/search-results/?currentJobId=4469748142&eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=abc%3D%3D&trackingId=x')).toBe(VIEW)
    expect(cleanJobLink('https://www.linkedin.com/jobs/search/?currentJobId=4469748142&keywords=android')).toBe(VIEW)
    expect(cleanJobLink('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4469748142')).toBe(VIEW)
    expect(cleanJobLink('https://www.linkedin.com/jobs/?currentJobId=4469748142#top')).toBe(VIEW)
  })

  it('turns a /jobs/view/ page, with or without a slug, trailing slash, parameters or fragment, into the short form', () => {
    for (const link of [
      'https://www.linkedin.com/jobs/view/4469748142',
      'https://www.linkedin.com/jobs/view/4469748142/',
      'https://www.linkedin.com/jobs/view/4469748142/?trackingId=a&refId=b',
      'https://www.linkedin.com/jobs/view/android-developer-at-geoguessr-4469748142',
      'https://www.linkedin.com/jobs/view/android-developer-at-geoguessr-4469748142/?refId=x#apply',
      'https://www.linkedin.com/jobs/view/3m-systems-engineer-at-3m-4469748142',
      'http://www.linkedin.com/jobs/view/4469748142',
    ]) {
      expect(cleanJobLink(link)).toBe(VIEW)
    }
  })

  it('works for linkedin.com, www. and country subdomains, in any letter case', () => {
    for (const host of ['linkedin.com', 'www.linkedin.com', 'se.linkedin.com', 'uk.linkedin.com', 'WWW.LinkedIn.COM']) {
      expect(cleanJobLink(`https://${host}/jobs/view/4469748142`)).toBe(VIEW)
      expect(cleanJobLink(`https://${host}/jobs/search-results/?currentJobId=4469748142`)).toBe(VIEW)
    }
  })

  it('prefers the job page address over a currentJobId on the same page', () => {
    expect(cleanJobLink('https://www.linkedin.com/jobs/view/111?currentJobId=222')).toBe('https://www.linkedin.com/jobs/view/111')
  })

  it('leaves other LinkedIn pages alone', () => {
    for (const link of [
      'https://www.linkedin.com/',
      'https://www.linkedin.com/feed/?currentJobId=4469748142',
      'https://www.linkedin.com/in/someone/',
      'https://www.linkedin.com/company/geoguessr/jobs/',
      'https://www.linkedin.com/jobs/',
      'https://www.linkedin.com/jobs/search/?keywords=android',
      'https://www.linkedin.com/jobs/view/',
      'https://www.linkedin.com/jobs/view/android-developer',
      'https://www.linkedin.com/jobs/view/4469748142/apply',
      'https://www.linkedin.com/comm/jobs/view/4469748142',
      'https://www.linkedin.com/Jobs/View/4469748142',
    ]) {
      expect(cleanJobLink(link)).toBe(link)
    }
  })

  it('leaves an id that is missing, empty, not digits, too long or repeated alone', () => {
    for (const link of [
      'https://www.linkedin.com/jobs/search-results/',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=abc',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=12ab',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=-5',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1.5',
      `https://www.linkedin.com/jobs/search-results/?currentJobId=${'9'.repeat(21)}`,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1&currentJobId=2',
      'https://www.linkedin.com/jobs/search-results/?CurrentJobId=1',
      `https://www.linkedin.com/jobs/view/${'9'.repeat(21)}`,
      'https://www.linkedin.com/jobs/view/%34%34',
    ]) {
      expect(cleanJobLink(link)).toBe(link)
    }
  })

  it('accepts the longest and the shortest sane id', () => {
    expect(cleanJobLink(`https://www.linkedin.com/jobs/view/${'9'.repeat(20)}`)).toBe(`https://www.linkedin.com/jobs/view/${'9'.repeat(20)}`)
    expect(cleanJobLink('https://www.linkedin.com/jobs/search-results/?currentJobId=7')).toBe('https://www.linkedin.com/jobs/view/7')
  })

  it('is not fooled by look-alike hosts, ports or other schemes', () => {
    for (const link of [
      'https://evil-linkedin.com/jobs/view/4469748142',
      'https://linkedin.com.evil.com/jobs/view/4469748142',
      'https://notlinkedin.com/jobs/view/4469748142',
      'https://linkedin.com:8443/jobs/view/4469748142',
      'https://example.com/jobs/view/4469748142',
      'https://example.com/?next=https://www.linkedin.com/jobs/view/4469748142',
      'ftp://www.linkedin.com/jobs/view/4469748142',
      'javascript:alert(1)//www.linkedin.com/jobs/view/4469748142',
      'data:text/html,<b>x</b>',
      'file:///jobs/view/4469748142',
    ]) {
      expect(cleanJobLink(link)).toBe(link)
    }
  })

  it('drops login details and anything hostile in the query or fragment of a LinkedIn job link', () => {
    expect(cleanJobLink('https://user:pw@www.linkedin.com/jobs/view/4469748142?x=<script>alert(1)</script>#"onload=alert(1)')).toBe(VIEW)
  })

  it('returns text that is not an http(s) link exactly as given', () => {
    for (const text of ['', '   ', 'not a link', 'linkedin.com/jobs/view/4469748142', 'https://', 'https:///www.linkedin.com/jobs/view/1', 'https://www.linkedin.com/jobs/view/1 2', '\u0000']) {
      expect(cleanJobLink(text)).toBe(text)
    }
  })

  it('shortens a Platsbanken ad link, with www., a query, a fragment or a trailing slash', () => {
    const ad = 'https://arbetsformedlingen.se/platsbanken/annonser/31572415'
    for (const link of [
      ad,
      `${ad}/`,
      `${ad}?q=v%C3%A5rd&utm_source=x`,
      `${ad}#kontakt`,
      'https://www.arbetsformedlingen.se/platsbanken/annonser/31572415',
      'http://ARBETSFORMEDLINGEN.se/platsbanken/annonser/31572415/',
    ]) {
      expect(cleanJobLink(link)).toBe(ad)
    }
  })

  it('leaves other Platsbanken and Arbetsförmedlingen pages alone', () => {
    for (const link of [
      'https://arbetsformedlingen.se/platsbanken/annonser',
      'https://arbetsformedlingen.se/platsbanken/annonser?p=1&k=x',
      'https://arbetsformedlingen.se/platsbanken/annonser/abc',
      'https://arbetsformedlingen.se/platsbanken/annonser/1234567890123',
      'https://arbetsformedlingen.se/platsbanken/annonser/31572415/extra',
      'https://arbetsformedlingen.se/other/platsbanken/annonser/31572415',
      'https://arbetsformedlingen.se.example.com/platsbanken/annonser/31572415',
      'https://example.com/platsbanken/annonser/31572415',
      'https://arbetsformedlingen.se:8443/platsbanken/annonser/31572415',
    ]) {
      expect(cleanJobLink(link)).toBe(link)
    }
  })

  it('does not touch links on any other site, including their tracking parameters', () => {
    for (const link of ['https://careers.example.com/jobs/42?ref=a&b=c#apply', 'https://www.indeed.com/viewjob?jk=abc&utm_source=x', 'https://jobb.humana.se/jobb/42/']) {
      expect(cleanJobLink(link)).toBe(link)
    }
  })

  it('gives the same answer when applied twice', () => {
    for (const link of ['https://www.linkedin.com/jobs/search-results/?currentJobId=4469748142&eBP=x', 'https://www.arbetsformedlingen.se/platsbanken/annonser/1?x=2', 'https://acme.se/x']) {
      expect(cleanJobLink(cleanJobLink(link))).toBe(cleanJobLink(link))
    }
  })

  it('gives a link that rows can still open, and a host they can still show', () => {
    const cleaned = cleanJobLink('https://www.linkedin.com/jobs/search-results/?currentJobId=4469748142&eBP=x')
    expect(openableLink(cleaned)).toBe(VIEW)
    expect(hostOf(cleaned)).toBe('linkedin.com')
  })
})
