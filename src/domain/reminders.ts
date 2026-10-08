import { daysSince } from './dates'
import type { Application, IsoDate } from './types'

/**
 * "No reply after N days" means: the application has status applied, has no
 * repliedAt, and daysSince(appliedAt, now) >= reminderDays. Days are local calendar
 * days, the same count the application row shows, so an application sent late yesterday
 * is 1 day old this morning. Unparseable dates and a reminderDays that is not a number
 * never match.
 */
export function needsFollowUp(application: Application, now: IsoDate, reminderDays: number): boolean {
  if (Number.isNaN(reminderDays)) return false
  if (application.status !== 'applied' || application.appliedAt === undefined) return false
  if (application.repliedAt !== undefined) return false
  const days = daysSince(application.appliedAt, now)
  return days !== null && days >= reminderDays
}

/** The applications that need a follow-up, oldest first. */
export function getReminders(
  applications: readonly Application[],
  now: IsoDate,
  reminderDays: number,
): Application[] {
  if (Number.isNaN(Date.parse(now))) return []
  return applications
    .filter((a) => needsFollowUp(a, now, reminderDays))
    .sort((a, b) => Date.parse(a.appliedAt ?? '') - Date.parse(b.appliedAt ?? ''))
}
