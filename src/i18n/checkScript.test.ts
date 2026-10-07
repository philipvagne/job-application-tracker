import { describe, expect, it } from 'vitest'
import { checkDictionaries } from '../../scripts/check-i18n.js'

describe('checkDictionaries', () => {
  const en = { a: { b: 'One {n}', c: 'Two' }, d: 'Three' }

  it('accepts matching files', () => {
    expect(checkDictionaries(en, { a: { b: 'Ett {n}', c: 'Två' }, d: 'Tre' })).toEqual([])
  })

  it('reports keys missing on either side', () => {
    const problems = checkDictionaries(en, { a: { b: 'Ett {n}' }, d: 'Tre', e: 'Fyra' })
    expect(problems).toContain('Missing in sv: a.c')
    expect(problems).toContain('Missing in en: e')
  })

  it('reports empty and whitespace-only values', () => {
    const problems = checkDictionaries(en, { a: { b: '', c: '  ' }, d: 'Tre' })
    expect(problems.some((p) => p.includes('Empty value in sv: a.b'))).toBe(true)
    expect(problems.some((p) => p.includes('Empty value in sv: a.c'))).toBe(true)
  })

  it('reports values that are not strings', () => {
    const problems = checkDictionaries(en, { a: { b: 'Ett {n}', c: 5 }, d: ['Tre'] })
    expect(problems.some((p) => p.includes('Not a string in sv: a.c'))).toBe(true)
    expect(problems.some((p) => p.includes('Not a string in sv: d'))).toBe(true)
  })

  it('reports a group on one side and text on the other', () => {
    const problems = checkDictionaries(en, { a: 'text', d: 'Tre' })
    expect(problems).toContain('Missing in en: a')
    expect(problems).toContain('Missing in sv: a.b')
  })

  it('reports different placeholders', () => {
    const problems = checkDictionaries(en, { a: { b: 'Ett {m}', c: 'Två' }, d: 'Tre' })
    expect(problems.some((p) => p.includes('Different {placeholders} in a.b'))).toBe(true)
  })
})
