import { describe, expect, it } from 'vitest'
import { getReminders } from './reminders'
import type { Application } from './types'

const NOW = '2026-10-15T12:00:00.000Z'

function app(id: string, overrides: Partial<Application> = {}): Application {
  return {
    id,
    company: 'Acme',
    role: 'Dev',
    url: '',
    status: 'applied',
    cvId: 'cv1',
    createdAt: '2026-09-01T00:00:00.000Z',
    appliedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('getReminders', () => {
  it('returns an empty list for no applications', () => {
    expect(getReminders([], NOW, 14)).toEqual([])
  })

  it('includes an application exactly reminderDays old', () => {
    expect(getReminders([app('a')], NOW, 14).map((a) => a.id)).toEqual(['a'])
  })

  it('excludes an application one millisecond short of the boundary', () => {
    const almost = app('a', { appliedAt: '2026-10-01T12:00:00.001Z' })
    expect(getReminders([almost], NOW, 14)).toEqual([])
  })

  it('includes older applications and excludes newer ones', () => {
    const list = [app('old', { appliedAt: '2026-09-01T00:00:00.000Z' }), app('new', { appliedAt: '2026-10-10T00:00:00.000Z' })]
    expect(getReminders(list, NOW, 14).map((a) => a.id)).toEqual(['old'])
  })

  it('uses the reminderDays setting', () => {
    const a = app('a', { appliedAt: '2026-10-08T12:00:00.000Z' })
    expect(getReminders([a], NOW, 7)).toHaveLength(1)
    expect(getReminders([a], NOW, 8)).toHaveLength(0)
  })

  it('skips applications that have a reply', () => {
    expect(getReminders([app('a', { repliedAt: '2026-10-05T00:00:00.000Z' })], NOW, 14)).toEqual([])
  })

  it('only considers status applied', () => {
    const others = (['to_apply', 'interview', 'offer', 'closed'] as const).map((s) => app(s, { status: s }))
    expect(getReminders(others, NOW, 14)).toEqual([])
  })

  it('skips applied applications without appliedAt or with a broken date', () => {
    const list = [app('none', { appliedAt: undefined }), app('bad', { appliedAt: 'not a date' })]
    expect(getReminders(list, NOW, 14)).toEqual([])
  })

  it('sorts the oldest first', () => {
    const list = [app('b', { appliedAt: '2026-09-20T00:00:00.000Z' }), app('a', { appliedAt: '2026-09-10T00:00:00.000Z' })]
    expect(getReminders(list, NOW, 14).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('returns nothing for an invalid now or reminderDays', () => {
    expect(getReminders([app('a')], 'nope', 14)).toEqual([])
    expect(getReminders([app('a')], NOW, Number.NaN)).toEqual([])
  })

  it('does not include applications from the future', () => {
    expect(getReminders([app('a', { appliedAt: '2026-11-01T00:00:00.000Z' })], NOW, 14)).toEqual([])
  })
})
