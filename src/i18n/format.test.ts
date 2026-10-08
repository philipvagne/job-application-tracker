import { describe, expect, it } from 'vitest'
import { formatFileSize } from './format'

describe('formatFileSize', () => {
  it('shows whole kilobytes under 1 MB, at least 1 KB', () => {
    expect(formatFileSize(113 * 1024, 'en')).toBe('113 KB')
    expect(formatFileSize(113 * 1024, 'sv')).toBe('113 KB')
    expect(formatFileSize(1, 'en')).toBe('1 KB')
  })

  it('shows megabytes with one decimal, with a decimal comma in Swedish', () => {
    const size = Math.round(1.2 * 1024 * 1024)
    expect(formatFileSize(size, 'en')).toBe('1.2 MB')
    expect(formatFileSize(size, 'sv')).toBe('1,2 MB')
    expect(formatFileSize(5 * 1024 * 1024, 'en')).toBe('5 MB')
  })

  it('gives nothing for a size that makes no sense', () => {
    expect(formatFileSize(-1, 'en')).toBe('')
    expect(formatFileSize(Number.NaN, 'en')).toBe('')
  })
})
