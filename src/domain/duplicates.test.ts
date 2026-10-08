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
