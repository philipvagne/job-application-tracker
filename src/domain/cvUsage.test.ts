import { describe, expect, it } from 'vitest'
import { applicationsUsingCv } from './cvUsage'
import type { Application, Status } from './types'

function app(id: string, status: Status, cvId?: string): Application {
  const base: Application = { id, company: id, role: '', url: '', status, createdAt: '2026-10-01T08:00:00.000Z' }
  return cvId === undefined ? base : { ...base, cvId }
}

describe('applicationsUsingCv', () => {
  it('counts the applications that point to the CV, in any status', () => {
    const list = [app('a', 'to_apply', 'cv1'), app('b', 'applied', 'cv1'), app('c', 'closed', 'cv1'), app('d', 'applied', 'cv2')]
    expect(applicationsUsingCv(list, 'cv1')).toBe(3)
    expect(applicationsUsingCv(list, 'cv2')).toBe(1)
  })

  it('is 0 for a CV nobody uses, an unknown id, and applications without a CV', () => {
    expect(applicationsUsingCv([app('a', 'to_apply')], 'cv1')).toBe(0)
    expect(applicationsUsingCv([], 'cv1')).toBe(0)
  })
})
