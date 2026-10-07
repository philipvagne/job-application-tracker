import { useEffect, useId, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_SETTINGS,
  MAX_REMINDER_DAYS,
  MIN_REMINDER_DAYS,
  parseReminderDays,
  type AppState,
  type ImportError,
} from '../domain'
import { formatDate, formatImportError } from '../i18n'
import { useApp } from '../state/AppContext'
import { MAX_IMPORT_BYTES, readImportText } from '../storage'
import { ConfirmDialog } from './ConfirmDialog'
import { Dialog } from './Dialog'

const MAX_SHOWN_ERRORS = 5

type Message = 'exported' | 'imported' | 'deleted' | null

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { state, language, dict, t, actions } = useApp()
  const titleId = useId()
  const reminderId = useId()
  const reminderHintId = useId()
  const reminderErrorId = useId()
  const importId = useId()
  const importHintId = useId()

  const [draft, setDraft] = useState(String(state.settings.reminderDays))
  const [message, setMessage] = useState<Message>(null)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [importReadFailed, setImportReadFailed] = useState(false)
  const [pendingImport, setPendingImport] = useState<AppState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  // Start from a clean slate each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setDraft(String(state.settings.reminderDays))
    setMessage(null)
    setImportErrors([])
    setImportReadFailed(false)
    setDeleteFailed(false)
    // Only when it opens; typing must not be overwritten by saved values.
  }, [open])

  const reminderInvalid = parseReminderDays(draft) === null
  const range = { min: MIN_REMINDER_DAYS, max: MAX_REMINDER_DAYS }

  function onReminderChange(event: ChangeEvent<HTMLInputElement>): void {
    const text = event.target.value
    setDraft(text)
    const days = parseReminderDays(text)
    if (days !== null) actions.setReminderDays(days)
  }

  function startImport(next: AppState): void {
    const hasData = state.applications.length > 0 || state.cvs.length > 0
    if (hasData) {
      setPendingImport(next)
    } else {
      actions.replaceState(next)
      setMessage('imported')
    }
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.target
    const file = input.files?.[0]
    input.value = '' // so choosing the same file again still triggers a change
    if (file === undefined) return
    setMessage(null)
    setImportErrors([])
    setImportReadFailed(false)

    if (file.size > MAX_IMPORT_BYTES) {
      setImportErrors([{ code: 'too_large', path: '$', params: { maxBytes: MAX_IMPORT_BYTES } }])
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setImportReadFailed(true)
      return
    }
    const result = readImportText(text)
    if (result.ok) startImport(result.state)
    else setImportErrors(result.errors)
  }

  function confirmImport(): void {
    if (pendingImport !== null) {
      actions.replaceState(pendingImport)
      setMessage('imported')
    }
    setPendingImport(null)
  }

  function confirmDeleteAll(): void {
    setConfirmDelete(false)
    if (actions.deleteAllData()) {
      setDeleteFailed(false)
      setMessage('deleted')
      setDraft(String(DEFAULT_SETTINGS.reminderDays))
    } else {
      setDeleteFailed(true)
    }
  }

  const lastExport = state.settings.lastExportAt
  const importFailed = importErrors.length > 0 || importReadFailed
  const messageText =
    message === 'exported'
      ? t('settings.backup.exported')
      : message === 'imported'
        ? t('settings.import.success')
        : message === 'deleted'
          ? t('settings.delete.done')
          : ''

  return (
    <>
      <Dialog open={open} onClose={onClose} titleId={titleId}>
        <h2 id={titleId} className="dialog__title">
          {t('settings.title')}
        </h2>

        <p role="status" className="note note--ok">
          {messageText}
        </p>

        <section className="section" aria-labelledby={`${reminderId}-h`}>
          <h3 id={`${reminderId}-h`}>{t('settings.reminder.title')}</h3>
          <div className="field">
            <label htmlFor={reminderId}>{t('settings.reminder.label')}</label>
            <input
              id={reminderId}
              className="input input--short"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={onReminderChange}
              aria-invalid={reminderInvalid}
              aria-describedby={reminderInvalid ? `${reminderHintId} ${reminderErrorId}` : reminderHintId}
            />
            <p id={reminderHintId} className="hint">
              {t('settings.reminder.hint', range)}
            </p>
            <p id={reminderErrorId} className="error" aria-live="polite">
              {reminderInvalid ? t('settings.reminder.error', range) : ''}
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby={`${importId}-backup`}>
          <h3 id={`${importId}-backup`}>{t('settings.backup.title')}</h3>
          <p className="hint">
            {lastExport === undefined
              ? t('settings.backup.neverExported')
              : t('settings.backup.lastExport', { date: formatDate(lastExport, language) })}
          </p>
          <p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                actions.exportBackup()
                setMessage('exported')
              }}
            >
              {t('common.export')}
            </button>
          </p>

          <div className="field">
            <label htmlFor={importId}>{t('settings.import.label')}</label>
            <input
              id={importId}
              className="input"
              type="file"
              accept=".json,application/json"
              aria-describedby={importHintId}
              onChange={(e) => void onFileChosen(e)}
            />
            <p id={importHintId} className="hint">
              {t('settings.import.hint')}
            </p>
          </div>
          {importFailed && (
            <div role="alert" className="error-box">
              <p>
                <strong>{t('settings.import.failedTitle')}</strong>
              </p>
              {importReadFailed && <p>{t('settings.import.readFailed')}</p>}
              {importErrors.length > 0 && (
                <ul>
                  {importErrors.slice(0, MAX_SHOWN_ERRORS).map((error, i) => (
                    <li key={i}>{formatImportError(error, dict)}</li>
                  ))}
                  {importErrors.length > MAX_SHOWN_ERRORS && (
                    <li>{t('settings.import.more', { count: importErrors.length - MAX_SHOWN_ERRORS })}</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="section" aria-labelledby={`${importId}-delete`}>
          <h3 id={`${importId}-delete`}>{t('settings.delete.title')}</h3>
          <p>{t('settings.delete.body')}</p>
          <p>
            <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
              {t('settings.delete.button')}
            </button>
          </p>
          {deleteFailed && (
            <p role="alert" className="error-box">
              {t('settings.delete.failed')}
            </p>
          )}
        </section>

        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pendingImport !== null}
        title={t('confirm.replace.title')}
        body={t('confirm.replace.body')}
        confirmLabel={t('confirm.replace.button')}
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('confirm.delete.title')}
        body={t('confirm.delete.body')}
        confirmLabel={t('confirm.delete.button')}
        onConfirm={confirmDeleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
