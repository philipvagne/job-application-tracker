import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  MAX_CV_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  SELECTABLE_CLOSED_REASONS,
  applicationTitle,
  applicationsThisWeek,
  applicationsUsingCv,
  applicationsWithStatus,
  countsByStatus,
  defaultTab,
  effectiveSort,
  filterAndSortApplications,
  neighbourApplications,
  reopenTarget,
  shouldShowListControls,
  sortOptionsFor,
  tabAfterDataChange,
  suggestCvName,
  type Application,
  type ClosedReason,
  type Cv,
  type CvError,
  type SortKey,
  type Status,
} from '../domain'
import { useApp } from '../state/AppContext'
import type { UploadErrorCode } from '../storage'
import { AppliedRow, ClosedRow, ToApplyRow } from './ApplicationRows'
import { ConfirmDialog } from './ConfirmDialog'
import { CV_ADD_BUTTON_ID, CvPanel } from './CvPanel'
import { EditDialog } from './EditDialog'
import { NoteDialog } from './NoteDialog'
import { LIST_SEARCH_ID, ListControls } from './ListControls'
import { LINK_FIELD_ID, QuickAdd } from './QuickAdd'
import type { MenuAction } from './RowMenu'
import { SideNote } from './SideNote'
import { StatusTabs, tabId } from './StatusTabs'
import { Welcome } from './Welcome'

const ADD_CV = '__add_cv__'
const EMPTY_KEY = {
  to_apply: 'tracker.toApply.empty',
  applied: 'tracker.applied.empty',
  interview: 'tracker.interview.empty',
  offer: 'tracker.offer.empty',
  closed: 'tracker.closed.empty',
} as const
const MAX_FILE_MB = MAX_CV_FILE_BYTES / (1024 * 1024)

type FileErrorCode = Exclude<UploadErrorCode, 'name_required' | 'name_taken'>

type Confirm = { kind: 'close' | 'delete'; application: Application } | null

