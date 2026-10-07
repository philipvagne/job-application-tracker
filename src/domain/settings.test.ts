import { describe, expect, it } from 'vitest'
import { createEmptyState } from './backup'
import { parseReminderDays, resetState, setLanguage, setReminderDays } from './settings'
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
