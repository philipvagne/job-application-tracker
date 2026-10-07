import { markExported, resetState, setLanguage, setReminderDays, type AppState, type IsoDate, type Language } from '../domain'

export type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'setLanguage'; language: Language }
  | { type: 'setReminderDays'; days: number }
  | { type: 'markExported'; now: IsoDate }
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
    case 'reset':
      return resetState(state)
  }
}
