import { describe, expect, it } from 'vitest'
import { formatDate, detectLanguage } from './language'

describe('detectLanguage', () => {
  it.each(['sv', 'sv-SE', 'sv-FI', 'SV', 'sv_SE', ' sv-SE '])('picks Swedish for %j', (value) => {
    expect(detectLanguage(value)).toBe('sv')
  })

  it.each(['en', 'en-US', 'de-DE', 'nb-NO', 'fi', '', 'xsv'])('picks English for %j', (value) => {
    expect(detectLanguage(value)).toBe('en')
  })

  it('picks English when there is no value', () => {
    expect(detectLanguage(undefined)).toBe('en')
  })
})

describe('formatDate', () => {
  it('formats in the chosen language', () => {
    expect(formatDate('2026-10-07T09:30:00.000Z', 'en')).toBe('Oct 7, 2026')
    expect(formatDate('2026-10-07T09:30:00.000Z', 'sv')).toMatch(/^7 okt\.? 2026$/)
  })

  it('returns the raw text for something that is not a date', () => {
    expect(formatDate('garbage', 'en')).toBe('garbage')
  })
})
