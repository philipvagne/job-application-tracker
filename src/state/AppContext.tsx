import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isBackupDue, type AppState, type Language } from '../domain'
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
