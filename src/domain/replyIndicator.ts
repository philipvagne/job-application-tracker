import { needsFollowUp } from './reminders'
import type { Application, IsoDate } from './types'

export type ReplyIndicator = 'none' | 'no_reply_yet' | 'replied' | 'follow_up'

/**
 * What the row says about a reply, from existing data only:
 * - replied: the application has repliedAt (set by "Got a reply" or by reaching interview or offer)
 * - follow_up: status applied, no repliedAt, and the reminder rule says it is time
 * - no_reply_yet: status applied, no repliedAt, not yet time
 * - none: to apply and closed applications, and interview or offer without repliedAt
 */
export function replyIndicator(application: Application, now: IsoDate, reminderDays: number): ReplyIndicator {
  if (application.status === 'to_apply' || application.status === 'closed') return 'none'
  if (application.repliedAt !== undefined) return 'replied'
  if (application.status !== 'applied') return 'none'
  return needsFollowUp(application, now, reminderDays) ? 'follow_up' : 'no_reply_yet'
}
