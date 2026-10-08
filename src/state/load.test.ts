import { describe, expect, it } from 'vitest'
import { createEmptyState, type AppState } from '../domain'
import { CORRUPT_BACKUP_KEY, STATE_KEY, createLocalStorage, createStateStore, type StorageLike } from '../storage'
import { loadApp } from './load'

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function setup() {
  const fake = fakeStorage()
  return { fake, store: createStateStore(createLocalStorage(fake)) }
}

const saved: AppState = { applications: [], cvs: [], settings: { reminderDays: 21, language: 'en' } }

describe('loadApp', () => {
  it('first visit: picks Swedish for a Swedish browser', () => {
    const { store } = setup()
    const loaded = loadApp(store, { navigatorLanguages: ['sv-SE'] })
    expect(loaded.data).toEqual({ ...createEmptyState(), settings: { reminderDays: 14, language: 'sv' } })
    expect(loaded.status).toEqual({ persistent: true, recovered: false, backedUp: false, hasCorruptCopy: false })
  })

  it('first visit: picks English for any other browser', () => {
    const { store } = setup()
    expect(loadApp(store, { navigatorLanguages: ['de-DE'] }).data.settings.language).toBe('en')
  })

  it('afterwards uses the saved language, not the browser language', () => {
    const { store } = setup()
    store.saveState(saved)
    const loaded = loadApp(store, { navigatorLanguages: ['sv-SE'] })
    expect(loaded.data).toEqual(saved)
  })

  it('a deliberately chosen English with nothing else saved is still English', () => {
    const { store } = setup()
    store.saveState(createEmptyState())
    expect(loadApp(store, { navigatorLanguages: ['sv-SE'] }).data.settings.language).toBe('en')
  })

  it('a reload that finds nothing saved keeps the language on screen', () => {
    const { store } = setup()
    const loaded = loadApp(store, { navigatorLanguages: ['en-US'], currentLanguage: 'sv' })
    expect(loaded.data.settings.language).toBe('sv')
  })

  it('reports unreadable data with a kept copy', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad')
    const loaded = loadApp(store, { navigatorLanguages: ['sv'] })
    expect(loaded.status).toEqual({ persistent: true, recovered: true, backedUp: true, hasCorruptCopy: true })
    expect(loaded.data.applications).toEqual([])
    expect(loaded.data.settings.language).toBe('sv')
  })

  it('reports a second, different unreadable load as not backed up, with the older copy present', () => {
    const { fake, store } = setup()
    fake.data.set(STATE_KEY, 'bad-1')
    loadApp(store, { navigatorLanguages: ['en'] })
    fake.data.set(STATE_KEY, 'bad-2')
    const loaded = loadApp(store, { navigatorLanguages: ['en'] })
    expect(loaded.status).toEqual({ persistent: false, recovered: true, backedUp: false, hasCorruptCopy: true })
    expect(fake.data.get(CORRUPT_BACKUP_KEY)).toBe('bad-1')
  })
})
