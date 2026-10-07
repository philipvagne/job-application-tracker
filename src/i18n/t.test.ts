import { describe, expect, it } from 'vitest'
import { checkDictionaries } from '../../scripts/check-i18n.js'
import en from './en.json'
import sv from './sv.json'
import { dictionaries, interpolate, lookup, t } from './t'

describe('interpolate', () => {
  it('replaces placeholders', () => {
    expect(interpolate('From {min} to {max}.', { min: 1, max: 365 })).toBe('From 1 to 365.')
  })

  it('replaces a placeholder used twice', () => {
    expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x')
  })

  it('leaves a placeholder without a param as written', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}')
    expect(interpolate('Hello {name}')).toBe('Hello {name}')
  })

  it('ignores params that are not in the text', () => {
    expect(interpolate('Hello', { name: 'x' })).toBe('Hello')
  })

  it('keeps zero and does not interpret special replacement patterns', () => {
    expect(interpolate('{n}', { n: 0 })).toBe('0')
    expect(interpolate('{n}', { n: '$& $1' })).toBe('$& $1')
  })

  it('does not read inherited properties as params', () => {
    expect(interpolate('{toString}', {})).toBe('{toString}')
  })
})

describe('t and lookup', () => {
  it('finds nested keys in each language', () => {
    expect(t(dictionaries.en, 'banner.notSaved.title')).toBe("Changes can't be saved in this browser")
    expect(t(dictionaries.sv, 'banner.notSaved.title')).toBe('Ändringar kan inte sparas i den här webbläsaren')
  })

  it('interpolates', () => {
    expect(t(dictionaries.en, 'settings.reminder.hint', { min: 1, max: 365 })).toBe(
      'A whole number from 1 to 365.',
    )
  })

  it('returns undefined for unknown paths and for groups', () => {
    expect(lookup(dictionaries.en, 'nope.nothing')).toBeUndefined()
    expect(lookup(dictionaries.en, 'banner')).toBeUndefined()
    expect(lookup(dictionaries.en, 'constructor')).toBeUndefined()
  })
})

describe('language files', () => {
  it('have the same keys, no empty values and the same placeholders', () => {
    expect(checkDictionaries(en, sv)).toEqual([])
  })
})