/** Quick add, the CV choice, the status tabs, the CV column and every dialog they open. */
export function Tracker() {
  const { t, language, state, preferences, filesAvailable, actions } = useApp()
  const { applications, cvs, settings } = state

  const cvSelectId = useId()
  const cvNameId = useId()
  const cvNameErrorId = useId()
  const cvFileId = useId()
  const cvFileHintId = useId()
  const cvFileErrorId = useId()
  const cvHelpId = useId()
  const reasonId = useId()
  const cvSelectRef = useRef<HTMLSelectElement>(null)
  const cvNameRef = useRef<HTMLInputElement>(null)
  const cvFileRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState('')
  // null: the user has not picked yet, so the last used CV is shown. '' is an explicit "No CV".
  const [pickedCvId, setPickedCvId] = useState<string | null>(null)
  // The inline form for adding a CV.
  const [cvFormOpen, setCvFormOpen] = useState(false)
  const [cvName, setCvName] = useState('')
  const [cvNameError, setCvNameError] = useState<CvError | null>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvFileError, setCvFileError] = useState<FileErrorCode | null>(null)
  const [cvBusy, setCvBusy] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [viewingNote, setViewingNote] = useState<Application | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  // The CV the user is about to delete, and why the last try failed, if it did.
  const [deletingCv, setDeletingCv] = useState<Cv | null>(null)
  const [deleteCvError, setDeleteCvError] = useState<'blocked' | 'save_failed' | 'unknown' | null>(null)
  const [deleteCvBusy, setDeleteCvBusy] = useState(false)
  const [closeReason, setCloseReason] = useState<ClosedReason>('no_reply')
  // DOM ids to try, in order, once the next render is done.
  const [focusIds, setFocusIds] = useState<string[]>([])
  // Which status tab is shown. Kept in memory only; the first tab is chosen once, from what exists.
  const [tab, setTab] = useState<Status>(() => defaultTab(applications))
  // With no applications the tab is always the first one (see tabAfterDataChange). Set during
  // render, so a stale tab from before "delete all my data" is never shown, not even for a frame.
  const resetTab = tabAfterDataChange(tab, applications)
  if (resetTab !== tab) setTab(resetTab)

  // The search text lives here, so it stays when the tab changes. The sort the user chose is
  // remembered as a preference (not user data); a tab it does not fit uses its own default.
  const [query, setQuery] = useState('')
  const [savedSort, setSavedSort] = useState<SortKey | null>(() => preferences.getSort())

  const now = new Date().toISOString()

  const counts = countsByStatus(applications)
  const sort = effectiveSort(tab, savedSort)
  const shown = filterAndSortApplications(applicationsWithStatus(applications, tab), { query, sort, language })
  const firstVisit = applications.length === 0 && cvs.length === 0
  const deletingCvCount = deletingCv === null ? 0 : applicationsUsingCv(applications, deletingCv.id)
  const weekCount = applicationsThisWeek(applications, now)

  // The CV in the picker: the one chosen (or "No CV"), else the last one used, if it still exists.
  const hasCv = (id: string): boolean => cvs.some((cv) => cv.id === id)
  const fallbackCvId = settings.lastCvId !== undefined && hasCv(settings.lastCvId) ? settings.lastCvId : ''
  const cvId = pickedCvId === null ? fallbackCvId : hasCv(pickedCvId) ? pickedCvId : ''

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
    if (cvFormOpen) cvNameRef.current?.focus()
  }, [cvFormOpen])

  useEffect(() => {
    if (message === '') return
    const timer = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  /** Empties the search. Focus goes to the search field, or to the tab if the controls hide now. */
  function clearQuery(): void {
    setQuery('')
    setFocusIds([LIST_SEARCH_ID, tabId(tab)])
  }

  /** The button in a row that focus can return to. */
  function focusIdOf(a: Application): string {
    return a.status === 'to_apply' ? `apply-${a.id}` : a.status === 'closed' ? `reopen-${a.id}` : `more-${a.id}`
  }

  /**
   * Where focus goes when a row leaves its tab: a neighbour's button in that tab, else the tab
   * itself, else the link field. Call it with the application as it was before the change.
   */
  function neighbourIds(application: Application): string[] {
    // The rows as the user sees them (searched and sorted), so focus lands on a row that is on screen.
    const list = application.status === tab ? shown : applicationsWithStatus(applications, application.status)
    const ids = neighbourApplications(list, application.id).map(focusIdOf)
    return [...ids, tabId(application.status), LINK_FIELD_ID]
  }

  /** Marks the row as applied with the CV in the picker; '' is "No CV". */
  function onApplied(application: Application): void {
    const next = neighbourIds(application)
    if (!actions.markApplied(application.id, cvId === '' ? null : cvId)) return
    setMessage(t('announce.markedApplied', { company: applicationTitle(application) }))
    setFocusIds(next)
  }

  function openCvForm(): void {
    setCvName('')
    setCvNameError(null)
    setCvFile(null)
    setCvFileError(null)
    setCvFormOpen(true)
  }

  function onCvSelect(value: string): void {
    if (value === ADD_CV) {
      openCvForm()
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
    setCvFormOpen(false)
    setCvFile(null)
    setMessage(t('announce.cvAdded', { name: created.name }))
    setFocusIds([cvSelectId, CV_ADD_BUTTON_ID])
  }

  function cancelCvForm(): void {
    setCvFormOpen(false)
    setCvNameError(null)
    setCvFileError(null)
    setCvFile(null)
    setFocusIds([cvSelectId, CV_ADD_BUTTON_ID])
  }

  function askDeleteCv(cv: Cv): void {
    setDeleteCvError(null)
    setDeletingCv(cv)
  }

  function closeDeleteCv(): void {
    setDeletingCv(null)
    setDeleteCvError(null)
  }

  async function confirmDeleteCv(): Promise<void> {
    if (deletingCv === null || deleteCvBusy) return
    const cv = deletingCv
    setDeleteCvBusy(true)
    const result = await actions.deleteCv(cv.id)
    setDeleteCvBusy(false)
    // A CV that is already gone (another tab removed it) counts as done.
    if (!result.ok && result.error !== 'unknown_cv') {
      setDeleteCvError(result.error === 'blocked' || result.error === 'save_failed' ? result.error : 'unknown')
      return
    }
    const affected = result.ok ? result.value.affected : 0
    closeDeleteCv()
    setMessage(
      affected > 0
        ? t('announce.cvDeletedLeft', { name: cv.name, count: affected })
        : t('announce.cvDeleted', { name: cv.name }),
    )
    setFocusIds([CV_ADD_BUTTON_ID, cvSelectId])
  }

  async function onOpenCv(cv: Cv): Promise<void> {
    const result = await actions.openCv(cv.id)
    if (result === 'ok') return
    setMessage(result === 'missing' ? t('cvFile.missing') : t('cvFile.openFailed'))
  }

  function moveTo(application: Application, to: Exclude<Status, 'closed'>): void {
    const result = actions.changeStatus(application.id, to)
    if (!result.ok) return
    setMessage(t('announce.movedTo', { status: t(`status.${to}`), company: applicationTitle(application) }))
    setFocusIds(neighbourIds(application))
  }

  function onMenu(application: Application, action: MenuAction): void {
    switch (action) {
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
      const next = neighbourIds(application)
      actions.deleteApplication(application.id)
      setMessage(t('announce.deleted', { company: applicationTitle(application) }))
      setFocusIds(next)
      return
    }
    const result = actions.changeStatus(application.id, 'closed', closeReason)
    if (!result.ok) return
    setMessage(t('announce.closed', { company: applicationTitle(application) }))
    setFocusIds(neighbourIds(application))
  }

  function onReopen(application: Application): void {
    const to: Status = reopenTarget(application)
    const next = neighbourIds(application)
    const result = actions.changeStatus(application.id, to)
    if (!result.ok) return
    setMessage(t('announce.reopened', { company: applicationTitle(application) }))
    setFocusIds(next)
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

  const cvFormNode =
    !cvFormOpen ? null : (
      <form className="cv-form" onSubmit={(e) => void onCvSubmit(e)} noValidate>
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
            className="input--file"
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
            {t('cv.save')}
          </button>
          <button type="button" className="btn" onClick={cancelCvForm}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    )

  // The CV for "Save as already applied" and for the next "mark as applied". Saving to To apply does not store it on the job.
  const cvFieldNode = (
    <div className="field">
      <label htmlFor={cvSelectId}>{t('quickAdd.cvLabel')}</label>
      <select
        id={cvSelectId}
        ref={cvSelectRef}
        className="input input--select"
        value={cvId}
        onChange={(e) => onCvSelect(e.target.value)}
        aria-describedby={cvHelpId}
      >
        <option value="">{t('quickAdd.noCv')}</option>
        {cvs.map((cv) => (
          <option key={cv.id} value={cv.id}>
            {cv.name}
          </option>
        ))}
        <option value={ADD_CV}>{t('cv.addOption')}</option>
      </select>
      <p id={cvHelpId} className="hint">
        {t('quickAdd.cvHelp')}
      </p>
    </div>
  )

  function renderRow(a: Application) {
    const common = {
      application: a,
      cvs,
      onMenu: (action: MenuAction) => onMenu(a, action),
      onOpenCv: (cv: Cv) => void onOpenCv(cv),
      onShowNote: setViewingNote,
    }
    if (a.status === 'to_apply') return <ToApplyRow key={a.id} {...common} onApplied={() => onApplied(a)} />
    if (a.status === 'closed') return <ClosedRow key={a.id} {...common} onReopen={() => onReopen(a)} />
    return <AppliedRow key={a.id} {...common} now={now} reminderDays={settings.reminderDays} />
  }

  return (
    <div className={firstVisit ? 'tracker tracker--welcome' : 'tracker'}>
      <p role="status" className="note tracker__status">
        {message}
      </p>

      {firstVisit && <Welcome cvForm={cvFormNode} onAddCv={openCvForm} />}

      <QuickAdd
        heading={firstVisit ? t('welcome.addTitle') : t('quickAdd.title')}
        cvField={cvFieldNode}
        cvId={cvId}
        onSaved={(application) => {
          setQuery('')
          setTab(application.status)
        }}
        onPasted={() => {
          setQuery('')
          setTab('to_apply')
        }}
        onAnnounce={setMessage}
      />

      {firstVisit ? (
        <p className="welcome__tip">{t('welcome.tip')}</p>
      ) : (
        <div className="layout">
          <div>
            {settings.showWeekSummary === true && <p className="week">{weekText}</p>}
            <StatusTabs selected={tab} onSelect={setTab} counts={counts}>
              {shouldShowListControls(counts[tab], query) && (
                <ListControls
                  query={query}
                  onQueryChange={setQuery}
                  onClear={clearQuery}
                  sort={sort}
                  sortOptions={sortOptionsFor(tab)}
                  onSortChange={(next) => {
                    setSavedSort(next)
                    preferences.setSort(next)
                  }}
                  resultCount={shown.length}
                />
              )}
              {counts[tab] === 0 ? (
                <p className="hint">{t(EMPTY_KEY[tab])}</p>
              ) : shown.length === 0 ? (
                <div className="list-empty">
                  <p className="hint">{t('list.noMatches')}</p>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={clearQuery}
                  >
                    {t('list.noMatchesClear')}
                  </button>
                </div>
              ) : (
                <ul className="rows">{shown.map(renderRow)}</ul>
              )}
            </StatusTabs>
          </div>
          <div className="side">
            <CvPanel
              cvs={cvs}
              applications={applications}
              onAdd={openCvForm}
              onOpenCv={(cv) => void onOpenCv(cv)}
              onDelete={askDeleteCv}
              form={cvFormNode}
            />
            <SideNote />
          </div>
        </div>
      )}

      <EditDialog
        application={editing}
        onClose={() => setEditing(null)}
        onSaved={(company) => setMessage(t('announce.saved', { company }))}
      />

      <NoteDialog application={viewingNote} onClose={() => setViewingNote(null)} />

      <ConfirmDialog
        open={deletingCv !== null}
        title={t('confirmCv.title')}
        body={
          deletingCv === null
            ? ''
            : t(
                deletingCvCount === 0
                  ? 'confirmCv.bodyNone'
                  : new Intl.PluralRules(language).select(deletingCvCount) === 'one'
                    ? 'confirmCv.bodyOne'
                    : 'confirmCv.bodyOther',
                { name: deletingCv.name, count: deletingCvCount },
              )
        }
        confirmLabel={t('confirmCv.button')}
        danger
        busy={deleteCvBusy}
        onConfirm={() => void confirmDeleteCv()}
        onCancel={closeDeleteCv}
      >
        <p>{deletingCv?.file !== undefined ? t('confirmCv.fileNote') : t('confirmCv.noFileNote')}</p>
        <p role="alert" className="error">
          {deleteCvError === null ? '' : t(`confirmCv.error.${deleteCvError}`)}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? t('confirmApp.delete.title') : t('confirmApp.close.title')}
        body={
          confirm === null
            ? ''
            : t(confirm.kind === 'delete' ? 'confirmApp.delete.body' : 'confirmApp.close.body', {
                company: applicationTitle(confirm.application),
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
              onChange={(e) =>
                setCloseReason(SELECTABLE_CLOSED_REASONS.find((r) => r === e.target.value) ?? 'no_reply')
              }
            >
              {SELECTABLE_CLOSED_REASONS.map((reason) => (
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
