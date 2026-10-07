import { describe, expect, it } from 'vitest'
import { createEmptyState, isBackupDue } from './backup'
import type { AppState } from './types'

const DAY_MS = 86_400_000
const LAST = '2026-10-01T12:00:00.000Z'
const LAST_MS = Date.parse(LAST)

function stateWith(count: number, lastExportAt?: string): AppState {
  const base = createEmptyState()
  for (let i = 0; i < count; i++) {
    base.applications.push({
      id: `a${i}`,
      company: 'Acme',
      role: 'Dev',
      url: '',
      status: 'to_apply',
      cvId: 'cv1',
      createdAt: LAST,
    })
  }
  if (lastExportAt !== undefined) base.settings.lastExportAt = lastExportAt
  return base
}

const at = (ms: number): string => new Date(ms).toISOString()

describe('isBackupDue', () => {
  it('is false with no applications, even if never exported', () => {
    expect(isBackupDue(stateWith(0), LAST)).toBe(false)
    expect(isBackupDue(stateWith(0, LAST), at(LAST_MS + 100 * DAY_MS))).toBe(false)
  })

  it('is true with applications and no export yet', () => {
    expect(isBackupDue(stateWith(1), LAST)).toBe(true)
  })

  it('is false just under 14 full days, true at exactly 14', () => {
    const s = stateWith(1, LAST)
    expect(isBackupDue(s, LAST)).toBe(false)
    expect(isBackupDue(s, at(LAST_MS + 13 * DAY_MS))).toBe(false)
    expect(isBackupDue(s, at(LAST_MS + 14 * DAY_MS - 1))).toBe(false)
    expect(isBackupDue(s, at(LAST_MS + 14 * DAY_MS))).toBe(true)
    expect(isBackupDue(s, at(LAST_MS + 30 * DAY_MS))).toBe(true)
  })

  it('counts elapsed time across a DST change (Europe/Stockholm, 2026-10-25)', () => {
    const s = stateWith(1, '2026-10-20T12:00:00.000Z')
    expect(isBackupDue(s, '2026-11-03T11:59:59.999Z')).toBe(false)
    expect(isBackupDue(s, '2026-11-03T12:00:00.000Z')).toBe(true)
  })

  it('is false when the last export is in the future', () => {
    expect(isBackupDue(stateWith(1, at(LAST_MS + DAY_MS)), LAST)).toBe(false)
  })

  it('treats unparseable dates as due', () => {
    expect(isBackupDue(stateWith(1, 'garbage'), LAST)).toBe(true)
    expect(isBackupDue(stateWith(1, LAST), 'garbage')).toBe(true)
  })
})
