import { describe, expect, it } from 'vitest'
import { EXPORT_VERSION, READABLE_VERSIONS, migrateToLatest } from './migrate'

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

  it('upgrades version 2 to the current version without changing anything else', () => {
    const v2 = { version: 2, cvs: [], applications: [{ company: 'A' }], settings: {} }
    expect(migrateToLatest(v2)).toEqual({ ...v2, version: EXPORT_VERSION })
  })

  it('leaves the current version, unknown versions and non-objects alone', () => {
    const current = { version: EXPORT_VERSION }
    expect(migrateToLatest(current)).toBe(current)
    const future = { version: 99 }
    expect(migrateToLatest(future)).toBe(future)
    for (const value of [null, undefined, 1, 'x', [], [1]]) expect(migrateToLatest(value)).toBe(value)
  })

  it('is version 3 now, and still reads 1 and 2', () => {
    expect(EXPORT_VERSION).toBe(3)
    expect(READABLE_VERSIONS).toEqual([1, 2, 3])
  })
})
