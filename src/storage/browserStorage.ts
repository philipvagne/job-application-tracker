import { createLocalStorage } from './localStorageBackend'
import type { Storage, StorageLike } from './types'

/**
 * The browser's localStorage as a Storage. Merely touching `window.localStorage`
 * can throw (blocked site data), so access is deferred to each call, where the
 * state store already catches failures and falls back to memory.
 */
export function createBrowserStorage(getBackend: () => StorageLike = () => window.localStorage): Storage {
  return createLocalStorage({
    getItem: (key) => getBackend().getItem(key),
    setItem: (key, value) => {
      getBackend().setItem(key, value)
    },
    removeItem: (key) => {
      getBackend().removeItem(key)
    },
  })
}
