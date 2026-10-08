import type { Application, Language, Status } from './types'

/** How a tab's rows can be ordered. */
export const SORT_KEYS = ['added_desc', 'added_asc', 'applied_desc', 'applied_asc', 'company'] as const
export type SortKey = (typeof SORT_KEYS)[number]

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value)
}

/** The orders that make sense in a tab. Nothing has been applied yet in To apply, so no applied-date sorts there. */
export function sortOptionsFor(status: Status): readonly SortKey[] {
  return status === 'to_apply' ? ['added_desc', 'added_asc', 'company'] : SORT_KEYS
}

/** The order used when the user has not chosen one that fits the tab. */
export function defaultSortFor(status: Status): SortKey {
  return status === 'to_apply' ? 'added_desc' : 'applied_desc'
}

/**
 * The order to use in a tab: the saved choice if it fits the tab, else the tab's default.
 * The saved choice itself is never changed by this.
 */
export function effectiveSort(status: Status, saved: SortKey | null): SortKey {
  return saved !== null && sortOptionsFor(status).includes(saved) ? saved : defaultSortFor(status)
}

/** Whether to show the search and sort controls: the tab has a row, or a search is in progress. */
export function shouldShowListControls(totalInTab: number, query: string): boolean {
  return totalInTab > 0 || query !== ''
}

/** Lowercase, without accents ("Ö" becomes "o"), for comparing search text. */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function searchWords(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((word) => word !== '')
}

function haystack(a: Application): string {
  return normalizeSearchText([a.company, a.role, a.notes ?? '', a.url].join('\n'))
}

/** Every word of the query appears in the company, role, notes or link. An empty query matches all. */
export function matchesQuery(a: Application, query: string): boolean {
  const words = searchWords(query)
  if (words.length === 0) return true
  const text = haystack(a)
  return words.every((word) => text.includes(word))
}

function time(iso: string | undefined): number | null {
  if (iso === undefined) return null
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Orders by a date, newest or oldest first. Rows without a date go last. Equal dates keep their order. */
function byDate(pick: (a: Application) => string | undefined, direction: 1 | -1) {
  return (a: Application, b: Application): number => {
    const x = time(pick(a))
    const y = time(pick(b))
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return (x - y) * direction
  }
}

/**
 * Filters rows by a search and puts them in order. Pure: a new array, the input is untouched.
 * The sort is stable, so rows that compare equal keep the order they came in.
 * The company sort follows the language's alphabet (å ä ö after z in Swedish) and puts rows
 * without a company last.
 */
export function filterAndSortApplications(
  applications: readonly Application[],
  options: { query: string; sort: SortKey; language: Language },
): Application[] {
  const rows = applications.filter((a) => matchesQuery(a, options.query))
  switch (options.sort) {
    case 'added_desc':
      return rows.sort(byDate((a) => a.createdAt, -1))
    case 'added_asc':
      return rows.sort(byDate((a) => a.createdAt, 1))
    case 'applied_desc':
      return rows.sort(byDate((a) => a.appliedAt, -1))
    case 'applied_asc':
      return rows.sort(byDate((a) => a.appliedAt, 1))
    case 'company': {
      const collator = new Intl.Collator(options.language, { sensitivity: 'base' })
      return rows.sort((a, b) => {
        const x = a.company.trim()
        const y = b.company.trim()
        if (x === '' && y === '') return 0
        if (x === '') return 1
        if (y === '') return -1
        return collator.compare(x, y)
      })
    }
  }
}

/**
 * Where focus can go when a row leaves the list: the row after it, then the one before it, as
 * they are shown (filtered and sorted). Empty if the row is not in the list.
 */
export function neighbourApplications(shown: readonly Application[], id: string): Application[] {
  const i = shown.findIndex((a) => a.id === id)
  if (i === -1) return []
  return [shown[i + 1], shown[i - 1]].filter((a): a is Application => a !== undefined)
}
