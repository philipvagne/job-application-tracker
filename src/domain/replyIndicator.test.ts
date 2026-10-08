import { describe, expect, it } from 'vitest'
import { daysSince } from './dates'
import { getReminders, needsFollowUp } from './reminders'
import { replyIndicator } from './replyIndicator'
import type { Application } from './types'

// Fixed zone in vitest.config: Europe/Stockholm. 12:00 UTC is 14:00 local.
const NOW = '2026-10-15T12:00:00.000Z'

function app(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a',
    company: 'Acme',
    role: '',
    url: '',
    status: 'applied',
    cvId: 'cv1',
    createdAt: '2026-09-01T00:00:00.000Z',
    appliedAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  }
}

describe('replyIndicator', () => {
  it('shows nothing for to_apply and closed applications', () => {
    expect(replyIndicator(app({ status: 'to_apply', appliedAt: undefined }), NOW, 7)).toBe('none')
    expect(replyIndicator(app({ status: 'closed', closedReason: 'no_reply' }), NOW, 1)).toBe('none')
    expect(replyIndicator(app({ status: 'closed', closedReason: 'no_reply', repliedAt: NOW }), NOW, 1)).toBe('none')
  })

  it('says no reply yet for a recent application without one', () => {
    expect(replyIndicator(app(), NOW, 7)).toBe('no_reply_yet')
  })

  it('says follow up once the reminder days are reached, exactly on the day', () => {
    expect(replyIndicator(app({ appliedAt: '2026-10-08T12:00:00.000Z' }), NOW, 7)).toBe('follow_up')
    expect(replyIndicator(app({ appliedAt: '2026-10-09T12:00:00.000Z' }), NOW, 7)).toBe('no_reply_yet')
  })

  it('shows nothing for an applied row that has a repliedAt (older backup, or stepped back from interview)', () => {
    const replied = app({ appliedAt: '2026-09-01T12:00:00.000Z', repliedAt: '2026-09-02T12:00:00.000Z' })
    expect(replyIndicator(replied, NOW, 7)).toBe('none')
  })

  it('shows nothing for interview or offer, with or without a repliedAt', () => {
    for (const status of ['interview', 'offer'] as const) {
      expect(replyIndicator(app({ status }), NOW, 7)).toBe('none')
      expect(replyIndicator(app({ status, repliedAt: '2026-10-11T08:00:00.000Z' }), NOW, 1)).toBe('none')
    }
  })

  it('treats an unreadable date as not due', () => {
    expect(replyIndicator(app({ appliedAt: 'nope' }), NOW, 7)).toBe('no_reply_yet')
    expect(replyIndicator(app({ appliedAt: undefined }), NOW, 7)).toBe('no_reply_yet')
  })
})

describe('the follow-up rule is the one the row and the reminders use', () => {
  it('matches daysSince for sample dates', () => {
    const pairs: [string, string][] = [
      ['2026-10-14T21:00:00.000Z', '2026-10-14T22:30:00.000Z'],
      ['2026-10-12T07:00:00.000Z', '2026-10-14T06:00:00.000Z'],
      ['2026-10-24T10:00:00.000Z', '2026-10-26T10:00:00.000Z'],
    ]
    for (const [appliedAt, now] of pairs) {
      const sent = app({ appliedAt })
      const days = daysSince(appliedAt, now) ?? Number.NaN
      expect(needsFollowUp(sent, now, days)).toBe(true)
      expect(needsFollowUp(sent, now, days + 1)).toBe(false)
      expect(replyIndicator(sent, now, days)).toBe('follow_up')
      expect(getReminders([sent], now, days)).toHaveLength(1)
    }
  })

  it('is what getReminders returns, so the two cannot drift apart', () => {
    const list = [
      app({ id: 'old', appliedAt: '2026-10-01T12:00:00.000Z' }),
      app({ id: 'new' }),
      app({ id: 'replied', appliedAt: '2026-10-01T12:00:00.000Z', repliedAt: '2026-10-02T12:00:00.000Z' }),
    ]
    const due = list.filter((a) => replyIndicator(a, NOW, 7) === 'follow_up').map((a) => a.id)
    expect(getReminders(list, NOW, 7).map((a) => a.id)).toEqual(due)
  })
})
