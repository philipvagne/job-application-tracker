import { markApplied, type TransitionError } from './application'
import type { AppState, Application, Cv, CvFile, IsoDate, Result } from './types'

export type CvError = 'name_required' | 'name_taken' | 'duplicate_id'

export type ApplyError = TransitionError | 'unknown_application' | 'unknown_cv'

/** Adds applications at the end of the list. */
export function addApplications(state: AppState, applications: readonly Application[]): AppState {
  if (applications.length === 0) return state
  return { ...state, applications: [...state.applications, ...applications] }
}

/**
 * Adds an application that is already applied, and remembers its CV (if it has one) as the
 * last used. Refused, changing nothing, if it is not applied, has no appliedAt, or its CV
 * is given but does not exist.
 */
export function addAppliedApplication(
  state: AppState,
  application: Application,
): Result<AppState, 'not_applied' | 'unknown_cv'> {
  if (application.status !== 'applied' || application.appliedAt === undefined) {
    return { ok: false, error: 'not_applied' }
  }
  const cvId = application.cvId
  if (cvId !== undefined && !state.cvs.some((cv) => cv.id === cvId)) return { ok: false, error: 'unknown_cv' }
  const next = addApplications(state, [application])
  if (cvId === undefined) return { ok: true, value: next }
  return { ok: true, value: { ...next, settings: { ...next.settings, lastCvId: cvId } } }
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
export function addCv(
  state: AppState,
  input: { id: string; name: string; file?: CvFile; now?: IsoDate },
): Result<AppState, CvError> {
  const name = input.name.trim()
  if (name === '') return { ok: false, error: 'name_required' }
  const lower = name.toLowerCase()
  if (state.cvs.some((cv) => cv.name.toLowerCase() === lower)) return { ok: false, error: 'name_taken' }
  if (state.cvs.some((cv) => cv.id === input.id)) return { ok: false, error: 'duplicate_id' }
  const cv: Cv = { id: input.id, name }
  if (input.now !== undefined) cv.createdAt = input.now
  if (input.file !== undefined) cv.file = { ...input.file }
  return { ok: true, value: { ...state, cvs: [...state.cvs, cv] } }
}

export type LinkCvError = 'unknown_application' | 'unknown_cv'

/**
 * Links an application to a CV entry, or removes the link with null (no CV), also after it
 * has been sent. Changing the link after applying is allowed; the per-CV statistics then
 * follow the new CV.
 */
export function linkCv(
  state: AppState,
  applicationId: string,
  cvId: string | null,
): Result<AppState, LinkCvError> {
  const application = state.applications.find((a) => a.id === applicationId)
  if (application === undefined) return { ok: false, error: 'unknown_application' }
  if (cvId === null) {
    if (application.cvId === undefined) return { ok: true, value: state }
    const { cvId: _removed, ...rest } = application
    return { ok: true, value: replaceApplication(state, rest) }
  }
  if (!state.cvs.some((cv) => cv.id === cvId)) return { ok: false, error: 'unknown_cv' }
  if (application.cvId === cvId) return { ok: true, value: state }
  return { ok: true, value: replaceApplication(state, { ...application, cvId }) }
}

/**
 * Marks one application as applied with an existing CV, or with null for no CV. A CV is
 * remembered as the last used; no CV leaves that as it was.
 */
export function markApplicationApplied(
  state: AppState,
  id: string,
  cvId: string | null,
  now: IsoDate,
): Result<AppState, ApplyError> {
  const application = state.applications.find((a) => a.id === id)
  if (application === undefined) return { ok: false, error: 'unknown_application' }
  if (cvId !== null && !state.cvs.some((cv) => cv.id === cvId)) return { ok: false, error: 'unknown_cv' }
  const result = markApplied(application, cvId, now)
  if (!result.ok) return result
  const next = replaceApplication(state, result.value)
  if (cvId === null) return { ok: true, value: next }
  return { ok: true, value: { ...next, settings: { ...next.settings, lastCvId: cvId } } }
}
