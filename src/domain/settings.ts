import { MAX_REMINDER_DAYS, MIN_REMINDER_DAYS } from './exportImport'
import { DEFAULT_SETTINGS } from './backup'
import type { AppState, Language } from './types'

export function setLanguage(state: AppState, language: Language): AppState {
  return { ...state, settings: { ...state.settings, language } }
}

/** Reads a whole number from user-typed text. Returns null for anything else or out of range. */
export function parseReminderDays(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d{1,4}$/.test(trimmed)) return null
  const days = Number(trimmed)
  return days >= MIN_REMINDER_DAYS && days <= MAX_REMINDER_DAYS ? days : null
}

/** Keeps the state unchanged if `days` is not a whole number within range. */
export function setReminderDays(state: AppState, days: number): AppState {
  if (!Number.isInteger(days) || days < MIN_REMINDER_DAYS || days > MAX_REMINDER_DAYS) return state
  return { ...state, settings: { ...state.settings, reminderDays: days } }
}

/** What is left after "delete all my data": defaults, but the interface language stays. */
export function resetState(state: AppState): AppState {
  return {
    applications: [],
    cvs: [],
    settings: { ...DEFAULT_SETTINGS, language: state.settings.language },
  }
}
