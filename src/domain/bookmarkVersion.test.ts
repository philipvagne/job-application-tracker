import { describe, expect, it } from 'vitest'
import { CURRENT_BOOKMARK_VERSION } from './addPayload'
import { bookmarkVersionOfPayload, isOutdatedBookmarkVersion, readBookmarkVersion } from './bookmarkVersion'

describe('readBookmarkVersion', () => {
  it('accepts whole numbers from 1 to 9999, as text or as a number', () => {
    expect(readBookmarkVersion('1')).toBe(1)
    expect(readBookmarkVersion('2')).toBe(2)
    expect(readBookmarkVersion(2)).toBe(2)
    expect(readBookmarkVersion('9999')).toBe(9999)
    expect(readBookmarkVersion(9999)).toBe(9999)
  })

  it('rejects everything else', () => {
    for (const value of [null, undefined, '', ' 2', '2 ', '02x', '0', 0, -1, '-1', 1.5, '1.5', '10000', 10000, Number.NaN, Infinity, 'abc', [], [2], {}, true, '٣']) {
      expect(readBookmarkVersion(value)).toBeNull()
    }
  })
})

describe('bookmarkVersionOfPayload', () => {
  it('reads bv, and counts a missing or unusable one as the first bookmark', () => {
    expect(bookmarkVersionOfPayload('2')).toBe(2)
    expect(bookmarkVersionOfPayload(null)).toBe(1)
    expect(bookmarkVersionOfPayload('')).toBe(1)
    expect(bookmarkVersionOfPayload('abc')).toBe(1)
    expect(bookmarkVersionOfPayload('0')).toBe(1)
  })
})

describe('isOutdatedBookmarkVersion', () => {
  it('is outdated only for a known version below the current one', () => {
    expect(isOutdatedBookmarkVersion(1, CURRENT_BOOKMARK_VERSION)).toBe(true)
    expect(isOutdatedBookmarkVersion(CURRENT_BOOKMARK_VERSION, CURRENT_BOOKMARK_VERSION)).toBe(false)
    expect(isOutdatedBookmarkVersion(CURRENT_BOOKMARK_VERSION + 1, CURRENT_BOOKMARK_VERSION)).toBe(false)
  })

  it('does not warn someone who has not used a bookmark yet', () => {
    expect(isOutdatedBookmarkVersion(null, CURRENT_BOOKMARK_VERSION)).toBe(false)
  })
})
