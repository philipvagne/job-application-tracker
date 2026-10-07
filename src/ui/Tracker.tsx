import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  CLOSED_REASONS,
  MAX_CV_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  applicationsThisWeek,
  suggestCvName,
  type Application,
  type ClosedReason,
  type Cv,
  type CvError,
  type Status,
} from '../domain'
import { useApp } from '../state/AppContext'
import type { UploadErrorCode } from '../storage'
import { AppliedRow, ClosedRow, ToApplyRow } from './ApplicationRows'
import { ConfirmDialog } from './ConfirmDialog'
import { EditDialog } from './EditDialog'
import { COMPANY_FIELD_ID, QuickAdd } from './QuickAdd'
import type { MenuAction } from './RowMenu'

const ADD_CV = '__add_cv__'
const CV_ADD_BUTTON_ID = 'cv-add-button'
const MAX_FILE_MB = MAX_CV_FILE_BYTES / (1024 * 1024)

type FileErrorCode = Exclude<UploadErrorCode, 'name_required' | 'name_taken'>

type Confirm = { kind: 'close' | 'delete'; application: Application } | null

/** Quick add, the CV choice, the three lists and every dialog they open. */
export function Tracker() {
  const { t, language, state, filesAvailable, actions } = useApp()
  const { applications, cvs, settings } = state

  const cvSelectId = useId()
  const cvErrorId = useId()
  const cvNameId = useId()
  const cvNameErrorId = useId()
  const cvFileId = useId()
  const cvFileHintId = useId()
  const cvFileErrorId = useId()
  const reasonId = useId()
  const cvSelectRef = useRef<HTMLSelectElement>(null)
  const cvNameRef = useRef<HTMLInputElement>(null)
  const cvFileRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState('')
  const [pickedCvId, setPickedCvId] = useState('')
  const [cvSelectError, setCvSelectError] = useState(false)
  // The inline CV form. `applyId` is the application waiting for a first CV, if any.
  const [cvForm, setCvForm] = useState<{ applyId: string | null } | null>(null)
  const [cvName, setCvName] = useState('')
  const [cvNameError, setCvNameError] = useState<CvError | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvFileError, setCvFileError] = useState<FileErrorCode | null>(null)
  const [cvBusy, setCvBusy] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [closeReason, setCloseReason] = useState<ClosedReason>('no_reply')
  // DOM ids to try, in order, once the next render is done.
  const [focusIds, setFocusIds] = useState<string[]>([])

  const now = new Date().toISOString()

  const toApply = applications.filter((a) => a.status === 'to_apply')
  const applied = applications.filter((a) => a.status === 'applied' || a.status === 'interview' || a.status === 'offer')
  const closed = applications.filter((a) => a.status === 'closed')
  const weekCount = applicationsThisWeek(applications, now)

  // The CV in the picker: the one chosen, else the last one used, if it still exists.
  const hasCv = (id: string): boolean => cvs.some((cv) => cv.id === id)
  const cvId = hasCv(pickedCvId) ? pickedCvId : settings.lastCvId !== undefined && hasCv(settings.lastCvId) ? settings.lastCvId : ''

  useEffect(() => {
    if (focusIds.length === 0) return
    for (const id of focusIds) {
      const element = document.getElementById(id)
      if (element !== null) {
        element.focus()
        break
      }
    }
    setFocusIds([])
  }, [focusIds])

  useEffect(() => {
    if (cvForm !== null) cvNameRef.current?.focus()
  }, [cvForm])

  useEffect(() => {
    if (message === '') return
    const timer = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  /** Where focus goes when a row leaves its list: the neighbour's button, else the Company field. */
  function neighbourIds(list: Application[], application: Application, idOf: (a: Application) => string): string[] {
    const i = list.findIndex((a) => a.id === application.id)
    const ids = [list[i + 1], list[i - 1]].filter((a): a is Application => a !== undefined).map(idOf)
    return [...ids, COMPANY_FIELD_ID]
  }

  function applyNow(application: Application, chosenCvId: string): void {
    const next = neighbourIds(toApply, application, (a) => `apply-${a.id}`)
    if (!actions.markApplied(application.id, chosenCvId)) return
    setMessage(t('announce.markedApplied', { company: application.company }))
    setFocusIds(next)
  }

  function openCvForm(applyId: string | null): void {
    setCvName('')
    setCvNameError(null)
    setCvFile(null)
    setCvFileError(null)
    setCvForm({ applyId })
  }

  function onApplied(application: Application): void {
    if (cvs.length === 0) {
      openCvForm(application.id)
      return
    }
    if (cvId === '') {
      setCvSelectError(true)
      cvSelectRef.current?.focus()
      return
    }
    applyNow(application, cvId)
  }

  function onCvSelect(value: string): void {
    setCvSelectError(false)
    if (value === ADD_CV) {
      openCvForm(null)
      return
    }
    setPickedCvId(value)
  }

  function onCvFileChange(file: File | null): void {
    setCvFile(file)
    setCvFileError(null)
    if (file !== null && cvName.trim() === '') setCvName(suggestCvName(file.name))
  }

  async function onCvSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (cvBusy) return
    const pending = cvForm?.applyId ?? null
    setCvNameError(null)
    setCvFileError(null)

    let created: { id: string; name: string }
    if (cvFile !== null) {
      setCvBusy(true)
      const result = await actions.uploadCv(cvFile, cvName)
      setCvBusy(false)
      if (!result.ok) {
        if (result.error === 'name_required' || result.error === 'name_taken') {
          setCvNameError(result.error)
          cvNameRef.current?.focus()
        } else {
          setCvFileError(result.error)
          cvFileRef.current?.focus()
        }
        return
      }
      created = result.value
    } else {
      const result = actions.addCv(cvName)
      if (!result.ok) {
        setCvNameError(result.error === 'duplicate_id' ? 'name_taken' : result.error)
        cvNameRef.current?.focus()
        return
      }
      created = result.value
    }

    setPickedCvId(created.id)
    setCvSelectError(false)
    setCvForm(null)
    setCvFile(null)
    const waiting = pending === null ? undefined : applications.find((a) => a.id === pending)
    if (waiting !== undefined) {
      applyNow(waiting, created.id)
    } else {
      setMessage(t('announce.cvAdded', { name: created.name }))
      setFocusIds([cvSelectId, CV_ADD_BUTTON_ID])
    }
  }

  function cancelCvForm(): void {
    const pending = cvForm?.applyId ?? null
    setCvForm(null)
    setCvNameError(null)
    setCvFileError(null)
    setCvFile(null)
    setFocusIds(pending === null ? [cvSelectId, CV_ADD_BUTTON_ID] : [`apply-${pending}`])
  }

  async function onOpenCv(cv: Cv): Promise<void> {
    const result = await actions.openCv(cv.id)
    if (result === 'ok') return
    setMessage(result === 'missing' ? t('cvFile.missing') : t('cvFile.openFailed'))
  }

  function moveTo(application: Application, to: Exclude<Status, 'closed'>): void {
    const result = actions.changeStatus(application.id, to)
    if (!result.ok) return
    setMessage(t('announce.movedTo', { status: t(`status.${to}`), company: application.company }))
    setFocusIds([`more-${application.id}`])
  }

  function onMenu(application: Application, action: MenuAction): void {
    switch (action) {
      case 'reply':
        if (actions.markReplied(application.id)) {
          setMessage(t('announce.replied', { company: application.company }))
        }
        setFocusIds([`more-${application.id}`])
        return
      case 'toInterview':
        moveTo(application, 'interview')
        return
      case 'toOffer':
        moveTo(application, 'offer')
        return
      case 'back':
        moveTo(application, application.status === 'offer' ? 'interview' : application.status === 'interview' ? 'applied' : 'to_apply')
        return
      case 'close':
        setCloseReason('no_reply')
        setConfirm({ kind: 'close', application })
        return
      case 'edit':
        setEditing(application)
        return
      case 'delete':
        setConfirm({ kind: 'delete', application })
        return
    }
  }

  function confirmAction(): void {
    if (confirm === null) return
    const { kind, application } = confirm
    setConfirm(null)
    if (kind === 'delete') {
      const list = application.status === 'to_apply' ? toApply : application.status === 'closed' ? closed : applied
      const idOf =
        application.status === 'to_apply'
          ? (a: Application) => `apply-${a.id}`
          : application.status === 'closed'
            ? (a: Application) => `reopen-${a.id}`
            : (a: Application) => `more-${a.id}`
      const next = neighbourIds(list, application, idOf)
      actions.deleteApplication(application.id)
      setMessage(t('announce.deleted', { company: application.company }))
      setFocusIds(next)
      return
    }
    const result = actions.changeStatus(application.id, 'closed', closeReason)
    if (!result.ok) return
    setMessage(t('announce.closed', { company: application.company }))
    setFocusIds(['closed-summary', ...neighbourIds(applied, application, (a) => `more-${a.id}`)])
  }

  function onReopen(application: Application): void {
    const to: Status = application.appliedAt !== undefined ? 'applied' : 'to_apply'
    const next = neighbourIds(closed, application, (a) => `reopen-${a.id}`)
    const result = actions.changeStatus(application.id, to)
    if (!result.ok) return
    setMessage(t('announce.reopened', { company: application.company }))
    setFocusIds([to === 'applied' ? `more-${application.id}` : `apply-${application.id}`, ...next])
  }

  const weekText = t(new Intl.PluralRules(language).select(weekCount) === 'one' ? 'tracker.week.one' : 'tracker.week.other', {
    count: weekCount,
  })
  const cvNameErrorText =
    cvNameError === 'name_taken' ? t('cv.nameTaken') : cvNameError === null ? '' : t('cv.nameRequired')
  const cvFileErrorText =
    cvFileError === null
      ? ''
      : t(`cvFile.error.${cvFileError}`, { max: cvFileError === 'name_too_long' ? MAX_FILE_NAME_LENGTH : MAX_FILE_MB })

  return (
    <div className="tracker">
      <p role="status" className="note tracker__status">
        {message}
      </p>

      <QuickAdd onAnnounce={setMessage} />

      <p className="week">{weekText}</p>

      <section className="cv-picker" aria-label={t('cv.label')}>
        {cvs.length > 0 ? (
          <div className="field">
            <label htmlFor={cvSelectId}>{t('cv.label')}</label>
            <select
              id={cvSelectId}
              ref={cvSelectRef}
              className="input input--select"
              value={cvId}
              onChange={(e) => onCvSelect(e.target.value)}
              aria-invalid={cvSelectError}
              aria-describedby={cvSelectError ? cvErrorId : undefined}
            >
              {cvId === '' && <option value="">{t('cv.choose')}</option>}
              {cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.name}
                </option>
              ))}
              <option value={ADD_CV}>{t('cv.addOption')}</option>
            </select>
            <p id={cvErrorId} className="error">
              {cvSelectError ? t('cv.required') : ''}
            </p>
          </div>
        ) : (
          cvForm === null && (
            <>
              <p className="hint">{t('cv.none')}</p>
              <button type="button" id={CV_ADD_BUTTON_ID} className="btn" onClick={() => openCvForm(null)}>
                {t('cv.addOption')}
              </button>
            </>
          )
        )}

        {cvForm !== null && (
          <form className="cv-form" onSubmit={(e) => void onCvSubmit(e)} noValidate>
            {cvForm.applyId !== null && cvs.length === 0 && <p>{t('cv.firstPrompt')}</p>}
            <div className="field">
              <label htmlFor={cvNameId}>{t('cv.nameLabel')}</label>
              <input
                id={cvNameId}
                ref={cvNameRef}
                className="input"
                type="text"
                autoComplete="off"
                value={cvName}
                onChange={(e) => setCvName(e.target.value)}
                aria-invalid={cvNameError !== null}
                aria-describedby={cvNameError !== null ? cvNameErrorId : undefined}
              />
              <p id={cvNameErrorId} className="error">
                {cvNameErrorText}
              </p>
            </div>
            <div className="field">
              <label htmlFor={cvFileId}>{t('cvFile.attach')}</label>
              <input
                id={cvFileId}
                ref={cvFileRef}
                className="input"
                type="file"
                accept=".pdf,application/pdf"
                disabled={!filesAvailable}
                onChange={(e) => onCvFileChange(e.target.files?.[0] ?? null)}
                aria-invalid={cvFileError !== null}
                aria-describedby={cvFileError !== null ? `${cvFileHintId} ${cvFileErrorId}` : cvFileHintId}
              />
              <p id={cvFileHintId} className="hint">
                {filesAvailable ? t('cvFile.hint', { max: MAX_FILE_MB }) : t('cvFile.unavailable')}
              </p>
              <p id={cvFileErrorId} className="error">
                {cvFileErrorText}
              </p>
            </div>
            <div className="cv-form__actions">
              <button type="submit" className="btn btn--primary" disabled={cvBusy}>
                {cvForm.applyId !== null ? t('cv.saveAndApply') : t('cv.save')}
              </button>
              <button type="button" className="btn" onClick={cancelCvForm}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </section>

      {applications.length === 0 ? (
        <section className="empty" aria-labelledby="empty-title">
          <h2 id="empty-title">{t('empty.title')}</h2>
          <p>{t('empty.body')}</p>
        </section>
      ) : (
        <>
          <section className="list-section" aria-labelledby="to-apply-title">
            <h2 id="to-apply-title">{t('tracker.toApply.title')}</h2>
            {toApply.length === 0 ? (
              <p className="hint">{t('tracker.toApply.empty')}</p>
            ) : (
              <ul className="rows">
                {toApply.map((a) => (
                  <ToApplyRow
                    key={a.id}
                    application={a}
                    cvs={cvs}
                    onApplied={() => onApplied(a)}
                    onMenu={(action) => onMenu(a, action)}
                    onOpenCv={(cv) => void onOpenCv(cv)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="list-section" aria-labelledby="applied-title">
            <h2 id="applied-title">{t('tracker.applied.title')}</h2>
            {applied.length === 0 ? (
              <p className="hint">{t('tracker.applied.empty')}</p>
            ) : (
              <ul className="rows">
                {applied.map((a) => (
                  <AppliedRow
                    key={a.id}
                    application={a}
                    cvs={cvs}
                    now={now}
                    onMenu={(action) => onMenu(a, action)}
                    onOpenCv={(cv) => void onOpenCv(cv)}
                  />
                ))}
              </ul>
            )}
          </section>

          {closed.length > 0 && (
            <details className="closed">
              <summary id="closed-summary" className="closed__summary">
                {t('tracker.closed.title', { count: closed.length })}
              </summary>
              <ul className="rows">
                {closed.map((a) => (
                  <ClosedRow
                    key={a.id}
                    application={a}
                    cvs={cvs}
                    onReopen={() => onReopen(a)}
                    onMenu={(action) => onMenu(a, action)}
                    onOpenCv={(cv) => void onOpenCv(cv)}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <EditDialog
        application={editing}
        onClose={() => setEditing(null)}
        onSaved={(company) => setMessage(t('announce.saved', { company }))}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? t('confirmApp.delete.title') : t('confirmApp.close.title')}
        body={
          confirm === null
            ? ''
            : t(confirm.kind === 'delete' ? 'confirmApp.delete.body' : 'confirmApp.close.body', {
                company: confirm.application.company,
              })
        }
        confirmLabel={confirm?.kind === 'delete' ? t('confirmApp.delete.button') : t('confirmApp.close.button')}
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === 'close' && (
          <div className="field">
            <label htmlFor={reasonId}>{t('confirmApp.close.reason')}</label>
            <select
              id={reasonId}
              className="input input--select"
              value={closeReason}
              onChange={(e) => setCloseReason(CLOSED_REASONS.find((r) => r === e.target.value) ?? 'no_reply')}
            >
              {CLOSED_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(`closedReason.${reason}`)}
                </option>
              ))}
            </select>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
