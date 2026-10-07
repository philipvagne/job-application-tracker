import type { Application, IsoDate } from './types'

const DAY_MS = 86_400_000

/**
 * "No reply after N days" means: the application has status applied, has no
 * repliedAt, and Math.floor((now - appliedAt) / 86400000) >= reminderDays.
 * So an application applied exactly reminderDays x 24 hours ago is included,
 * and one that is a millisecond short of that is not.
 * Oldest applications come first. Unparseable dates are skipped.
 */
export function getReminders(
  applications: readonly Application[],
  now: IsoDate,
  reminderDays: number,
): Application[] {
  const nowMs = Date.parse(now)
  if (Number.isNaN(nowMs) || Number.isNaN(reminderDays)) return []

  return applications
    .filter((a) => {
      if (a.status !== 'applied' || a.appliedAt === undefined || a.repliedAt !== undefined) {
        return false
      }
      const appliedMs = Date.parse(a.appliedAt)
      if (Number.isNaN(appliedMs)) return false
      return Math.floor((nowMs - appliedMs) / DAY_MS) >= reminderDays
    })
    .sort((a, b) => Date.parse(a.appliedAt ?? '') - Date.parse(b.appliedAt ?? ''))
}
