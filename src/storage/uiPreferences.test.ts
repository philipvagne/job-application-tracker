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
})
