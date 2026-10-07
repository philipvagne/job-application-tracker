import { createEmptyState, exportData, importData, type AppState } from '../domain'
import { createMemoryStorage } from './memoryStorage'
import type { ClearResult, SaveErrorCode, SaveResult, Storage } from './types'

export const STATE_KEY = 'jobtracker:v1:state'
export const CORRUPT_BACKUP_KEY = 'jobtracker:v1:corrupt-backup'

export interface LoadResult {
  state: AppState
  /** The stored data was unreadable or invalid and we started from an empty state. */
  recovered: boolean
  /**
   * Only meaningful when `recovered` is true: a raw copy of the bad data is held
   * under CORRUPT_BACKUP_KEY. False if writing the copy failed, or when nothing
   * was recovered.
   */
  backedUp: boolean
  /** False while data is only held in memory (storage unavailable). The UI should warn. */
  persistent: boolean
}

export interface StateStore {
  loadState(): LoadResult
  saveState(state: AppState): SaveResult
  /** The "delete all my data" button. Removes the state and any corrupt-data copy. */
  clearAllData(): ClearResult
  getCorruptBackup(): string | null
  clearCorruptBackup(): void
}

function isQuotaError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('name' in e)) return false
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
}

function errorCode(e: unknown): SaveErrorCode {
  return isQuotaError(e) ? 'quota' : 'unknown'
}

/**
 * The live state is stored under one key in the same shape as the export file
 * (see exportData / importData), so one validator covers both.
 *
 * NOTE: when EXPORT_VERSION changes, loadState needs a migration step that
 * upgrades older stored versions. Until then an unknown version is treated
 * as invalid data and backed up, not discarded.
 *
 * NOTE: two open tabs overwrite each other (last write wins). The UI pass will
 * listen for the `storage` event and handle it.
 */
export function createStateStore(primary: Storage): StateStore {
  const memory = createMemoryStorage()
  // 'unavailable': storage threw on load. 'protected': corrupt data is on disk
  // and could not be copied, so we must not write over it.
  let mode: 'primary' | 'unavailable' | 'protected' = 'primary'

  const active = (): Storage => (mode === 'primary' ? primary : memory)

  function backUpCorrupt(raw: string): boolean {
    try {
      // Keep the first copy: a later failure must not replace the original evidence.
      if (primary.read(CORRUPT_BACKUP_KEY) === null) primary.write(CORRUPT_BACKUP_KEY, raw)
      return true
    } catch {
      return false
    }
  }

  return {
    loadState() {
      let raw: string | null
      try {
        raw = active().read(STATE_KEY)
      } catch {
        mode = 'unavailable'
        return { state: createEmptyState(), recovered: false, backedUp: false, persistent: false }
      }
      if (raw === null) {
        return { state: createEmptyState(), recovered: false, backedUp: false, persistent: mode === 'primary' }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = undefined
      }
      const result = importData(parsed)
      if (result.ok) {
        return { state: result.state, recovered: false, backedUp: false, persistent: mode === 'primary' }
      }

      const backedUp = backUpCorrupt(raw)
      if (!backedUp) mode = 'protected'
      return { state: createEmptyState(), recovered: true, backedUp, persistent: mode === 'primary' }
    },

    saveState(state) {
      const text = JSON.stringify(exportData(state))
      try {
        active().write(STATE_KEY, text)
      } catch (e) {
        return { ok: false, code: errorCode(e) }
      }
      return { ok: true, persistent: mode === 'primary' }
    },

    clearAllData() {
      memory.remove(STATE_KEY)
      try {
        primary.remove(STATE_KEY)
        primary.remove(CORRUPT_BACKUP_KEY)
      } catch (e) {
        return { ok: false, code: errorCode(e) }
      }
      if (mode === 'protected') mode = 'primary'
      return { ok: true }
    },

    getCorruptBackup() {
      try {
        return primary.read(CORRUPT_BACKUP_KEY)
      } catch {
        return null
      }
    },

    clearCorruptBackup() {
      try {
        primary.remove(CORRUPT_BACKUP_KEY)
      } catch {
        // Nothing useful to do; the copy stays.
      }
    },
  }
}
