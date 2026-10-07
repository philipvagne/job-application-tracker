import { useEffect, useId, useState, type ReactNode } from 'react'
import { useApp } from '../state/AppContext'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  /** Gives the confirm button the danger style, for actions that destroy data. */
  danger?: boolean
  /** Extra content under the text, such as a field for a choice. */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/** A question with a safe default: Cancel has the focus. Offers an export before going ahead. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t, actions } = useApp()
  const titleId = useId()
  const [exported, setExported] = useState(false)

  useEffect(() => {
    if (!open) setExported(false)
  }, [open])

  return (
    <Dialog open={open} onClose={onCancel} titleId={titleId}>
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      <p>{body}</p>
      {children}
      <p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            actions.exportBackup()
            setExported(true)
          }}
        >
          {t('confirm.exportFirst')}
        </button>
      </p>
      <p role="status" className="note">
        {exported ? t('confirm.exportDone') : ''}
      </p>
      <div className="dialog__actions">
        <button type="button" className="btn" data-autofocus onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className={danger ? 'btn btn--danger' : 'btn btn--primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
