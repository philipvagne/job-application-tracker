import type { Language } from '../domain'

/**
 * Swedish if the browser's first language starts with "sv" (sv, sv-SE, sv-FI), otherwise English.
 * Only the first usable entry counts: someone who lists English first prefers English.
 */
export function detectLanguage(languages: readonly string[] | undefined): Language {
  const first = languages?.map((value) => value.trim()).find((value) => value !== '')
  return first?.toLowerCase().startsWith('sv') === true ? 'sv' : 'en'
}

/** The browser's languages in order of preference, from navigator.languages or else navigator.language. */
export function browserLanguages(nav: { languages?: readonly string[]; language?: string }): readonly string[] {
  if (nav.languages !== undefined && nav.languages.length > 0) return nav.languages
  return nav.language === undefined ? [] : [nav.language]
}

/** A date in the user's language, e.g. "7 okt. 2026". Falls back to the raw text if it is not a date. */
export function formatDate(iso: string, language: Language): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date)
}
