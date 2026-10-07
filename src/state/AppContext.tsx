import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  addCv,
  changeStatus,
  isBackupDue,
  markReplied,
  newApplication,
  parsePastedList,
  updateApplication,
  type AppState,
  type Application,
  type ApplicationChanges,
  type ApplicationFieldError,
  type ClosedReason,
  type CvError,
  type Language,
  type Result,
  type Status,
  type TransitionError,
} from '../domain'
import { dictionaries, t as translate, type Dict, type Params, type TextKey } from '../i18n'
import { CORRUPT_BACKUP_KEY, STATE_KEY, buildExportFile, type SaveErrorCode, type StateStore } from '../storage'
import { downloadTextFile } from '../ui/download'
import { loadApp, type LoadStatus, type Loaded } from './load'
import { reducer, type Action } from './reducer'

export interface AppContextValue {
  state: AppState
  language: Language
  dict: Dict
  t: (key: TextKey, params?: Params) => string
  status: LoadStatus
  /** Set when the last save failed. Cleared by the next successful save or by dismissing. */
  saveError: SaveErrorCode | null
  backupDue: boolean
  actions: {
    setLanguage(language: Language): void
    setReminderDays(days: number): void
    /** Replaces everything with an imported, already validated state. */
    replaceState(state: AppState): void
    exportBackup(): void
    /** Returns false if the data could not be removed. */
    deleteAllData(): boolean
    downloadUnreadable(): void
    clearUnreadable(): void
    dismissSaveError(): void
    dismissBackupReminder(): void
    /** Adds a to-apply application. Fails, changing nothing, if company or link is not acceptable. */
    addApplication(input: { company: string; role: string; url: string }): Result<Application, ApplicationFieldError[]>
    /** Adds every usable line of pasted text. Returns how many were added and how many lines were skipped. */
    addPasted(text: string): { added: number; skipped: number }
    editApplication(id: string, changes: ApplicationChanges): Result<Application, ApplicationFieldError[]>
    deleteApplication(id: string): void
    /** Adds a CV and returns it. Fails if the name is empty or already used. */
    addCv(name: string): Result<{ id: string; name: string }, CvError>
    /** Marks a to-apply application as applied with this CV, and remembers the CV. */
    markApplied(id: string, cvId: string): boolean
    markReplied(id: string): boolean
    changeStatus(id: string, to: Status, closedReason?: ClosedReason): Result<Application, TransitionError | 'unknown_application'>
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (value === null) throw new Error('useApp must be used inside AppProvider')
  return value
}

interface AppProviderProps {
  store: StateStore
  /** Loaded once, before the first render (not in an effect, so StrictMode cannot load twice). */
  initial: Loaded
  children: ReactNode
}

const nowIso = (): string => new Date().toISOString()

export function AppProvider({ store, initial, children }: AppProviderProps) {
  const [state, setState] = useState(initial.data)
  const [status, setStatus] = useState(initial.status)
  const [saveError, setSaveError] = useState<SaveErrorCode | null>(null)
  const [reminderDismissed, setReminderDismissed] = useState(false)
  // The latest state, readable from event handlers without waiting for a re-render.
  const stateRef = useRef(state)
  const statusRef = useRef(status)

  const showState = useCallback((next: AppState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const showStatus = useCallback((next: LoadStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const persist = useCallback(
    (next: AppState) => {
      const result = store.saveState(next)
      if (result.ok) {
        setSaveError(null)
        if (result.persistent !== statusRef.current.persistent) {
          showStatus({ ...statusRef.current, persistent: result.persistent })
        }
      } else {
        setSaveError(result.code)
      }
    },
    [store, showStatus],
  )

  const commit = useCallback(
    (action: Action) => {
      const next = reducer(stateRef.current, action)
      if (next === stateRef.current) return
      showState(next)
      persist(next)
    },
    [showState, persist],
  )

  // Another tab changed storage: load what it saved. Storage events never fire in the tab
  // that made the change. While data is only held in memory there is nothing on disk to follow.
  useEffect(() => {
    function onStorage(event: StorageEvent): void {
      if (event.key !== null && event.key !== STATE_KEY && event.key !== CORRUPT_BACKUP_KEY) return
      if (!statusRef.current.persistent) return
      const loaded = loadApp(store, {
        navigatorLanguage: navigator.language,
        currentLanguage: stateRef.current.settings.language,
      })
      showState(loaded.data)
      showStatus(loaded.status)
      setSaveError(null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [store, showState, showStatus])

  const language = state.settings.language
  const dict = dictionaries[language]
  const t = useCallback((key: TextKey, params?: Params) => translate(dict, key, params), [dict])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(dict, 'app.title')
  }, [language, dict])

  const actions = useMemo<AppContextValue['actions']>(
    () => ({
      setLanguage: (next) => commit({ type: 'setLanguage', language: next }),
      setReminderDays: (days) => commit({ type: 'setReminderDays', days }),
      replaceState: (next) => commit({ type: 'replace', state: next }),

      exportBackup() {
        const now = nowIso()
        const file = buildExportFile(stateRef.current, now)
        downloadTextFile(file.filename, file.content, 'application/json')
        commit({ type: 'markExported', now })
      },

      deleteAllData() {
        const result = store.clearAllData()
        if (!result.ok) return false
        const empty = reducer(stateRef.current, { type: 'reset' })
        showState(empty)
        showStatus({ ...statusRef.current, recovered: false, backedUp: false, hasCorruptCopy: false })
        setSaveError(null)
        // Keeps the chosen language across a reload and reports whether saving works again.
        persist(empty)
        return true
      },

      downloadUnreadable() {
        const raw = store.getCorruptBackup()
        if (raw !== null) downloadTextFile('job-tracker-unreadable-data.txt', raw, 'text/plain')
      },

      clearUnreadable() {
        store.clearCorruptBackup()
        if (store.getCorruptBackup() !== null) {
          showStatus({ ...statusRef.current, hasCorruptCopy: true })
          return // The copy could not be removed; the banner stays.
        }
        if (statusRef.current.backedUp) {
          // The user chose to discard it: write over the unreadable data still on disk.
          showStatus({ ...statusRef.current, recovered: false, backedUp: false, hasCorruptCopy: false })
          persist(stateRef.current)
          return
        }
        // Newer unreadable data was being protected. Loading again keeps a copy of it, and
        // the session's changes stay on screen until the user decides about that copy too.
        const loaded = loadApp(store, {
          navigatorLanguage: navigator.language,
          currentLanguage: stateRef.current.settings.language,
        })
        if (!loaded.status.recovered) showState(loaded.data)
        showStatus(loaded.status)
      },

      dismissSaveError: () => setSaveError(null),
      dismissBackupReminder: () => setReminderDismissed(true),

      // Ids and times are made here, in the UI layer. The domain never creates them.
      addApplication(input) {
        const result = newApplication({ id: crypto.randomUUID(), ...input }, nowIso())
        if (result.ok) commit({ type: 'addApplications', applications: [result.value] })
        return result
      },

      addPasted(text) {
        const { items, skipped } = parsePastedList(text)
        const now = nowIso()
        const applications: Application[] = []
        for (const item of items) {
          const result = newApplication({ id: crypto.randomUUID(), ...item }, now)
          if (result.ok) applications.push(result.value)
        }
        commit({ type: 'addApplications', applications })
        return { added: applications.length, skipped: skipped + (items.length - applications.length) }
      },

      editApplication(id, changes) {
        const current = stateRef.current.applications.find((a) => a.id === id)
        if (current === undefined) return { ok: false, error: [] }
        const result = updateApplication(current, changes)
        if (result.ok) commit({ type: 'replaceApplication', application: result.value })
        return result
      },

      deleteApplication: (id) => commit({ type: 'deleteApplication', id }),

      addCv(name) {
        const id = crypto.randomUUID()
        const result = addCv(stateRef.current, { id, name })
        if (!result.ok) return result
        commit({ type: 'addCv', id, name })
        return { ok: true, value: { id, name: name.trim() } }
      },

      markApplied(id, cvId) {
        const before = stateRef.current
        commit({ type: 'markApplied', id, cvId, now: nowIso() })
        return stateRef.current !== before
      },

      markReplied(id) {
        const current = stateRef.current.applications.find((a) => a.id === id)
        if (current === undefined) return false
        const result = markReplied(current, nowIso())
        if (!result.ok) return false
        commit({ type: 'replaceApplication', application: result.value })
        return true
      },

      changeStatus(id, to, closedReason) {
        const current = stateRef.current.applications.find((a) => a.id === id)
        if (current === undefined) return { ok: false, error: 'unknown_application' }
        const result = changeStatus(current, to, nowIso(), closedReason)
        if (result.ok) commit({ type: 'replaceApplication', application: result.value })
        return result
      },
    }),
    [commit, persist, showState, showStatus, store],
  )

  const backupDue = !reminderDismissed && isBackupDue(state, nowIso())

  const value = useMemo<AppContextValue>(
    () => ({ state, language, dict, t, status, saveError, backupDue, actions }),
    [state, language, dict, t, status, saveError, backupDue, actions],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
