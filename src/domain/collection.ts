import { markApplied, type TransitionError } from './application'
import type { AppState, Application, IsoDate, Result } from './types'

export type CvError = 'name_required' | 'name_taken' | 'duplicate_id'

export type ApplyError = TransitionError | 'unknown_application' | 'unknown_cv'

/** Adds applications at the end of the list. */
export function addApplications(state: AppState, applications: readonly Application[]): AppState {
  if (applications.length === 0) return state
  return { ...state, applications: [...state.applications, ...applications] }
}

/** Swaps in an edited application with the same id. Unchanged state if the id is unknown. */
export function replaceApplication(state: AppState, application: Application): AppState {
  if (!state.applications.some((a) => a.id === application.id)) return state
  return {
    ...state,
    applications: state.applications.map((a) => (a.id === application.id ? application : a)),
  }
}

/** Removes the application with this id. Unchanged state if there is none. */
export function deleteApplication(state: AppState, id: string): AppState {
  if (!state.applications.some((a) => a.id === id)) return state
  return { ...state, applications: state.applications.filter((a) => a.id !== id) }
}

/**
 * Adds a CV. The name is trimmed and must be non-empty and unique, ignoring case.
 * Renaming and deleting CVs are not part of this version of the app yet.
 */
export function addCv(state: AppState, input: { id: string; name: string }): Result<AppState, CvError> {
  const name = input.name.trim()
  if (name === '') return { ok: false, error: 'name_required' }
  const lower = name.toLowerCase()
  if (state.cvs.some((cv) => cv.name.toLowerCase() === lower)) return { ok: false, error: 'name_taken' }
  if (state.cvs.some((cv) => cv.id === input.id)) return { ok: false, error: 'duplicate_id' }
  return { ok: true, value: { ...state, cvs: [...state.cvs, { id: input.id, name }] } }
}

/** Marks one application as applied with an existing CV, and remembers that CV as the last used. */
export function markApplicationApplied(
  state: AppState,
  id: string,
  cvId: string,
  now: IsoDate,
): Result<AppState, ApplyError> {
  const application = state.applications.find((a) => a.id === id)
  if (application === undefined) return { ok: false, error: 'unknown_application' }
  if (!state.cvs.some((cv) => cv.id === cvId)) return { ok: false, error: 'unknown_cv' }
  const result = markApplied(application, cvId, now)
  if (!result.ok) return result
  const next = replaceApplication(state, result.value)
  return { ok: true, value: { ...next, settings: { ...next.settings, lastCvId: cvId } } }
}
