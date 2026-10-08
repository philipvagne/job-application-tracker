import type { Application } from './types'
import { hostOf } from './url'

const MAX_HINT_LENGTH = 60
const MAX_ID_HINT_LENGTH = 20

/**
 * What a row is called: the company, else the website name from the link (no "www."), else the
 * link as written. Never fetches anything; the link is only read as text.
 */
export function applicationTitle(application: Pick<Application, 'company' | 'url'>): string {
  const company = application.company.trim()
  if (company !== '') return company
  const url = application.url.trim()
  return hostOf(url) ?? url
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function path(url: string): string[] {
  try {
    return new URL(url.trim()).pathname.split('/').filter((s) => s !== '')
  } catch {
    return []
  }
}

/**
 * A short readable hint from the link's path, as plain text, or null. It tells two jobs on the
 * same site apart, and only reads the last path segment (earlier ones are usually the same
 * for every job, like "jobs/view"). If the segment reads as words, those are the hint:
 * "frontend-developer" becomes "frontend developer", and a leading id and a file extension
 * are dropped. Otherwise a short segment such as a job number is used as it is. The query
 * string is ignored.
 */
export function linkHint(url: string): string | null {
  const last = path(url).map(decode).at(-1)
  if (last === undefined) return null
  const words = last
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/^\d+[-_]/, '')
    .replace(/[-_+]+/g, ' ')
    .trim()
  // Ids and hashes are not words: a long run of hex digits and dashes.
  if (/\p{L}{2}/u.test(words) && !/^[0-9a-f -]{16,}$/i.test(words)) {
    return words.length > MAX_HINT_LENGTH ? `${words.slice(0, MAX_HINT_LENGTH - 1)}…` : words
  }
  if (last.length <= MAX_ID_HINT_LENGTH && !/\s/.test(last)) return last
  return null
}
