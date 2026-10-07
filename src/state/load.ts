import type { AppState, Language } from '../domain'
import { detectLanguage } from '../i18n'
import type { StateStore } from '../storage'

/** What the safety banners need to know about how loading went. */
export interface LoadStatus {
  /** False while data is only held in memory. */
  persistent: boolean
  /** Saved data was unreadable and the app started empty. */
  recovered: boolean
  /** A copy of the unreadable data was kept. */
  backedUp: boolean
  /** An unreadable-data copy exists, so it can be downloaded or cleared. */
  hasCorruptCopy: boolean
}

export interface Loaded {
  data: AppState
  status: LoadStatus
}

export interface LoadOptions {
  navigatorLanguage: string | undefined
  /** The language on screen now, kept when a reload finds nothing saved. */
  currentLanguage?: Language
}

/**
 * Loads through the store. On a first visit (nothing saved) or after an unreadable
 * load, the language is chosen from the browser setting; otherwise settings.language wins.
 */
export function loadApp(store: StateStore, options: LoadOptions): Loaded {
  const hadSavedState = store.hasSavedState()
  const result = store.loadState()
  const useDetected = !hadSavedState || result.recovered
  const language = useDetected
    ? (options.currentLanguage ?? detectLanguage(options.navigatorLanguage))
    : result.state.settings.language
  return {
    data: useDetected ? { ...result.state, settings: { ...result.state.settings, language } } : result.state,
    status: {
      persistent: result.persistent,
      recovered: result.recovered,
      backedUp: result.backedUp,
      hasCorruptCopy: store.getCorruptBackup() !== null,
    },
  }
}
