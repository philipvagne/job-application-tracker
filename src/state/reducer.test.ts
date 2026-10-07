import { describe, expect, it } from 'vitest'
import { createEmptyState, type AppState } from '../domain'
import { reducer } from './reducer'

function stateWithData(): AppState {
  return {
    applications: [
      { id: 'a1', company: 'Acme', role: 'Dev', url: '', status: 'to_apply', cvId: 'cv1', createdAt: '2026-10-01T08:00:00.000Z' },
    ],
    cvs: [{ id: 'cv1', name: 'Short' }],
    settings: { reminderDays: 7, language: 'sv' },
  }
}

describe('reducer', () => {
  it('replace swaps in the whole state', () => {
    const next = stateWithData()
    expect(reducer(createEmptyState(), { type: 'replace', state: next })).toBe(next)
  })

  it('setLanguage changes only the language', () => {
    const before = stateWithData()
    const after = reducer(before, { type: 'setLanguage', language: 'en' })
    expect(after).toEqual({ ...before, settings: { ...before.settings, language: 'en' } })
    expect(before.settings.language).toBe('sv')
  })

  it('setLanguage to the current language returns the same object', () => {
    const before = stateWithData()
    expect(reducer(before, { type: 'setLanguage', language: 'sv' })).toBe(before)
  })

  it('setReminderDays sets a valid value and ignores an invalid one', () => {
    const before = stateWithData()
    expect(reducer(before, { type: 'setReminderDays', days: 30 }).settings.reminderDays).toBe(30)
    expect(reducer(before, { type: 'setReminderDays', days: 0 })).toBe(before)
    expect(reducer(before, { type: 'setReminderDays', days: 400 })).toBe(before)
  })

  it('markExported records the date', () => {
    const after = reducer(stateWithData(), { type: 'markExported', now: '2026-10-07T09:00:00.000Z' })
    expect(after.settings.lastExportAt).toBe('2026-10-07T09:00:00.000Z')
    expect(after.applications).toHaveLength(1)
  })

  it('addApplications appends', () => {
    const app = { id: 'a2', company: 'Globex', role: '', url: '', status: 'to_apply' as const, createdAt: '2026-10-02T08:00:00.000Z' }
    const after = reducer(stateWithData(), { type: 'addApplications', applications: [app] })
    expect(after.applications.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('replaceApplication and deleteApplication change one application', () => {
    const before = stateWithData()
    const first = before.applications[0]!
    const edited = reducer(before, { type: 'replaceApplication', application: { ...first, company: 'New' } })
    expect(edited.applications[0]?.company).toBe('New')
    expect(reducer(before, { type: 'replaceApplication', application: { ...first, id: 'zzz' } })).toBe(before)
    expect(reducer(before, { type: 'deleteApplication', id: 'a1' }).applications).toEqual([])
    expect(reducer(before, { type: 'deleteApplication', id: 'zzz' })).toBe(before)
  })

  it('addCv adds a CV, and ignores an empty or repeated name', () => {
    const before = stateWithData()
    expect(reducer(before, { type: 'addCv', id: 'cv2', name: ' Long ' }).cvs.map((c) => c.name)).toEqual(['Short', 'Long'])
    expect(reducer(before, { type: 'addCv', id: 'cv2', name: ' ' })).toBe(before)
    expect(reducer(before, { type: 'addCv', id: 'cv2', name: 'short' })).toBe(before)
  })

  it('markApplied sets the date, the CV and lastCvId, and ignores an unknown CV', () => {
    const before = stateWithData()
    const after = reducer(before, { type: 'markApplied', id: 'a1', cvId: 'cv1', now: '2026-10-07T09:00:00.000Z' })
    expect(after.applications[0]).toEqual(
      expect.objectContaining({ status: 'applied', cvId: 'cv1', appliedAt: '2026-10-07T09:00:00.000Z' }),
    )
    expect(after.settings.lastCvId).toBe('cv1')
    expect(reducer(before, { type: 'markApplied', id: 'a1', cvId: 'nope', now: '2026-10-07T09:00:00.000Z' })).toBe(before)
  })


  it('reset removes the data and keeps the language', () => {
    const after = reducer(stateWithData(), { type: 'reset' })
    expect(after.applications).toEqual([])
    expect(after.cvs).toEqual([])
    expect(after.settings).toEqual({ reminderDays: 14, language: 'sv' })
  })
})
