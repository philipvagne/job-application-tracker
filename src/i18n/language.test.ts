import { describe, expect, it } from 'vitest'
import { browserLanguages, detectLanguage, formatDate } from './language'

describe('detectLanguage', () => {
  it.each(['sv', 'sv-SE', 'sv-FI', 'SV', 'sv_SE', ' sv-SE '])('picks Swedish for %j', (value) => {
    expect(detectLanguage([value])).toBe('sv')
  })

  it.each(['en', 'en-US', 'de-DE', 'de', 'nb-NO', 'fi', 'xsv', 'xx'])('picks English for %j', (value) => {
    expect(detectLanguage([value])).toBe('en')
  })

  it('picks English for an empty list, no list, or empty values', () => {
    expect(detectLanguage([])).toBe('en')
    expect(detectLanguage(undefined)).toBe('en')
    expect(detectLanguage([''])).toBe('en')
  })

  it('only looks at the first usable entry', () => {
    expect(detectLanguage(['sv-SE', 'en-US'])).toBe('sv')
    expect(detectLanguage(['en-US', 'sv'])).toBe('en')
    expect(detectLanguage(['xx', 'sv'])).toBe('en')
    expect(detectLanguage(['', '  ', 'sv'])).toBe('sv')
  })
})

describe('browserLanguages', () => {
  it('prefers the list, then the single language, then nothing', () => {
    expect(browserLanguages({ languages: ['sv-SE', 'en'], language: 'en' })).toEqual(['sv-SE', 'en'])
    expect(browserLanguages({ languages: [], language: 'sv' })).toEqual(['sv'])
    expect(browserLanguages({ language: 'de' })).toEqual(['de'])
    expect(browserLanguages({})).toEqual([])
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
