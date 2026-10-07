import { describe, expect, it } from 'vitest'
import { createEmptyState, exportData, type AppState } from '../domain'
import { createLocalStorage } from './localStorageBackend'
import { CORRUPT_BACKUP_KEY, STATE_KEY, createStateStore } from './state'
import type { StorageLike } from './types'

const sample: AppState = {
  cvs: [{ id: 'cv1', name: 'Short' }],
  settings: { reminderDays: 7, language: 'sv', lastExportAt: '2026-10-01T10:00:00.000Z' },
  applications: [
    {
      id: 'a1',
      company: 'Åkerlund & Söner <b>',
      role: 'Dev',
      url: 'https://example.com/1',
      status: 'applied',
      cvId: 'cv1',
      createdAt: '2026-10-01T08:00:00.000Z',
      appliedAt: '2026-10-02T08:00:00.000Z',
      notes: 'rad 1\nrad 2',
    },
  ],
}

class FakeStorage implements StorageLike {
  data = new Map<string, string>()
  failGet: Error | null = null
  failSet: Error | null = null
  failSetKeys: string[] | null = null
  failRemove: Error | null = null
  getItem(key: string): string | null {
    if (this.failGet) throw this.failGet
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failSet && (this.failSetKeys === null || this.failSetKeys.includes(key))) throw this.failSet
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    if (this.failRemove) throw this.failRemove
    this.data.delete(key)
  }
}

function named(name: string): Error {
  const e = new Error(name)
  e.name = name
  return e
}

function setup(): { fake: FakeStorage; store: ReturnType<typeof createStateStore> } {
  const fake = new FakeStorage()
  return { fake, store: createStateStore(createLocalStorage(fake)) }
}

describe('loadState / saveState', () => {
  it('starts empty and persistent when nothing is stored', () => {
    const { store } = setup()
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: false,
      backedUp: false,
      persistent: true,
    })
  })

  it('round-trips, also through a fresh store on the same storage', () => {
    const { fake, store } = setup()
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: true })
    const reopened = createStateStore(createLocalStorage(fake)).loadState()
    expect(reopened).toEqual({ state: sample, recovered: false, backedUp: false, persistent: true })
  })

  it('stores the export format under one versioned key', () => {
    const { fake, store } = setup()
    store.saveState(sample)
    expect(JSON.parse(fake.data.get(STATE_KEY) ?? '')).toEqual(exportData(sample))
    expect(STATE_KEY).toContain('v1')
  })
})

describe('corrupt data recovery', () => {
  const cases: Array<[string, string]> = [
    ['malformed JSON', '{"version":1,'],
    ['not an object', '[1,2,3]'],
    ['unsupported version', JSON.stringify({ ...exportData(sample), version: 99 })],
    ['invalid content', JSON.stringify({ ...exportData(sample), cvs: 'nope' })],
  ]

  it.each(cases)('%s: keeps a raw copy, starts empty, flags recovered', (_name, raw) => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, raw)
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: true,
      backedUp: true,
      persistent: true,
    })
    expect(fake.data.get(CORRUPT_BACKUP_KEY)).toBe(raw)
    expect(store.getCorruptBackup()).toBe(raw)
    // Loading alone never touches the original.
    expect(fake.data.get(STATE_KEY)).toBe(raw)
  })

  it('a second, different corrupt load keeps the old copy and protects the new data', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'first-bad')
    store.loadState()
    fake.data.set(STATE_KEY, 'second-bad')
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: true,
      backedUp: false,
      persistent: false,
    })
    expect(store.getCorruptBackup()).toBe('first-bad')
    // Saving goes to memory; neither the new bad data nor the old copy is touched.
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: false })
    expect(fake.data.get(STATE_KEY)).toBe('second-bad')
    expect(fake.data.get(CORRUPT_BACKUP_KEY)).toBe('first-bad')
  })

  it('identical corrupt data on a later load counts as backed up', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    store.loadState()
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: true,
      backedUp: true,
      persistent: true,
    })
  })

  it('after clearing the old copy, reloading backs up the new bad data', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'first-bad')
    store.loadState()
    fake.data.set(STATE_KEY, 'second-bad')
    store.loadState()
    store.clearCorruptBackup()
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: true,
      backedUp: true,
      persistent: true,
    })
    expect(store.getCorruptBackup()).toBe('second-bad')
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: true })
  })

  it('stays protected if the old copy cannot be removed', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'first-bad')
    store.loadState()
    fake.data.set(STATE_KEY, 'second-bad')
    store.loadState()
    fake.failRemove = named('SecurityError')
    store.clearCorruptBackup()
    fake.failRemove = null
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: false })
    expect(fake.data.get(STATE_KEY)).toBe('second-bad')
    expect(store.getCorruptBackup()).toBe('first-bad')
  })

  it('clearCorruptBackup removes the copy', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    store.loadState()
    store.clearCorruptBackup()
    expect(store.getCorruptBackup()).toBeNull()
  })

  it('when the copy cannot be written, reports backedUp false and refuses to overwrite the bad data', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    fake.failSet = named('QuotaExceededError')
    fake.failSetKeys = [CORRUPT_BACKUP_KEY]
    const loaded = store.loadState()
    expect(loaded).toEqual({ state: createEmptyState(), recovered: true, backedUp: false, persistent: false })

    expect(store.saveState(sample)).toEqual({ ok: true, persistent: false })
    expect(fake.data.get(STATE_KEY)).toBe('bad')
    // The session still works from memory.
    expect(store.loadState().state).toEqual(sample)
  })

  it('allows normal saving again after clearAllData in protected mode', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    fake.failSet = named('QuotaExceededError')
    fake.failSetKeys = [CORRUPT_BACKUP_KEY]
    store.loadState()
    fake.failSet = null
    expect(store.clearAllData()).toEqual({ ok: true })
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: true })
    expect(fake.data.has(STATE_KEY)).toBe(true)
  })
})

