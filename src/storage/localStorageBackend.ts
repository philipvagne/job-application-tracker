import type { Storage, StorageLike } from './types'

/**
 * Wraps a Web Storage-like object. The caller passes `window.localStorage`
 * (or a fake in tests); nothing here touches the DOM.
 */
export function createLocalStorage(backend: StorageLike): Storage {
  return {
    read: (key) => backend.getItem(key),
    write: (key, value) => {
      backend.setItem(key, value)
    },
    remove: (key) => {
      backend.removeItem(key)
    },
  }
}
