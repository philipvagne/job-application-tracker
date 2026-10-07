import { describe, expect, it } from 'vitest'
import { EXPORT_VERSION, migrateToLatest } from './migrate'

describe('migrateToLatest', () => {
  it('upgrades version 1 to the current version and keeps everything else', () => {
    const v1 = { version: 1, cvs: [], applications: [], settings: { reminderDays: 7, language: 'en' } }
    expect(migrateToLatest(v1)).toEqual({ ...v1, version: EXPORT_VERSION })
  })

  it('does not change the input', () => {
    const v1 = { version: 1, cvs: [] }
    migrateToLatest(v1)
    expect(v1.version).toBe(1)
  })

  it('leaves the current version, unknown versions and non-objects alone', () => {
    const current = { version: EXPORT_VERSION }
    expect(migrateToLatest(current)).toBe(current)
    const future = { version: 99 }
    expect(migrateToLatest(future)).toBe(future)
    for (const value of [null, undefined, 1, 'x', [], [1]]) expect(migrateToLatest(value)).toBe(value)
  })

  it('is version 2 now', () => {
    expect(EXPORT_VERSION).toBe(2)
  })
})