describe('hasSavedState', () => {
  it('is false before the first save and true after', () => {
    const { store } = setup()
    expect(store.hasSavedState()).toBe(false)
    store.saveState(sample)
    expect(store.hasSavedState()).toBe(true)
  })

  it('is false when storage throws', () => {
    const { fake, store } = setup()
    fake.failGet = named('SecurityError')
    expect(store.hasSavedState()).toBe(false)
  })
})

describe('unavailable storage', () => {
  it('falls back to memory with persistent false when reading throws', () => {
    const { fake, store } = setup()
    fake.failGet = named('SecurityError')
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: false,
      backedUp: false,
      persistent: false,
    })
    expect(store.saveState(sample)).toEqual({ ok: true, persistent: false })
    expect(fake.data.size).toBe(0)
    expect(store.loadState()).toEqual({ state: sample, recovered: false, backedUp: false, persistent: false })
  })

  it('returns null from getCorruptBackup when storage throws', () => {
    const { fake, store } = setup()
    fake.failGet = named('SecurityError')
    expect(store.getCorruptBackup()).toBeNull()
  })
})

describe('write errors', () => {
  it.each(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])('%s gives code quota', (name) => {
    const { fake, store } = setup()
    fake.failSet = named(name)
    expect(store.saveState(sample)).toEqual({ ok: false, code: 'quota' })
  })

  it('any other error gives code unknown', () => {
    const { fake, store } = setup()
    fake.failSet = named('SecurityError')
    expect(store.saveState(sample)).toEqual({ ok: false, code: 'unknown' })
    fake.failSet = null
    ;(fake as { setItem: unknown }).setItem = () => {
      throw 'a string, not an Error'
    }
    expect(store.saveState(sample)).toEqual({ ok: false, code: 'unknown' })
  })

  it('does not lose the previously saved data on a failed write', () => {
    const { fake, store } = setup()
    store.saveState(sample)
    fake.failSet = named('QuotaExceededError')
    store.saveState({ ...sample, cvs: [] })
    fake.failSet = null
    expect(store.loadState().state).toEqual(sample)
  })
})

describe('clearAllData', () => {
  it('removes the state and the corrupt copy', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    store.loadState()
    store.saveState(sample)
    expect(store.clearAllData()).toEqual({ ok: true })
    expect(fake.data.size).toBe(0)
    expect(store.loadState().state).toEqual(createEmptyState())
  })

  it('clears memory-only data too', () => {
    const { fake, store } = setup()
    fake.failGet = named('SecurityError')
    store.loadState()
    store.saveState(sample)
    fake.failRemove = named('SecurityError')
    store.clearAllData()
    expect(store.loadState().state).toEqual(createEmptyState())
  })

  it('reports failure instead of throwing', () => {
    const { fake, store } = setup()
    store.saveState(sample)
    fake.failRemove = named('SecurityError')
    expect(store.clearAllData()).toEqual({ ok: false, code: 'unknown' })
  })
})

describe('data saved by version 1 of the app', () => {
  it('loads without being treated as unreadable, and is saved as version 2 next time', () => {
    const backend = new FakeStorage()
    const v1 = { ...exportData(sample), version: 1 }
    backend.data.set(STATE_KEY, JSON.stringify(v1))
    const store = createStateStore(createLocalStorage(backend))
    const loaded = store.loadState()
    expect(loaded.recovered).toBe(false)
    expect(loaded.state).toEqual(sample)

    store.saveState(loaded.state)
    expect((JSON.parse(backend.data.get(STATE_KEY) ?? '{}') as { version: number }).version).toBe(2)
    expect(backend.data.has(CORRUPT_BACKUP_KEY)).toBe(false)
  })

  it('still backs up a file with a version it does not know', () => {
    const backend = new FakeStorage()
    backend.data.set(STATE_KEY, JSON.stringify({ ...exportData(sample), version: 3 }))
    const loaded = createStateStore(createLocalStorage(backend)).loadState()
    expect(loaded.recovered).toBe(true)
    expect(backend.data.has(CORRUPT_BACKUP_KEY)).toBe(true)
  })
})
