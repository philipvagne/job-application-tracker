import { describe, expect, it } from 'vitest'
import { daysSince } from './dates'

// The test run uses Europe/Stockholm (UTC+2 until 2026-10-25, UTC+1 after).
describe('daysSince', () => {
  it('is 0 on the same local day, even 23 hours apart', () => {
    expect(daysSince('2026-10-07T00:30:00.000+02:00', '2026-10-07T23:30:00.000+02:00')).toBe(0)
  })

  it('counts calendar days, not 24-hour periods', () => {
    expect(daysSince('2026-10-06T23:59:00.000+02:00', '2026-10-07T00:01:00.000+02:00')).toBe(1)
    expect(daysSince('2026-10-04T08:00:00.000+02:00', '2026-10-07T08:00:00.000+02:00')).toBe(3)
  })

  it('stays whole across the daylight saving change', () => {
    expect(daysSince('2026-10-24T12:00:00.000+02:00', '2026-10-26T12:00:00.000+01:00')).toBe(2)
  })

  it('is never negative', () => {
    expect(daysSince('2026-10-09T08:00:00.000Z', '2026-10-07T08:00:00.000Z')).toBe(0)
  })

  it('returns null for dates it cannot read', () => {
    expect(daysSince('nope', '2026-10-07T08:00:00.000Z')).toBeNull()
    expect(daysSince('2026-10-07T08:00:00.000Z', '')).toBeNull()
  })
})
