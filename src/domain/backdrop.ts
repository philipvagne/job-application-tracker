/** The edges of a box on screen, like a DOMRect but without the DOM. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * True when a point is outside the box. A modal dialog's backdrop is everything outside the
 * dialog's own box; the dialog's padding is inside the box and so is not the backdrop.
 */
export function isOutsideBox(box: Box, x: number, y: number): boolean {
  return x < box.left || x > box.right || y < box.top || y > box.bottom
}

export interface BackdropClick {
  /** The mouse or finger went down on the backdrop. */
  pressedOnBackdrop: boolean
  /** The click ended on the backdrop. */
  releasedOnBackdrop: boolean
  /** The dialog is in the middle of something (an export or a delete) and must stay open. */
  busy: boolean
  /** The user has changed something that a close would lose. */
  dirty: boolean
}

/** A backdrop click closes the dialog only if it started and ended there and nothing would be lost. */
export function shouldCloseOnBackdrop(click: BackdropClick): boolean {
  return click.pressedOnBackdrop && click.releasedOnBackdrop && !click.busy && !click.dirty
}
