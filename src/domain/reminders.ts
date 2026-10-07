import { daysSince } from './dates'
import type { Application, IsoDate } from './types'

/**
 * "No reply after N days" means: the application has status applied, has no
 * repliedAt, and daysSince(appliedAt, now) >= reminderDays. Days are local calendar
 * days, the same count the application row shows, so an application sent late yesterday
 * is 1 day old this morning.
 * Oldest applications come first. Unparseable dates are skipped.
 */
export function getReminders(
  applications: readonly Application[],
  now: IsoDate,
  reminderDays: number,
): Application[] {
  if (Number.isNaN(Date.parse(now)) || Number.isNaN(reminderDays)) return []

  return applications
    .filter((a) => {
      if (a.status !== 'applied' || a.appliedAt === undefined || a.repliedAt !== undefined) {
        return false
      }
      const days = daysSince(a.appliedAt, now)
      return days !== null && days >= reminderDays
    })
    .sort((a, b) => Date.parse(a.appliedAt ?? '') - Date.parse(b.appliedAt ?? ''))
}
