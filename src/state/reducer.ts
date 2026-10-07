import {
  addApplications,
  addCv,
  deleteApplication,
  markApplicationApplied,
  markExported,
  replaceApplication,
  resetState,
  setLanguage,
  setReminderDays,
  type AppState,
  type Application,
  type IsoDate,
  type Language,
} from '../domain'

export type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'setLanguage'; language: Language }
  | { type: 'setReminderDays'; days: number }
  | { type: 'markExported'; now: IsoDate }
  | { type: 'addApplications'; applications: Application[] }
  | { type: 'replaceApplication'; application: Application }
  | { type: 'deleteApplication'; id: string }
  | { type: 'addCv'; id: string; name: string }
  | { type: 'markApplied'; id: string; cvId: string; now: IsoDate }
  | { type: 'reset' }

/**
 * The only way the app changes its data. Every case calls a domain function.
 * An action that changes nothing returns the same object, so callers can skip saving.
 */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'setLanguage':
      return state.settings.language === action.language ? state : setLanguage(state, action.language)
    case 'setReminderDays':
      return setReminderDays(state, action.days)
    case 'markExported':
      return markExported(state, action.now)
    case 'addApplications':
      return addApplications(state, action.applications)
    case 'replaceApplication':
      return replaceApplication(state, action.application)
    case 'deleteApplication':
      return deleteApplication(state, action.id)
    case 'addCv': {
      const result = addCv(state, { id: action.id, name: action.name })
      return result.ok ? result.value : state
    }
    case 'markApplied': {
      const result = markApplicationApplied(state, action.id, action.cvId, action.now)
      return result.ok ? result.value : state
    }
    case 'reset':
      return resetState(state)
  }
}
