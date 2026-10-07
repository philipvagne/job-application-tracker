import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../domain'
import { createBrowserStorage } from './browserStorage'
import { createStateStore } from './state'

describe('createBrowserStorage', () => {
  it('passes reads and writes to the backend', () => {
    const data = new Map<string, string>()
    const storage = createBrowserStorage(() => ({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }))
    storage.write('k', 'v')
    expect(storage.read('k')).toBe('v')
    storage.remove('k')
    expect(storage.read('k')).toBeNull()
  })

  it('lets the state store fall back to memory when the backend cannot be reached', () => {
    const store = createStateStore(
      createBrowserStorage(() => {
        throw new Error('SecurityError')
      }),
    )
    expect(store.loadState()).toEqual({
      state: createEmptyState(),
      recovered: false,
      backedUp: false,
      persistent: false,
    })
  })
})
