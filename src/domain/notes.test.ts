import { describe, expect, it } from 'vitest'
import { NOTE_PREVIEW_MAX, notePreview } from './notes'

describe('notePreview', () => {
  it('is null when there is no note or only whitespace', () => {
    expect(notePreview(undefined)).toBeNull()
    expect(notePreview('')).toBeNull()
    expect(notePreview(' \n\t\r\n  ')).toBeNull()
  })

  it('shows a short single line whole, with nothing more to open', () => {
    expect(notePreview('Ring Anna')).toEqual({ text: 'Ring Anna', truncated: false, hasMore: false })
    expect(notePreview('  Ring Anna \n\n  ')).toEqual({ text: 'Ring Anna', truncated: false, hasMore: false })
  })

  it('has a maximum of 70', () => {
    expect(NOTE_PREVIEW_MAX).toBe(70)
  })

  it('keeps exactly the maximum, and cuts one more', () => {
    expect(notePreview('x'.repeat(70))).toEqual({ text: 'x'.repeat(70), truncated: false, hasMore: false })
    expect(notePreview('x'.repeat(71))).toEqual({ text: 'x'.repeat(70), truncated: true, hasMore: true })
  })

  it('skips leading blank lines and handles every kind of line break', () => {
    expect(notePreview('\n\n  Hello  \r\nMore')?.text).toBe('Hello')
    expect(notePreview('one\rtwo')?.text).toBe('one')
    expect(notePreview('one\ntwo')?.text).toBe('one')
  })

  it('has more to open when further non-empty lines follow, without cutting the first', () => {
    expect(notePreview('Ring Anna\nSecond line')).toEqual({ text: 'Ring Anna', truncated: false, hasMore: true })
    expect(notePreview('Ring Anna\n\n   \n')).toEqual({ text: 'Ring Anna', truncated: false, hasMore: false })
  })

  it('cuts a long unbroken string at the maximum', () => {
    const r = notePreview('y'.repeat(300))
    expect(r).toEqual({ text: 'y'.repeat(70), truncated: true, hasMore: true })
  })

  it('does not leave trailing whitespace before the cut', () => {
    expect(notePreview('abcde fghij', 6)).toEqual({ text: 'abcde', truncated: true, hasMore: true })
  })

  it('uses a custom maximum', () => {
    expect(notePreview('abcdefghij', 5)).toEqual({ text: 'abcde', truncated: true, hasMore: true })
  })

  it('does not split å, ä, ö, written as one character or as letter plus accent', () => {
    expect(notePreview('åäöåäö', 3)?.text).toBe('åäö')
    const decomposed = 'åö'.repeat(3) // å and ö as two code points each
    expect(notePreview(decomposed, 3)?.text).toBe('åöå')
  })

  it('does not split emoji: surrogate pairs, joined sequences, flags and skin tones', () => {
    expect(notePreview('😀😀😀', 2)?.text).toBe('😀😀')
    const family = '👨‍👩‍👧‍👦'
    expect(notePreview(`${family}${family}${family}`, 2)?.text).toBe(`${family}${family}`)
    const flag = '🇸🇪'
    expect(notePreview(`${flag}${flag}${flag}`, 2)?.text).toBe(`${flag}${flag}`)
    const wave = '👋🏽'
    expect(notePreview(`${wave}${wave}${wave}`, 2)?.text).toBe(`${wave}${wave}`)
  })

  it('leaves markup as plain text', () => {
    expect(notePreview('<b>hi</b>')?.text).toBe('<b>hi</b>')
  })
})
