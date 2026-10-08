import { needsFollowUp } from './reminders'
import type { Application, IsoDate } from './types'

export type ReplyIndicator = 'none' | 'no_reply_yet' | 'follow_up'

/**
 * What the row says about a reply, from existing data only. Only applied rows say anything:
 * - follow_up: no repliedAt, and the reminder rule says it is time
 * - no_reply_yet: no repliedAt, not yet time
 * - none: everything else, including an applied row with a repliedAt (an older backup, or a row
 *   stepped back from interview), and interview or offer rows
 */
export function replyIndicator(application: Application, now: IsoDate, reminderDays: number): ReplyIndicator {
  if (application.status !== 'applied' || application.repliedAt !== undefined) return 'none'
  return needsFollowUp(application, now, reminderDays) ? 'follow_up' : 'no_reply_yet'
}
