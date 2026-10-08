import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ApplicationFieldError } from '../domain'
import { useApp } from '../state/AppContext'

/** A fixed id, so other parts of the page can move focus to the Company field. */
export const COMPANY_FIELD_ID = 'quick-add-company'

interface QuickAddProps {
  /** The visible card label. */
  heading: string
  /** The CV choice, shown beside the link. It belongs to the tracker, which uses it when marking as applied. */
  cvField: ReactNode
  /** Shows a short message in the page's polite status area. */
  onAnnounce: (message: string) => void
}

/** Company, role and link on one row. Enter submits; focus stays in Company for the next one. */
export function QuickAdd({ heading, cvField, onAnnounce }: QuickAddProps) {
  const { t, actions } = useApp()
  const companyId = COMPANY_FIELD_ID
  const roleId = useId()
  const linkId = useId()
  const companyErrorId = useId()
  const linkErrorId = useId()
  const linkHelpId = useId()
  const pasteId = useId()
  const pasteHintId = useId()
  const pasteResultId = useId()

  const companyRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<ApplicationFieldError[]>([])
  const [pasteText, setPasteText] = useState('')
  const [pasteResult, setPasteResult] = useState('')

  const companyInvalid = errors.includes('company_required')
  const linkInvalid = errors.includes('invalid_url')

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    const result = actions.addApplication({ company, role, url: link })
    if (!result.ok) {
      setErrors(result.error)
      if (result.error.includes('company_required')) companyRef.current?.focus()
      else linkRef.current?.focus()
      return
    }
    setErrors([])
    setCompany('')
    setRole('')
    setLink('')
    companyRef.current?.focus()
    onAnnounce(t('quickAdd.added', { company: result.value.company }))
  }

  function onPaste(event: FormEvent): void {
    event.preventDefault()
    if (pasteText.trim() === '') {
      setPasteResult(t('paste.empty'))
      pasteRef.current?.focus()
      return
    }
    const { added, skipped } = actions.addPasted(pasteText)
    setPasteText('')
    setPasteResult(t('paste.result', { added, skipped }))
    pasteRef.current?.focus()
  }

  return (
    <section className="card add" aria-labelledby={`${companyId}-h`}>
      <h2 id={`${companyId}-h`} className="label">
        {heading}
      </h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="add__grid">
          <div className="field">
            <label htmlFor={companyId}>{t('field.company')}</label>
            <input
              id={companyId}
              ref={companyRef}
              className="input"
              type="text"
              autoComplete="off"
              required
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
          <div className="field add__link">
            <label htmlFor={linkId}>{t('quickAdd.linkLabel')}</label>
            <input
              id={linkId}
              ref={linkRef}
              className="input"
              type="text"
              inputMode="url"
              autoComplete="off"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              aria-invalid={linkInvalid}
              aria-describedby={linkInvalid ? `${linkHelpId} ${linkErrorId}` : linkHelpId}
            />
            <p id={linkHelpId} className="hint">
              {t('quickAdd.linkHelp')}
            </p>
            <p id={linkErrorId} className="error">
              {linkInvalid ? t('field.linkInvalid') : ''}
            </p>
          </div>
          <div className="add__cv">{cvField}</div>
        </div>
        <div className="add__actions">
          <button type="submit" className="btn btn--primary">
            {t('quickAdd.add')}
          </button>
        </div>
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
