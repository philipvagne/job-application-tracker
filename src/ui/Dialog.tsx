import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { isOutsideBox, shouldCloseOnBackdrop } from '../domain'
import { DialogDirtyContext } from './dialogGuard'

interface DialogProps {
  open: boolean
  /** Called when the dialog closes, including with the Escape key. */
  onClose: () => void
  /** The id of the element inside that names the dialog. */
  titleId: string
  /** Extra class, e.g. dialog--fixed-footer. */
  className?: string
  /** A click on the backdrop closes the dialog (it counts as cancel). Off by default. */
  closeOnBackdrop?: boolean
  /** The dialog is in the middle of something; a backdrop click does nothing. */
  busy?: boolean
  /** The user has changed something; a backdrop click does nothing. Forms inside can use useDialogDirty. */
  dirty?: boolean
  children: ReactNode
}

/**
 * A native modal <dialog>: the browser traps focus, closes on Escape and returns
 * focus to the opener. Keep it mounted and toggle `open`, so focus can be restored.
 * An element inside with data-autofocus gets the focus first.
 *
 * With closeOnBackdrop, a click that starts and ends on the backdrop closes it through
 * dialog.close(), so onClose and the focus return work as for Escape. Pressing inside and
 * releasing outside (to select text, say) does not count.
 */
export function Dialog({ open, onClose, titleId, className, closeOnBackdrop = false, busy = false, dirty = false, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOnBackdrop = useRef(false)
  const childDirty = useRef(false)
  const setChildDirty = useCallback((value: boolean) => {
    childDirty.current = value
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function onBackdrop(event: PointerEvent<HTMLDialogElement> | MouseEvent<HTMLDialogElement>): boolean {
    const dialog = ref.current
    return dialog !== null && event.target === dialog && isOutsideBox(dialog.getBoundingClientRect(), event.clientX, event.clientY)
  }

  function onPointerDown(event: PointerEvent<HTMLDialogElement>): void {
    pressedOnBackdrop.current = onBackdrop(event)
  }

  function onClick(event: MouseEvent<HTMLDialogElement>): void {
    const pressed = pressedOnBackdrop.current
    pressedOnBackdrop.current = false
    if (!closeOnBackdrop) return
    const close = shouldCloseOnBackdrop({
      pressedOnBackdrop: pressed,
      releasedOnBackdrop: onBackdrop(event),
      busy,
      dirty: dirty || childDirty.current,
    })
    if (close) ref.current?.close()
  }

  return (
    <dialog
      ref={ref}
      className={className === undefined ? 'dialog' : `dialog ${className}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <DialogDirtyContext.Provider value={setChildDirty}>{children}</DialogDirtyContext.Provider>
    </dialog>
  )
}
