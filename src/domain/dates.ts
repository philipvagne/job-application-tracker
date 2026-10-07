import type { IsoDate } from './types'

/**
 * Whole calendar days from `then` to `now` in the local time zone: 0 for the same day,
 * 1 for yesterday. Never negative. Null if either date cannot be read.
 */
export function daysSince(then: IsoDate, now: IsoDate): number | null {
  const a = new Date(then)
  const b = new Date(now)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.max(0, Math.round((dayB - dayA) / 86_400_000))
}
