/** The lowest and highest bookmark version that counts as a version number. */
const MIN_BOOKMARK_VERSION = 1
const MAX_BOOKMARK_VERSION = 9999

/**
 * A bookmark version from the address (`bv`, text) or from storage (a number): a whole number
 * from 1 to 9999. Anything else is null.
 */
export function readBookmarkVersion(value: unknown): number | null {
  const number = typeof value === 'string' ? (/^\d{1,4}$/.test(value) ? Number(value) : Number.NaN) : value
  if (typeof number !== 'number' || !Number.isInteger(number)) return null
  return number >= MIN_BOOKMARK_VERSION && number <= MAX_BOOKMARK_VERSION ? number : null
}

/** The version an add payload came from: its `bv`, or 1 (the first bookmark) when it has none or an unusable one. */
export function bookmarkVersionOfPayload(raw: string | null): number {
  return readBookmarkVersion(raw) ?? MIN_BOOKMARK_VERSION
}

/**
 * True when the last bookmark that was used is older than `current`. Nothing known (null, for
 * someone who has not used a bookmark yet) is not outdated, so a first-time user is never warned.
 */
export function isOutdatedBookmarkVersion(version: number | null, current: number): boolean {
  return version !== null && version < current
}
