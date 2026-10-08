import { useId } from 'react'
import { applicationTitle, type Application } from '../domain'
import { useApp } from '../state/AppContext'
import { Dialog } from './Dialog'

interface NoteDialogProps {
  /** The application whose note is shown, or null when the dialog is closed. */
  application: Application | null
  onClose: () => void
}

/**
 * The whole note as plain text, line breaks kept. The browser returns focus to the button that
 * opened it, and Escape closes it. The Close button has the focus first; the text scrolls with
 * the keyboard because its container can take focus.
 */
export function NoteDialog({ application, onClose }: NoteDialogProps) {
  const { t } = useApp()
  const titleId = useId()
  return (
    <Dialog open={application !== null} onClose={onClose} titleId={titleId} className="dialog--fixed-footer" closeOnBackdrop>
      {application !== null && (
        <>
          <h2 id={titleId} className="dialog__title">
            {t('note.title', { company: applicationTitle(application) })}
          </h2>
          <div className="dialog__body" role="region" aria-labelledby={titleId} tabIndex={0}>
            <p className="note-full">{application.notes}</p>
          </div>
          <div className="dialog__actions dialog__actions--fixed">
            <button type="button" className="btn btn--primary" data-autofocus onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
