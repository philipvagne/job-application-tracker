import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { applicationTitle, decideQuickAdd, type Application, type ApplicationFieldError, type QuickAddTarget } from '../domain'
import { useApp } from '../state/AppContext'

/** A fixed id, so other parts of the page can move focus to the link field. */
export const LINK_FIELD_ID = 'quick-add-link'

interface QuickAddProps {
  /** The visible card label. */
  heading: string
  /** The CV choice, shown beside the link. It belongs to the tracker, which also uses it when marking as applied. */
  cvField: ReactNode
  /** The CV in the picker; '' is "No CV". */
  cvId: string
  /** Saving as applied needs a CV: the tracker shows the CV error, or opens the CV form when there are no CVs. */
  onNeedsCv: (noCvs: boolean) => void
  /** A job was saved. The tracker shows its tab. */
  onSaved: (application: Application) => void
  /** Links were pasted and added. They all go to To apply. */
  onPasted: () => void
  /** Shows a short message in the page's polite status area. */
  onAnnounce: (message: string) => void
}

interface DuplicateWarning {
  existing: Application
  /** The button the user pressed, so "Add anyway" does what they asked for. */
  target: QuickAddTarget
}

/**
 * A link, a CV and two buttons. Enter in a field saves to To apply. Company, role and a note
 * are behind a button, and so is the paste box. Focus stays in the link field for the next one.
 */
export function QuickAdd({ heading, cvField, cvId, onNeedsCv, onSaved, onPasted, onAnnounce }: QuickAddProps) {
  const { t, state, actions } = useApp()
  const headingId = `${LINK_FIELD_ID}-h`
  const companyId = useId()
  const roleId = useId()
  const notesId = useId()
  const linkErrorId = useId()
  const linkHelpId = useId()
  const duplicateId = useId()
  const pasteId = useId()
  const pasteHintId = useId()
  const pasteResultId = useId()

  const companyRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<ApplicationFieldError[]>([])
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteResult, setPasteResult] = useState('')

  const linkInvalid = errors.includes('invalid_url')
  const linkMissing = errors.includes('company_or_link_required')
  const linkErrorText = linkInvalid ? t('field.linkInvalid') : linkMissing ? t('field.companyOrLinkRequired') : ''
  const describedBy = [
    linkHelpId,
    linkErrorText !== '' ? linkErrorId : '',
    duplicate !== null ? duplicateId : '',
  ]
    .filter((id) => id !== '')
    .join(' ')

  function save(target: QuickAddTarget, allowDuplicate: boolean): void {
    const decision = decideQuickAdd(
      { company, url: link, target, cvId, allowDuplicate },
      state.applications,
      state.cvs,
    )
    if (decision.kind === 'invalid') {
      setErrors(decision.errors)
      setDuplicate(null)
      linkRef.current?.focus()
      return
    }
    setErrors([])
    if (decision.kind === 'needs_cv') {
      setDuplicate(null)
      onNeedsCv(decision.noCvs)
      return
    }
    if (decision.kind === 'duplicate') {
      setDuplicate({ existing: decision.existing, target })
      linkRef.current?.focus()
      return
    }

    const fields = { company, role, url: link, notes }
    const result = target === 'applied' ? actions.addAppliedApplication({ ...fields, cvId }) : actions.addApplication(fields)
    if (!result.ok) {
      // The decision above already passed, so this is only a CV that disappeared meanwhile.
      if (result.error.includes('cv_required')) onNeedsCv(state.cvs.length === 0)
      else setErrors(result.error.filter((e): e is ApplicationFieldError => e !== 'cv_required'))
      return
    }
    setDuplicate(null)
    setCompany('')
    setRole('')
    setNotes('')
    setLink('')
    onSaved(result.value)
    linkRef.current?.focus()
    onAnnounce(
      t(target === 'applied' ? 'quickAdd.addedApplied' : 'quickAdd.addedToApply', {
        company: applicationTitle(result.value),
      }),
    )
  }

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    save('to_apply', false)
  }

  function onPaste(event: FormEvent): void {
    event.preventDefault()
    if (pasteText.trim() === '') {
      setPasteResult(t('paste.empty'))
      pasteRef.current?.focus()
      return
    }
    const { added, duplicates, skipped } = actions.addPasted(pasteText)
    setPasteText('')
    setPasteResult(t('paste.result', { added, duplicates, skipped }))
    if (added > 0) onPasted()
    pasteRef.current?.focus()
  }

  return (
    <section className="card add" aria-labelledby={headingId}>
      <h2 id={headingId} className="label">
        {heading}
      </h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="add__grid">
          <div className="field add__link">
            <label htmlFor={LINK_FIELD_ID}>{t('quickAdd.linkLabel')}</label>
            <input
              id={LINK_FIELD_ID}
              ref={linkRef}
              className="input"
              type="text"
              inputMode="url"
              autoComplete="off"
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setDuplicate(null)
              }}
              aria-invalid={linkInvalid || linkMissing}
              aria-describedby={describedBy}
            />
            <p id={linkHelpId} className="hint">
              {t('quickAdd.linkHelp')}
            </p>
            <p id={linkErrorId} className="error">
              {linkErrorText}
            </p>
            <div role="status">
              {duplicate !== null && (
                <p id={duplicateId} className="hint add__duplicate">
                  {t('quickAdd.duplicate', {
                    name: applicationTitle(duplicate.existing),
                    status: t(`tracker.tab.${duplicate.existing.status}`),
                  })}{' '}
                  <button type="button" className="btn btn--small" onClick={() => save(duplicate.target, true)}>
                    {t('quickAdd.addAnyway')}
                  </button>
                </p>
              )}
            </div>
          </div>
          <div className="add__cv">{cvField}</div>
        </div>
        <div className="add__actions">
          <button type="submit" className="btn btn--primary">
            {t('quickAdd.saveToApply')}
          </button>
          <button type="button" className="btn" onClick={() => save('applied', false)}>
            {t('quickAdd.saveApplied')}
          </button>
        </div>

        <details
          className="paste"
          onToggle={(e) => {
            if (e.currentTarget.open) companyRef.current?.focus()
          }}
        >
          <summary className="paste__summary">{t('quickAdd.moreToggle')}</summary>
          <div className="add__more">
            <div className="field">
              <label htmlFor={companyId}>{t('field.company')}</label>
              <input
                id={companyId}
                ref={companyRef}
                className="input"
                type="text"
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
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
              <label htmlFor={notesId}>{t('field.notes')}</label>
              <textarea
                id={notesId}
                className="input input--area"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </details>
      </form>

      <details className="paste">
        <summary className="paste__summary">{t('paste.summary')}</summary>
        <form onSubmit={onPaste}>
          <div className="field">
            <label htmlFor={pasteId}>{t('paste.label')}</label>
            <textarea
              id={pasteId}
              ref={pasteRef}
              className="input input--area"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              aria-describedby={`${pasteHintId} ${pasteResultId}`}
            />
            <p id={pasteHintId} className="hint">
              {t('paste.hint')}
            </p>
          </div>
          <button type="submit" className="btn">
            {t('paste.add')}
          </button>
          <p id={pasteResultId} role="status" className="note">
            {pasteResult}
          </p>
        </form>
      </details>
    </section>
  )
}
