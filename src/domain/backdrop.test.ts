import { describe, expect, it } from 'vitest'
import { isOutsideBox, shouldCloseOnBackdrop } from './backdrop'

const box = { left: 100, top: 50, right: 500, bottom: 350 }

describe('isOutsideBox', () => {
  it('is false inside the box, including its edges (the padding area)', () => {
    expect(isOutsideBox(box, 300, 200)).toBe(false)
    expect(isOutsideBox(box, 100, 50)).toBe(false)
    expect(isOutsideBox(box, 500, 350)).toBe(false)
  })

  it('is true on every side outside the box', () => {
    expect(isOutsideBox(box, 99, 200)).toBe(true)
    expect(isOutsideBox(box, 501, 200)).toBe(true)
    expect(isOutsideBox(box, 300, 49)).toBe(true)
    expect(isOutsideBox(box, 300, 351)).toBe(true)
  })
})

describe('shouldCloseOnBackdrop', () => {
  const click = { pressedOnBackdrop: true, releasedOnBackdrop: true, busy: false, dirty: false }

  it('closes when the click started and ended on the backdrop', () => {
    expect(shouldCloseOnBackdrop(click)).toBe(true)
  })

  it('does not close when the press started inside the dialog and ended outside', () => {
    expect(shouldCloseOnBackdrop({ ...click, pressedOnBackdrop: false })).toBe(false)
  })

  it('does not close when the press started on the backdrop and ended inside', () => {
    expect(shouldCloseOnBackdrop({ ...click, releasedOnBackdrop: false })).toBe(false)
  })

  it('does not close while busy or when something has been changed', () => {
    expect(shouldCloseOnBackdrop({ ...click, busy: true })).toBe(false)
    expect(shouldCloseOnBackdrop({ ...click, dirty: true })).toBe(false)
  })
})
