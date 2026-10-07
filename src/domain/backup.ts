import type { AppState, IsoDate, Settings } from './types'

const DAY_MS = 86_400_000

export const BACKUP_INTERVAL_DAYS = 14

export const DEFAULT_SETTINGS: Settings = { reminderDays: 14, language: 'en' }

export function createEmptyState(): AppState {
  return { applications: [], cvs: [], settings: { ...DEFAULT_SETTINGS } }
}

/**
 * A backup is due when there is at least one application and either the user has
 * never exported, or Math.floor((now - lastExportAt) / 86400000) >= 14.
 * Unparseable dates count as due, so a damaged value never silences the reminder.
 */
export function isBackupDue(state: AppState, now: IsoDate): boolean {
  if (state.applications.length === 0) return false
  const last = state.settings.lastExportAt
  if (last === undefined) return true
  const nowMs = Date.parse(now)
  const lastMs = Date.parse(last)
  if (Number.isNaN(nowMs) || Number.isNaN(lastMs)) return true
  return Math.floor((nowMs - lastMs) / DAY_MS) >= BACKUP_INTERVAL_DAYS
}
