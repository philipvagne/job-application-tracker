import { isSortKey, readBookmarkVersion, type SortKey } from '../domain'
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
  /** The version of the bookmark last used to add a job, or null if none was (or what is stored is not a version). */
  getLastBookmarkVersion(): number | null
  /** Remembers the version of the bookmark just used. A value that is not a version is ignored. */
  setLastBookmarkVersion(version: number): void
  /** Forgets everything (used by "delete all my data"). Never throws. */
  clear(): void
}

/** Everything stored under the key. A value that is missing or not usable is null. */
interface StoredPreferences {
  sort: SortKey | null
  lastBookmarkVersion: number | null
}

function parse(raw: string | null): StoredPreferences {
  const empty: StoredPreferences = { sort: null, lastBookmarkVersion: null }
  if (raw === null) return empty
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty
    return {
      sort: 'sort' in parsed && isSortKey(parsed.sort) ? parsed.sort : null,
      lastBookmarkVersion: 'lastBookmarkVersion' in parsed && typeof parsed.lastBookmarkVersion === 'number' ? readBookmarkVersion(parsed.lastBookmarkVersion) : null,
    }
  } catch {
    return empty
  }
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

  /** Changes one value and keeps the others, which are read again so nothing stored is lost. */
  function update(change: Partial<StoredPreferences>): void {
    const next = { ...parse(read()), ...change }
    const text = JSON.stringify({
      ...(next.sort !== null && { sort: next.sort }),
      ...(next.lastBookmarkVersion !== null && { lastBookmarkVersion: next.lastBookmarkVersion }),
    })
    try {
      primary.write(UI_PREFERENCES_KEY, text)
    } catch {
      memory.write(UI_PREFERENCES_KEY, text)
    }
  }

  return {
    getSort() {
      return parse(read()).sort
    },
    setSort(sort) {
      update({ sort })
    },
    getLastBookmarkVersion() {
      return parse(read()).lastBookmarkVersion
    },
    setLastBookmarkVersion(version) {
      const valid = readBookmarkVersion(version)
      if (valid !== null) update({ lastBookmarkVersion: valid })
    },
    clear() {
      memory.remove(UI_PREFERENCES_KEY)
      try {
        primary.remove(UI_PREFERENCES_KEY)
      } catch {
        // Nothing more to do: the stored choices only affect the order of the list and a hint about the bookmark.
      }
    },
  }
}
