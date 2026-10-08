import { describe, expect, it } from 'vitest'
import { firstNoteLine } from './notes'

describe('firstNoteLine', () => {
  it('is null when there is no note or only whitespace', () => {
    expect(firstNoteLine(undefined)).toBeNull()
    expect(firstNoteLine('')).toBeNull()
    expect(firstNoteLine(' \n\t\r\n  ')).toBeNull()
  })

  it('takes the first non-empty line, trimmed', () => {
    expect(firstNoteLine('Ring Anna\nSecond line')).toBe('Ring Anna')
    expect(firstNoteLine('\n\n  Hello  \r\nMore')).toBe('Hello')
    expect(firstNoteLine('one\rtwo')).toBe('one')
  })

  it('cuts a long line with an ellipsis', () => {
    expect(firstNoteLine('abcdefghij', 5)).toBe('abcde…')
    expect(firstNoteLine('abcde', 5)).toBe('abcde')
    expect(firstNoteLine('x'.repeat(500))).toHaveLength(201)
  })

  it('does not split a character made of two code units', () => {
    expect(firstNoteLine('😀😀😀', 2)).toBe('😀😀…')
  })

  it('leaves markup as plain text', () => {
    expect(firstNoteLine('<b>hi</b>')).toBe('<b>hi</b>')
  })
})
