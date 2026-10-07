import { describe, expect, it } from 'vitest'
import { hostOf, isHttpUrl } from './url'

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
