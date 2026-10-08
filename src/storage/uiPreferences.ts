import { isSortKey, type SortKey } from '../domain'
import { createMemoryStorage } from './memoryStorage'
import type { Storage } from './types'

export const UI_PREFERENCES_KEY = 'jobtracker:v1:ui'

/**
 * Small view choices that are not user data: not exported, not imported, not part of the backup.
 * If the browser refuses to store them they are kept in memory until the page is closed.
 */
export interface UiPreferences {
  /** The sort the user chose, or null if they never did (or what is stored is not a known sort). */
  getSort(): SortKey | null
  setSort(sort: SortKey): void
  /** Forgets everything (used by "delete all my data"). Never throws. */
  clear(): void
}

export function createUiPreferences(primary: Storage): UiPreferences {
  const memory = createMemoryStorage()

  function read(): string | null {
    try {
      return primary.read(UI_PREFERENCES_KEY)
    } catch {
      return memory.read(UI_PREFERENCES_KEY)
    }
  }

  return {
    getSort() {
      const raw = read()
      if (raw === null) return null
      try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null || !('sort' in parsed)) return null
        return isSortKey(parsed.sort) ? parsed.sort : null
      } catch {
        return null
      }
    },
    setSort(sort) {
      const text = JSON.stringify({ sort })
      try {
        primary.write(UI_PREFERENCES_KEY, text)
      } catch {
        memory.write(UI_PREFERENCES_KEY, text)
      }
    },
    clear() {
      memory.remove(UI_PREFERENCES_KEY)
      try {
        primary.remove(UI_PREFERENCES_KEY)
      } catch {
        // Nothing more to do: the stored choice only affects the order of the list.
      }
    },
  }
}
