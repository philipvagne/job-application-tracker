import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from './memoryStorage'
import type { Storage } from './types'
import { UI_PREFERENCES_KEY, createUiPreferences } from './uiPreferences'

function blocked(): Storage {
  const fail = (): never => {
    throw new Error('blocked')
  }
  return { read: fail, write: fail, remove: fail }
}

describe('uiPreferences', () => {
  it('has no sort until one is chosen', () => {
    expect(createUiPreferences(createMemoryStorage()).getSort()).toBeNull()
  })

  it('remembers a chosen sort, also in a new instance on the same storage', () => {
    const storage = createMemoryStorage()
    createUiPreferences(storage).setSort('company')
    expect(createUiPreferences(storage).getSort()).toBe('company')
  })

  it('ignores stored junk', () => {
    for (const raw of ['', 'not json', '[]', '{"sort":"newest"}', '{"sort":3}', 'null']) {
      const storage = createMemoryStorage()
      storage.write(UI_PREFERENCES_KEY, raw)
      expect(createUiPreferences(storage).getSort()).toBeNull()
    }
  })

  it('forgets the sort when cleared', () => {
    const storage = createMemoryStorage()
    const prefs = createUiPreferences(storage)
    prefs.setSort('added_asc')
    prefs.clear()
    expect(prefs.getSort()).toBeNull()
    expect(storage.read(UI_PREFERENCES_KEY)).toBeNull()
  })

  it('keeps the choice in memory when storage is blocked, and never throws', () => {
    const prefs = createUiPreferences(blocked())
    expect(prefs.getSort()).toBeNull()
    prefs.setSort('applied_asc')
    expect(prefs.getSort()).toBe('applied_asc')
    prefs.clear()
    expect(prefs.getSort()).toBeNull()
  })

  it('has no bookmark version until a bookmark is used', () => {
    expect(createUiPreferences(createMemoryStorage()).getLastBookmarkVersion()).toBeNull()
  })

  it('remembers the bookmark version, also in a new instance on the same storage', () => {
    const storage = createMemoryStorage()
    createUiPreferences(storage).setLastBookmarkVersion(2)
    expect(createUiPreferences(storage).getLastBookmarkVersion()).toBe(2)
  })

  it('replaces the bookmark version with the latest one used, lower or higher', () => {
    const prefs = createUiPreferences(createMemoryStorage())
    prefs.setLastBookmarkVersion(2)
    prefs.setLastBookmarkVersion(1)
    expect(prefs.getLastBookmarkVersion()).toBe(1)
    prefs.setLastBookmarkVersion(3)
    expect(prefs.getLastBookmarkVersion()).toBe(3)
  })

  it('keeps the sort when the bookmark version is set, and the bookmark version when the sort is set', () => {
    const storage = createMemoryStorage()
    const prefs = createUiPreferences(storage)
    prefs.setSort('company')
    prefs.setLastBookmarkVersion(2)
    expect(prefs.getSort()).toBe('company')
    prefs.setSort('added_asc')
    expect(prefs.getLastBookmarkVersion()).toBe(2)
    const again = createUiPreferences(storage)
    expect(again.getSort()).toBe('added_asc')
    expect(again.getLastBookmarkVersion()).toBe(2)
  })

  it('ignores a stored bookmark version that is not a version, and keeps a good sort next to it', () => {
    for (const value of ['2', 0, -1, 1.5, 10000, null, [], {}, true, 'x']) {
      const storage = createMemoryStorage()
      storage.write(UI_PREFERENCES_KEY, JSON.stringify({ sort: 'company', lastBookmarkVersion: value }))
      const prefs = createUiPreferences(storage)
      expect(prefs.getLastBookmarkVersion()).toBeNull()
      expect(prefs.getSort()).toBe('company')
    }
  })

  it('does not store a bookmark version that is not a version', () => {
    const prefs = createUiPreferences(createMemoryStorage())
    for (const value of [0, -3, 2.5, 10000, Number.NaN, Infinity]) prefs.setLastBookmarkVersion(value)
    expect(prefs.getLastBookmarkVersion()).toBeNull()
  })

  it('repairs a corrupt stored value the next time something is set', () => {
    const storage = createMemoryStorage()
    storage.write(UI_PREFERENCES_KEY, 'not json')
    const prefs = createUiPreferences(storage)
    prefs.setLastBookmarkVersion(2)
    expect(prefs.getLastBookmarkVersion()).toBe(2)
    expect(prefs.getSort()).toBeNull()
  })

  it('forgets the bookmark version when cleared', () => {
    const storage = createMemoryStorage()
    const prefs = createUiPreferences(storage)
    prefs.setLastBookmarkVersion(1)
    prefs.clear()
    expect(prefs.getLastBookmarkVersion()).toBeNull()
    expect(storage.read(UI_PREFERENCES_KEY)).toBeNull()
  })

  it('keeps both choices in memory when storage is blocked, and never throws', () => {
    const prefs = createUiPreferences(blocked())
    prefs.setSort('company')
    prefs.setLastBookmarkVersion(1)
    expect(prefs.getLastBookmarkVersion()).toBe(1)
    expect(prefs.getSort()).toBe('company')
    prefs.clear()
    expect(prefs.getLastBookmarkVersion()).toBeNull()
  })
})
