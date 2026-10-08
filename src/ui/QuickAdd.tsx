import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { applicationTitle, decideQuickAdd, hostOf, type Application, type ApplicationFieldError, type QuickAddTarget } from '../domain'
import { useApp } from '../state/AppContext'
import type { IncomingAdd } from '../state/incomingAdd'

/** A fixed id, so other parts of the page can move focus to the link field. */
export const LINK_FIELD_ID = 'quick-add-link'

interface QuickAddProps {
  /** The visible card label. */
  heading: string
  /** The CV choice, shown beside the link. It belongs to the tracker, which also uses it when marking as applied. */
  cvField: ReactNode
  /** The CV in the picker; '' is "No CV". */
  cvId: string
  /** A job from the bookmarklet. It fills the card (replacing what was there) but is never saved by itself. */
  incoming: IncomingAdd | null
  /** Called once the payload has been used, so it is not used again. */
  onIncomingHandled: () => void
  /** A job was saved. The tracker shows its tab. */
  onSaved: (application: Application) => void
  /** Links were pasted and added. They all go to To apply. */
  onPasted: () => void
  /** Shows a short message in the page's polite status area. */
  onAnnounce: (message: string) => void
}

/** What the card says about a job from the bookmarklet: it was filled in, or the link could not be read. */
type Notice = { kind: 'info'; host: string } | { kind: 'problem' }

function BookmarkIcon() {
  return (
    <svg className="callout__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5.5 3h9a.5.5 0 0 1 .5.5V17l-5-3.5L5 17V3.5a.5.5 0 0 1 .5-.5z" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="callout__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 3 18 17H2L10 3z" />
      <path d="M10 8.5v4M10 14.8v.1" />
    </svg>
  )
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
export function QuickAdd({ heading, cvField, cvId, incoming, onIncomingHandled, onSaved, onPasted, onAnnounce }: QuickAddProps) {
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
  const moreId = useId()
  const pastePanelId = useId()

  const companyRef = useRef<HTMLInputElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  const handledIncoming = useRef(0)

  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<ApplicationFieldError[]>([])
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteResult, setPasteResult] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  // The note about a job that came from the bookmarklet, until the user edits the link or saves.
  const [notice, setNotice] = useState<Notice | null>(null)
  // Goes up each time the primary button should get the focus (after a prefill).
  const [focusSave, setFocusSave] = useState(0)

  // Opening a panel moves focus into it, as the old disclosure did for the company field.
  useEffect(() => {
    if (moreOpen) companyRef.current?.focus()
  }, [moreOpen])
  useEffect(() => {
    if (pasteOpen) pasteRef.current?.focus()
  }, [pasteOpen])

  // Declared after the effect above, so when a prefill opens the panel the primary button wins the focus.
  useEffect(() => {
    if (focusSave > 0) saveRef.current?.focus()
  }, [focusSave])

  // A job from the bookmarklet replaces what is in the card: old values must not mix with the new ad.
  useEffect(() => {
    if (incoming === null || handledIncoming.current === incoming.id) return
    handledIncoming.current = incoming.id
    setErrors([])
    setDuplicate(null)
    if (incoming.result.kind === 'prefill') {
      const { link: nextLink, company: nextCompany, role: nextRole } = incoming.result.prefill
      setLink(nextLink)
      setCompany(nextCompany)
      setRole(nextRole)
      setNotes('')
      if (nextCompany !== '' || nextRole !== '') setMoreOpen(true)
      setNotice({ kind: 'info', host: hostOf(nextLink) ?? nextLink })
      setFocusSave((n) => n + 1)
    } else {
      setNotice({ kind: 'problem' })
      linkRef.current?.focus()
    }
    onIncomingHandled()
  }, [incoming, onIncomingHandled, t])

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
    const decision = decideQuickAdd({ company, url: link, target, cvId, allowDuplicate }, state.applications)
    if (decision.kind === 'invalid') {
      setErrors(decision.errors)
      setDuplicate(null)
      linkRef.current?.focus()
      return
    }
    setErrors([])
    if (decision.kind === 'duplicate') {
      setDuplicate({ existing: decision.existing, target })
      linkRef.current?.focus()
      return
    }

    const fields = { company, role, url: link, notes }
    const result = target === 'applied' ? actions.addAppliedApplication({ ...fields, cvId }) : actions.addApplication(fields)
    if (!result.ok) {
      // The decision above already passed, so the only way to get here is a CV that disappeared meanwhile.
      setErrors(result.error.filter((e): e is ApplicationFieldError => e !== 'unknown_cv'))
      return
    }
    setDuplicate(null)
    setNotice(null)
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
                setNotice(null)
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
          {/* Both live regions are always in the page, so text added later is announced. */}
          <div role="status" className="add__notice">
            {notice?.kind === 'info' && (
              <p className="callout callout--info">
                <BookmarkIcon />
                <span className="callout__text">
                  {t('quickAdd.fromBookmarklet')} {t('quickAdd.fromBookmarkletHost')} <strong>{notice.host}</strong>
                </span>
              </p>
            )}
          </div>
          <div role="alert" className="add__notice">
            {notice?.kind === 'problem' && (
              <p className="callout callout--problem">
                <WarningIcon />
                <span className="callout__text">{t('quickAdd.fromBookmarkletInvalid')}</span>
              </p>
            )}
          </div>
        </div>
        <div className="add__actions">
          <button ref={saveRef} type="submit" className="btn btn--primary">
            {t('quickAdd.saveToApply')}
          </button>
          <button type="button" className="btn" onClick={() => save('applied', false)}>
            {t('quickAdd.saveApplied')}
          </button>
          <button
            type="button"
            className="add__toggle"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? moreId : undefined}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {t('quickAdd.moreToggle')}
          </button>
          <button
            type="button"
            className="add__toggle"
            aria-expanded={pasteOpen}
            aria-controls={pasteOpen ? pastePanelId : undefined}
            onClick={() => setPasteOpen((open) => !open)}
          >
            {t('paste.summary')}
          </button>
        </div>

        {moreOpen && (
          <div id={moreId} className="add__more">
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
        )}
      </form>

      {pasteOpen && (
        <form id={pastePanelId} className="paste" onSubmit={onPaste}>
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
      )}
    </section>
  )
}
