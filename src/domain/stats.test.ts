import { describe, expect, it } from 'vitest'
import { applicationsThisWeek, replyStatsByCv } from './stats'
import type { Application, Cv } from './types'

function app(id: string, overrides: Partial<Application> = {}): Application {
  return {
    id,
    company: 'Acme',
    role: 'Dev',
    url: '',
    status: 'applied',
    cvId: 'cv1',
    createdAt: '2026-09-01T00:00:00.000Z',
    appliedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  }
}

const cvs: Cv[] = [
  { id: 'cv1', name: 'Short' },
  { id: 'cv2', name: 'Long' },
]

describe('replyStatsByCv', () => {
  it('returns zero rows for CVs with no applications', () => {
    expect(replyStatsByCv([], cvs)).toEqual([
      { cvId: 'cv1', name: 'Short', applied: 0, replied: 0, interviews: 0 },
      { cvId: 'cv2', name: 'Long', applied: 0, replied: 0, interviews: 0 },
    ])
  })

  it('returns an empty list for no CVs', () => {
    expect(replyStatsByCv([app('a')], [])).toEqual([])
  })

  it('counts applied, replied and interviews per CV', () => {
    const list = [
      app('1'),
      app('2', { repliedAt: '2026-09-05T00:00:00.000Z' }),
      app('3', { status: 'interview', repliedAt: '2026-09-05T00:00:00.000Z', interviewAt: '2026-09-05T00:00:00.000Z' }),
      app('4', {
        cvId: 'cv2',
        status: 'offer',
        repliedAt: '2026-09-05T00:00:00.000Z',
        interviewAt: '2026-09-05T00:00:00.000Z',
        offerAt: '2026-09-09T00:00:00.000Z',
      }),
      app('5', { cvId: 'cv2' }),
    ]
    expect(replyStatsByCv(list, cvs)).toEqual([
      { cvId: 'cv1', name: 'Short', applied: 3, replied: 2, interviews: 1 },
      { cvId: 'cv2', name: 'Long', applied: 2, replied: 1, interviews: 1 },
    ])
  })

  it('counts interviews by interviewAt, not by current status', () => {
    const at = '2026-09-05T00:00:00.000Z'
    const list = [
      app('closed after interview', { status: 'closed', closedReason: 'declined', repliedAt: at, interviewAt: at }),
      app('stepped back', { status: 'applied', repliedAt: at, interviewAt: at }),
      app('status only', { status: 'interview' }),
    ]
    expect(replyStatsByCv(list, cvs)[0]).toEqual({ cvId: 'cv1', name: 'Short', applied: 3, replied: 2, interviews: 2 })
  })

  it('does not count interviewAt on an application that is back at to_apply', () => {
    const list = [app('1', { status: 'to_apply', appliedAt: undefined, interviewAt: '2026-09-05T00:00:00.000Z' })]
    expect(replyStatsByCv(list, cvs)[0]?.interviews).toBe(0)
  })

  it('ignores applications that were never applied and unknown CVs', () => {
    const list = [app('1', { status: 'to_apply', appliedAt: undefined }), app('2', { cvId: 'gone' })]
    expect(replyStatsByCv(list, cvs).map((r) => r.applied)).toEqual([0, 0])
  })

  it('counts applied applications without a CV as their own last group', () => {
    const { cvId: _removed, ...noCv } = app('x')
    const { appliedAt: _applied, ...rest } = noCv
    const toApply: Application = { ...rest, status: 'to_apply' }
    const replied = { ...noCv, id: 'z', repliedAt: '2026-09-05T00:00:00.000Z', interviewAt: '2026-09-06T00:00:00.000Z' }
    expect(replyStatsByCv([noCv, replied, toApply, app('y')], cvs)).toEqual([
      { cvId: 'cv1', name: 'Short', applied: 1, replied: 0, interviews: 0 },
      { cvId: 'cv2', name: 'Long', applied: 0, replied: 0, interviews: 0 },
      { cvId: null, name: '', applied: 2, replied: 1, interviews: 1 },
    ])
  })

  it('has no group without a CV when every application has one, or only to-apply ones lack it', () => {
    const { cvId: _removed, appliedAt: _applied, ...rest } = app('x')
    const toApply: Application = { ...rest, status: 'to_apply' }
    expect(replyStatsByCv([app('a'), toApply], cvs).map((r) => r.cvId)).toEqual(['cv1', 'cv2'])
  })

  it('shows the no-CV group even when there are no CVs at all', () => {
    const { cvId: _removed, ...noCv } = app('x')
    expect(replyStatsByCv([noCv], [])).toEqual([{ cvId: null, name: '', applied: 1, replied: 0, interviews: 0 }])
  })

  it('counts closed applications that were applied', () => {
    const list = [app('1', { status: 'closed', closedReason: 'no_reply' })]
    expect(replyStatsByCv(list, cvs)[0]?.applied).toBe(1)
  })
})

describe('applicationsThisWeek', () => {
  // Europe/Stockholm: UTC+2 until 2026-10-25, UTC+1 after.
  // Wednesday 2026-10-07; the week is Mon 2026-10-05 00:00 to Mon 2026-10-12 00:00 local.
  const NOW = '2026-10-07T10:00:00.000Z'

  it('runs in the Stockholm zone', () => {
    expect(new Date(NOW).getTimezoneOffset()).toBe(-120)
  })

  it('returns 0 for an empty list', () => {
    expect(applicationsThisWeek([], NOW)).toBe(0)
  })

  it('counts applications from this week only', () => {
    const list = [
      app('in', { appliedAt: '2026-10-06T08:00:00.000Z' }),
      app('out', { appliedAt: '2026-09-28T08:00:00.000Z' }),
      app('todo', { status: 'to_apply', appliedAt: undefined }),
    ]
    expect(applicationsThisWeek(list, NOW)).toBe(1)
  })

  it('includes Monday 00:00 local time and excludes one millisecond before', () => {
    const start = app('start', { appliedAt: '2026-10-04T22:00:00.000Z' })
    const before = app('before', { appliedAt: '2026-10-04T21:59:59.999Z' })
    expect(applicationsThisWeek([start, before], NOW)).toBe(1)
  })

  it('includes Sunday 23:59 local time and excludes the next Monday 00:00', () => {
    const sunday = app('sun', { appliedAt: '2026-10-11T21:59:59.999Z' })
    const monday = app('mon', { appliedAt: '2026-10-11T22:00:00.000Z' })
    expect(applicationsThisWeek([sunday, monday], NOW)).toBe(1)
  })

  it('treats Sunday as the last day of the week', () => {
    const sundayNow = '2026-10-11T12:00:00.000Z'
    const list = [app('mon', { appliedAt: '2026-10-05T08:00:00.000Z' }), app('prev', { appliedAt: '2026-10-04T08:00:00.000Z' })]
    expect(applicationsThisWeek(list, sundayNow)).toBe(1)
  })

  it('handles the week when daylight saving ends', () => {
    // Sunday 2026-10-25 03:00 -> 02:00. Week of Mon 2026-10-19 to Mon 2026-10-26 00:00 (UTC+1).
    const now = '2026-10-22T10:00:00.000Z'
    const sunday = app('sun', { appliedAt: '2026-10-25T22:59:59.999Z' })
    const monday = app('mon', { appliedAt: '2026-10-25T23:00:00.000Z' })
    expect(applicationsThisWeek([sunday, monday], now)).toBe(1)
  })

  it('returns 0 for an invalid now', () => {
    expect(applicationsThisWeek([app('a')], 'nope')).toBe(0)
  })
})
