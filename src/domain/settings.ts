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

/**
 * What the user has typed in the reminder field. `baseline` is the saved number the draft
 * belongs to: the number it saved itself, or the number that was saved when it was invalid.
 */
export interface ReminderDraft {
  text: string
  baseline: number
}

/** Starts or updates a draft from typed text, given the number saved before this edit. */
export function editReminderDraft(text: string, saved: number): ReminderDraft {
  return { text, baseline: parseReminderDays(text) ?? saved }
}

/** The text to show: the draft while the saved number is still the one it belongs to, else the saved number. */
export function reminderFieldText(draft: ReminderDraft | null, saved: number): string {
  return draft !== null && draft.baseline === saved ? draft.text : String(saved)
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
