/** The version written by exportData. */
export const EXPORT_VERSION = 2

/** Versions importData can read; older ones are upgraded in memory first. */
export const READABLE_VERSIONS: readonly number[] = [1, 2]

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
 */
export function migrateToLatest(input: unknown): unknown {
  if (!isRecord(input) || input['version'] !== 1) return input
  return { ...input, version: EXPORT_VERSION }
}
