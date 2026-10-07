import type { Language } from '../domain'

/** Swedish if the browser language starts with "sv" (sv, sv-SE, sv-FI), otherwise English. */
export function detectLanguage(navigatorLanguage: string | undefined): Language {
  return navigatorLanguage?.trim().toLowerCase().startsWith('sv') === true ? 'sv' : 'en'
}

/** A date in the user's language, e.g. "7 okt. 2026". Falls back to the raw text if it is not a date. */
export function formatDate(iso: string, language: Language): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date)
}
