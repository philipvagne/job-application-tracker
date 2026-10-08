import { useId, useState, type FormEvent } from 'react'
import { applicationTitle, type Application, type ApplicationFieldError } from '../domain'
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
  const { t, state, fileStatus, actions } = useApp()
  const companyId = useId()
  const roleId = useId()
  const linkId = useId()
  const notesId = useId()
  const cvSelectId = useId()
  const cvStatusId = useId()
  const companyErrorId = useId()
  const linkErrorId = useId()

  const [company, setCompany] = useState(application.company)
  const [role, setRole] = useState(application.role)
  const [link, setLink] = useState(application.url)
  const [notes, setNotes] = useState(application.notes ?? '')
  const [cvId, setCvId] = useState(application.cvId ?? '')
  const [errors, setErrors] = useState<ApplicationFieldError[]>([])

  const companyInvalid = errors.includes('company_or_link_required')
  const linkInvalid = errors.includes('invalid_url')
  const chosenCv = state.cvs.find((cv) => cv.id === cvId)
  const chosenStatus = chosenCv === undefined ? null : fileStatus(chosenCv)
  const cvStatusText =
    chosenCv === undefined
      ? ''
      : chosenCv.file === undefined
        ? t('cvFile.noFile')
        : chosenStatus === 'missing'
          ? t('cvFile.missing')
          : ''

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    const result = actions.editApplication(application.id, { company, role, url: link, notes })
    if (!result.ok) {
      setErrors(result.error)
      document.getElementById(result.error.includes('company_or_link_required') ? companyId : linkId)?.focus()
      return
    }
    if (cvId !== (application.cvId ?? '')) actions.linkCv(application.id, cvId === '' ? null : cvId)
    onSaved(applicationTitle(result.value))
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
          data-autofocus
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          aria-invalid={companyInvalid}
          aria-describedby={companyInvalid ? companyErrorId : undefined}
        />
        <p id={companyErrorId} className="error">
          {companyInvalid ? t('field.companyOrLinkRequired') : ''}
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
          aria-invalid={linkInvalid || companyInvalid}
          aria-describedby={[companyInvalid ? companyErrorId : '', linkInvalid ? linkErrorId : ''].filter(Boolean).join(' ') || undefined}
        />
        <p id={linkErrorId} className="error">
          {linkInvalid ? t('field.linkInvalid') : ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor={cvSelectId}>{t('editApp.cv')}</label>
        <select
          id={cvSelectId}
          className="input input--select"
          value={cvId}
          onChange={(e) => setCvId(e.target.value)}
          aria-describedby={cvStatusText === '' ? undefined : cvStatusId}
        >
          <option value="">{t('editApp.noCv')}</option>
          {state.cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.name}
            </option>
          ))}
        </select>
        <p id={cvStatusId} className="hint">
          {cvStatusText}
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
