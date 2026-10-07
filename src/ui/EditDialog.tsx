import { useId, useState, type FormEvent } from 'react'
import type { Application, ApplicationFieldError } from '../domain'
import { useApp } from '../state/AppContext'
import { Dialog } from './Dialog'

interface EditDialogProps {
  /** The application being edited, or null when the dialog is closed. */
  application: Application | null
  onClose: () => void
  onSaved: (company: string) => void
}

/** The fields live in a child keyed by id, so each opening starts from the saved values. */
export function EditDialog({ application, onClose, onSaved }: EditDialogProps) {
  const titleId = useId()
  return (
    <Dialog open={application !== null} onClose={onClose} titleId={titleId}>
      {application !== null && (
        <EditForm key={application.id} application={application} titleId={titleId} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  )
}

interface EditFormProps {
  application: Application
  titleId: string
  onClose: () => void
  onSaved: (company: string) => void
}

function EditForm({ application, titleId, onClose, onSaved }: EditFormProps) {
  const { t, actions } = useApp()
  const companyId = useId()
  const roleId = useId()
  const linkId = useId()
  const notesId = useId()
  const companyErrorId = useId()
  const linkErrorId = useId()

  const [company, setCompany] = useState(application.company)
  const [role, setRole] = useState(application.role)
  const [link, setLink] = useState(application.url)
  const [notes, setNotes] = useState(application.notes ?? '')
  const [errors, setErrors] = useState<ApplicationFieldError[]>([])

  const companyInvalid = errors.includes('company_required')
  const linkInvalid = errors.includes('invalid_url')

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    const result = actions.editApplication(application.id, { company, role, url: link, notes })
    if (!result.ok) {
      setErrors(result.error)
      return
    }
    onSaved(result.value.company)
    onClose()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 id={titleId} className="dialog__title">
        {t('editApp.title')}
      </h2>
      <div className="field">
        <label htmlFor={companyId}>{t('field.company')}</label>
        <input
          id={companyId}
          className="input"
          type="text"
          autoComplete="off"
          required
          data-autofocus
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          aria-invalid={companyInvalid}
          aria-describedby={companyInvalid ? companyErrorId : undefined}
        />
        <p id={companyErrorId} className="error">
          {companyInvalid ? t('field.companyRequired') : ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor={roleId}>{t('field.role')}</label>
        <input
          id={roleId}
          className="input"
          type="text"
          autoComplete="off"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={linkId}>{t('field.link')}</label>
        <input
          id={linkId}
          className="input"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-invalid={linkInvalid}
          aria-describedby={linkInvalid ? linkErrorId : undefined}
        />
        <p id={linkErrorId} className="error">
          {linkInvalid ? t('field.linkInvalid') : ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor={notesId}>{t('field.notes')}</label>
        <textarea
          id={notesId}
          className="input input--area"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn btn--primary">
          {t('editApp.save')}
        </button>
      </div>
    </form>
  )
}
