import { describe, expect, it } from 'vitest'
import { findByLink, linkKey } from './duplicates'
import type { Application } from './types'

function app(id: string, url: string, overrides: Partial<Application> = {}): Application {
  return { id, company: '', role: '', url, status: 'to_apply', createdAt: '2026-10-01T08:00:00.000Z', ...overrides }
}

describe('linkKey', () => {
  it('ignores case in the host, www, a trailing slash, the fragment and tracking parameters', () => {
    const key = linkKey('https://acme.se/jobs/1')
    expect(linkKey('https://WWW.Acme.SE/jobs/1/')).toBe(key)
    expect(linkKey('http://acme.se/jobs/1#apply')).toBe(key)
    expect(linkKey('https://acme.se/jobs/1?utm_source=x&utm_medium=y&fbclid=z&gclid=1')).toBe(key)
    expect(linkKey('  https://acme.se/jobs/1  ')).toBe(key)
  })

  it('keeps other parameters, because job ids often live there', () => {
    expect(linkKey('https://acme.se/job?id=1')).not.toBe(linkKey('https://acme.se/job?id=2'))
  })

  it('keeps the path case, and different paths apart', () => {
    expect(linkKey('https://acme.se/Jobs/1')).not.toBe(linkKey('https://acme.se/jobs/1'))
    expect(linkKey('https://acme.se/jobs/1')).not.toBe(linkKey('https://acme.se/jobs/2'))
  })

  it('is null for anything that is not an http(s) link', () => {
    for (const text of ['', 'javascript:alert(1)', 'a.se', 'ftp://a.se', 'https://a b.se']) {
      expect(linkKey(text)).toBeNull()
    }
  })
})

describe('findByLink', () => {
  const list = [app('a', ''), app('b', 'https://acme.se/jobs/1'), app('c', 'https://acme.se/jobs/2', { status: 'closed' })]

  it('finds the same link in any status', () => {
    expect(findByLink(list, 'https://www.acme.se/jobs/1/?utm_campaign=x')?.id).toBe('b')
    expect(findByLink(list, 'https://acme.se/jobs/2')?.id).toBe('c')
  })

  it('finds nothing for a new link, an empty link or a bad one', () => {
    expect(findByLink(list, 'https://acme.se/jobs/3')).toBeNull()
    expect(findByLink(list, '')).toBeNull()
    expect(findByLink(list, 'javascript:alert(1)')).toBeNull()
  })
})

describe('the same job in its long and short forms', () => {
  const LONG = 'https://www.linkedin.com/jobs/search-results/?currentJobId=4469748142&eBP=NOT_ELIGIBLE_FOR_CHARGING&refId=abc'
  const SLUG = 'https://se.linkedin.com/jobs/view/android-developer-at-geoguessr-4469748142/?trackingId=x'
  const SHORT = 'https://www.linkedin.com/jobs/view/4469748142'

  it('gives all LinkedIn forms of one job the same key', () => {
    expect(linkKey(LONG)).toBe(linkKey(SHORT))
    expect(linkKey(SLUG)).toBe(linkKey(SHORT))
    expect(linkKey(SHORT)).toBe('linkedin.com/jobs/view/4469748142')
  })

  it('keeps different LinkedIn jobs apart', () => {
    expect(linkKey(SHORT)).not.toBe(linkKey('https://www.linkedin.com/jobs/view/4469748143'))
  })

  it('finds a saved long link when the short one is added, and the other way round', () => {
    expect(findByLink([app('a', LONG)], SHORT)?.id).toBe('a')
    expect(findByLink([app('a', SHORT)], LONG)?.id).toBe('a')
    expect(findByLink([app('a', SLUG)], LONG)?.id).toBe('a')
  })

  it('gives all Platsbanken forms of one ad the same key', () => {
    const ad = 'https://arbetsformedlingen.se/platsbanken/annonser/31572415'
    expect(linkKey(`${ad}?q=v%C3%A5rd`)).toBe(linkKey(ad))
    expect(linkKey('https://www.arbetsformedlingen.se/platsbanken/annonser/31572415/')).toBe(linkKey(ad))
    expect(findByLink([app('a', ad)], `${ad}?q=1#x`)?.id).toBe('a')
  })

  it('does not change how other links are compared', () => {
    expect(linkKey('https://acme.se/job?id=1')).not.toBe(linkKey('https://acme.se/job?id=2'))
    expect(linkKey('https://www.linkedin.com/in/someone/')).toBe('linkedin.com/in/someone')
  })
})
