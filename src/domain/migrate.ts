/** The version written by exportData. */
export const EXPORT_VERSION = 3

/** Versions importData can read; older ones are upgraded in memory first. */
export const READABLE_VERSIONS: readonly number[] = [1, 2, 3]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Brings a parsed file of an older version up to the current one. Returns the input
 * unchanged when it is not an object, has no readable version, or is already current;
 * importData then reports the problem.
 *
 * - 1 -> 2: nothing to rewrite. Version 2 only adds optional fields (CV file details,
 *   a CV's createdAt). A "toldThem" field in an old file is ignored by importData.
 *   Version 2 also gained an optional closedFrom on applications and the closed reasons
 *   not_selected and declined_offer, and an optional settings.showWeekSummary. None of these needed a
 *   version change.
 * - 2 -> 3: nothing to rewrite. Version 3 allows an empty company when the application has a
 *   link. Every version 1 or 2 file is also valid under that looser rule. The bump exists so
 *   that an older build refuses a version 3 file with a clear message instead of reading an
 *   empty company as damaged data.
 */
export function migrateToLatest(input: unknown): unknown {
  if (!isRecord(input)) return input
  const version = input['version']
  if (version !== 1 && version !== 2) return input
  return { ...input, version: EXPORT_VERSION }
}
