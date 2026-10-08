import { describe, expect, it } from 'vitest'
import { createEmptyState } from './backup'
import {
  editReminderDraft,
  parseReminderDays,
  reminderFieldText,
  resetState,
  setLanguage,
  setReminderDays,
  setShowWeekSummary,
} from './settings'
import type { AppState } from './types'

function withData(): AppState {
  return {
    applications: [
      { id: 'a1', company: 'Acme', role: 'Dev', url: '', status: 'to_apply', cvId: 'cv1', createdAt: '2026-10-01T08:00:00.000Z' },
    ],
    cvs: [{ id: 'cv1', name: 'Short' }],
    settings: { reminderDays: 7, language: 'sv', lastExportAt: '2026-10-01T10:00:00.000Z' },
  }
}

describe('setLanguage', () => {
  it('changes only the language and does not mutate', () => {
    const before = withData()
    const after = setLanguage(before, 'en')
    expect(after.settings).toEqual({ ...before.settings, language: 'en' })
    expect(before.settings.language).toBe('sv')
  })
})

describe('parseReminderDays', () => {
  it.each([
    ['14', 14],
    [' 7 ', 7],
    ['1', 1],
    ['365', 365],
    ['007', 7],
  ])('accepts %j', (text, days) => {
    expect(parseReminderDays(text)).toBe(days)
  })

  it.each(['', ' ', '0', '366', '-1', '1.5', '1e2', 'abc', '14 days', '99999', '١٤'])('rejects %j', (text) => {
    expect(parseReminderDays(text)).toBeNull()
  })
})

describe('reminder draft', () => {
  it('shows the saved number when there is no draft', () => {
    expect(reminderFieldText(null, 14)).toBe('14')
  })

  it('keeps showing a valid draft that it saved itself', () => {
    const draft = editReminderDraft('030', 14) // saves 30
    expect(draft.baseline).toBe(30)
    expect(reminderFieldText(draft, 30)).toBe('030')
  })

  it('keeps an invalid draft while the saved number is unchanged', () => {
    const draft = editReminderDraft('', 14)
    expect(reminderFieldText(draft, 14)).toBe('')
    expect(reminderFieldText(editReminderDraft('999', 14), 14)).toBe('999')
  })

  it('ignores a draft when the saved number changed from outside', () => {
    expect(reminderFieldText(editReminderDraft('', 14), 21)).toBe('21')
    expect(reminderFieldText(editReminderDraft('abc', 14), 7)).toBe('7')
    expect(reminderFieldText(editReminderDraft('030', 14), 7)).toBe('7')
  })
})

describe('setReminderDays', () => {
  it('sets a valid value', () => {
    expect(setReminderDays(createEmptyState(), 30).settings.reminderDays).toBe(30)
  })

  it.each([0, 366, 1.5, NaN, Infinity, -3])('keeps the state for %s', (days) => {
    const state = createEmptyState()
    expect(setReminderDays(state, days)).toBe(state)
  })
})

describe('resetState', () => {
  it('removes data and settings but keeps the language', () => {
    const after = resetState(withData())
    expect(after.applications).toEqual([])
    expect(after.cvs).toEqual([])
    expect(after.settings).toEqual({ reminderDays: 14, language: 'sv' })
  })
})

describe('setShowWeekSummary', () => {
  it('turns the summary on and off without touching anything else', () => {
    const before = withData()
    const on = setShowWeekSummary(before, true)
    expect(on.settings).toEqual({ ...before.settings, showWeekSummary: true })
    expect(on.applications).toBe(before.applications)
    expect(setShowWeekSummary(on, false).settings.showWeekSummary).toBe(false)
    expect('showWeekSummary' in before.settings).toBe(false)
  })

  it('returns the same state when nothing changes', () => {
    const on = setShowWeekSummary(withData(), true)
    expect(setShowWeekSummary(on, true)).toBe(on)
  })

  it('is off again after "delete all my data"', () => {
    const after = resetState(setShowWeekSummary(withData(), true))
    expect(after.settings.showWeekSummary).toBeUndefined()
  })
})
