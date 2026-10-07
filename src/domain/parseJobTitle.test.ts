import { describe, expect, it } from 'vitest'
import { parseJobTitle } from './parseJobTitle'

const NONE = { role: null, company: null }

describe('parseJobTitle', () => {
  it('splits role, company and site', () => {
    expect(parseJobTitle('Frontend Developer - Acme AB | LinkedIn')).toEqual({
      role: 'Frontend Developer',
      company: 'Acme AB',
    })
  })

  it('splits role and company without a site', () => {
    expect(parseJobTitle('Backend Engineer | Globex')).toEqual({ role: 'Backend Engineer', company: 'Globex' })
  })

  it('handles en and em dashes', () => {
    expect(parseJobTitle('Designer – Initech')).toEqual({ role: 'Designer', company: 'Initech' })
    expect(parseJobTitle('Designer — Initech')).toEqual({ role: 'Designer', company: 'Initech' })
  })

  it('drops a notification count and extra whitespace', () => {
    expect(parseJobTitle('(3)  Data   Analyst - Acme AB | LinkedIn')).toEqual({
      role: 'Data Analyst',
      company: 'Acme AB',
    })
  })

  it('handles Swedish sites', () => {
    expect(parseJobTitle('Utvecklare - Volvo | Platsbanken')).toEqual({ role: 'Utvecklare', company: 'Volvo' })
  })

  it('splits "role at company" and "role hos company"', () => {
    expect(parseJobTitle('Developer at Acme')).toEqual({ role: 'Developer', company: 'Acme' })
    expect(parseJobTitle('Utvecklare hos Acme AB')).toEqual({ role: 'Utvecklare', company: 'Acme AB' })
  })

  it('keeps hyphens inside words', () => {
    expect(parseJobTitle('Full-Stack Developer - Acme AB')).toEqual({ role: 'Full-Stack Developer', company: 'Acme AB' })
  })

  it('returns nulls when unsure', () => {
    expect(parseJobTitle('Jobs')).toEqual(NONE)
    expect(parseJobTitle('A - B - C - D')).toEqual(NONE)
    expect(parseJobTitle('Frontend Developer | LinkedIn')).toEqual(NONE)
  })

  it('returns nulls for empty or whitespace input', () => {
    expect(parseJobTitle('')).toEqual(NONE)
    expect(parseJobTitle('   ')).toEqual(NONE)
    expect(parseJobTitle(' - | ')).toEqual(NONE)
  })

  it('returns nulls for non-string input', () => {
    for (const value of [null, undefined, 42, {}, [], ['a - b'], true]) {
      expect(parseJobTitle(value)).toEqual(NONE)
    }
  })

  it('returns nulls for very long input', () => {
    expect(parseJobTitle('a - b'.padEnd(5000, 'x'))).toEqual(NONE)
  })

  it('keeps markup as plain text', () => {
    expect(parseJobTitle('<b>Dev</b> - <i>Acme</i>')).toEqual({ role: '<b>Dev</b>', company: '<i>Acme</i>' })
  })
})
