import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  /** Called when the dialog closes, including with the Escape key. */
  onClose: () => void
  /** The id of the element inside that names the dialog. */
  titleId: string
  /** Extra class, e.g. dialog--fixed-footer. */
  className?: string
  children: ReactNode
}

/**
 * A native modal <dialog>: the browser traps focus, closes on Escape and returns
 * focus to the opener. Keep it mounted and toggle `open`, so focus can be restored.
 * An element inside with data-autofocus gets the focus first.
 */
export function Dialog({ open, onClose, titleId, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

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

  return (
    <dialog ref={ref} className={className === undefined ? 'dialog' : `dialog ${className}`} aria-labelledby={titleId} onClose={onClose}>
      {children}
    </dialog>
  )
}
