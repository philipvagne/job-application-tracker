import { describe, expect, it } from 'vitest'
import { applicationsWithStatus, countsByStatus, defaultTab, nextTabIndex, tabAfterDataChange, TABS } from './tabs'
import { STATUSES, type Application, type Status } from './types'

function app(id: string, status: Status): Application {
  return { id, company: id, role: '', url: '', status, createdAt: '2026-10-01T08:00:00.000Z' }
}

describe('tabs', () => {
  it('are the five statuses in display order, closed last', () => {
    expect(TABS).toEqual(['to_apply', 'applied', 'interview', 'offer', 'closed'])
    expect(TABS).toEqual(STATUSES)
  })

  it('count each status, and the counts add up to the total', () => {
    const list = [app('a', 'to_apply'), app('b', 'applied'), app('c', 'applied'), app('d', 'interview'), app('e', 'closed')]
    const counts = countsByStatus(list)
    expect(counts).toEqual({ to_apply: 1, applied: 2, interview: 1, offer: 0, closed: 1 })
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(list.length)
  })

  it('count nothing for no applications', () => {
    expect(countsByStatus([])).toEqual({ to_apply: 0, applied: 0, interview: 0, offer: 0, closed: 0 })
  })

  it('list only the applications of one status, in their stored order', () => {
    const list = [app('a', 'applied'), app('b', 'offer'), app('c', 'applied')]
    expect(applicationsWithStatus(list, 'applied').map((a) => a.id)).toEqual(['a', 'c'])
    expect(applicationsWithStatus(list, 'closed')).toEqual([])
  })
})

describe('defaultTab', () => {
  it('prefers to_apply when it has anything', () => {
    expect(defaultTab([app('a', 'applied'), app('b', 'to_apply')])).toBe('to_apply')
  })

  it('otherwise takes the first tab that has something', () => {
    expect(defaultTab([app('a', 'offer'), app('b', 'interview')])).toBe('interview')
    expect(defaultTab([app('a', 'closed')])).toBe('closed')
  })

  it('is to_apply when there is nothing', () => {
    expect(defaultTab([])).toBe('to_apply')
  })
})

describe('nextTabIndex', () => {
  it('moves with the arrow keys and wraps around', () => {
    expect(nextTabIndex(1, 'ArrowRight', 5)).toBe(2)
    expect(nextTabIndex(4, 'ArrowRight', 5)).toBe(0)
    expect(nextTabIndex(2, 'ArrowLeft', 5)).toBe(1)
    expect(nextTabIndex(0, 'ArrowLeft', 5)).toBe(4)
  })

  it('goes to the ends with Home and End', () => {
    expect(nextTabIndex(3, 'Home', 5)).toBe(0)
    expect(nextTabIndex(1, 'End', 5)).toBe(4)
  })

  it('ignores other keys and an empty list', () => {
    expect(nextTabIndex(1, 'Enter', 5)).toBeNull()
    expect(nextTabIndex(1, 'ArrowDown', 5)).toBeNull()
    expect(nextTabIndex(0, 'ArrowRight', 0)).toBeNull()
  })
})

describe('tabAfterDataChange', () => {
  it('is to_apply when there are no applications, whatever was selected', () => {
    for (const tab of TABS) expect(tabAfterDataChange(tab, [])).toBe('to_apply')
  })

  it('keeps the current tab when there are applications', () => {
    for (const tab of TABS) expect(tabAfterDataChange(tab, [app('a', 'closed')])).toBe(tab)
  })
})
