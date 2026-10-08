import type { Application } from './types'
import { hostOf } from './url'

const MAX_HINT_LENGTH = 60
const MAX_ID_HINT_LENGTH = 20

/**
 * The parts of a row's visible title. `company` is null when there is none (the row then says
 * the company is missing); `host` is the website name from the link (no "www."), or null when
 * there is no usable http(s) link. Never fetches anything; the link is only read as text.
 */
export function titleParts(application: Pick<Application, 'company' | 'url'>): {
  company: string | null
  host: string | null
} {
  const company = application.company.trim()
  return { company: company === '' ? null : company, host: hostOf(application.url.trim()) }
}

/**
 * What a row is called in button names, messages and dialogs, not in its visible title: the
 * company; else the website name from the link followed by the role, if there is one, so rows
 * from the same site can be told apart ("arbetsformedlingen.se · Frontendutvecklare"); else the
 * link as written.
 */
export function applicationTitle(application: Pick<Application, 'company' | 'url'> & { role?: string }): string {
  const { company, host } = titleParts(application)
  if (company !== null) return company
  const name = host ?? application.url.trim()
  const role = application.role?.trim() ?? ''
  return role === '' ? name : `${name} · ${role}`
}

/**
 * The name of a row for screen readers (button and link names, announcements). Like
 * `applicationTitle`, but a row with no company and no role also gets the hint from the link's
 * path, which is never shown as visible text.
 */
export function accessibleTitle(application: Pick<Application, 'company' | 'url'> & { role?: string }): string {
  const { company, host } = titleParts(application)
  const role = application.role?.trim() ?? ''
  if (company !== null || role !== '') return applicationTitle(application)
  const hint = linkHint(application.url)
  const name = host ?? application.url.trim()
  return hint === null ? name : `${name} · ${hint}`
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
