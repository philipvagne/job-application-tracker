import type { Application, ClosedReason, IsoDate, Result, Status } from './types'
import { isHttpUrl } from './url'

export interface NewApplicationInput {
  id: string
  company: string
  role: string
  url: string
  cvId?: string
  notes?: string
}

export type TransitionError =
  | 'same_status'
  | 'invalid_transition'
  | 'closed_reason_required'

export type ApplicationFieldError = 'company_or_link_required' | 'invalid_url'

export interface ApplicationChanges {
  company?: string
  role?: string
  url?: string
  notes?: string
}

/**
 * Trims the text fields and returns what is wrong with them. An application needs a link or
 * a company (either is enough). A link, if there is one, must be http or https. Role may be empty.
 */
export function validateApplicationFields(fields: {
  company: string
  url: string
}): ApplicationFieldError[] {
  const errors: ApplicationFieldError[] = []
  const url = fields.url.trim()
  if (fields.company.trim() === '' && url === '') errors.push('company_or_link_required')
  if (url !== '' && !isHttpUrl(url)) errors.push('invalid_url')
  return errors
}

/** Builds a to_apply application without checking the fields; see newApplication. */
export function createApplication(input: NewApplicationInput, now: IsoDate): Application {
  const application: Application = {
    id: input.id,
    company: input.company.trim(),
    role: input.role.trim(),
    url: input.url.trim(),
    status: 'to_apply',
    createdAt: now,
  }
  if (input.cvId !== undefined && input.cvId !== '') application.cvId = input.cvId
  if (input.notes !== undefined && input.notes.trim() !== '') application.notes = input.notes
  return application
}

/** Like createApplication, but checks company and link first (see validateApplicationFields). */
export function newApplication(
  input: NewApplicationInput,
  now: IsoDate,
): Result<Application, ApplicationFieldError[]> {
  const errors = validateApplicationFields(input)
  if (errors.length > 0) return { ok: false, error: errors }
  return { ok: true, value: createApplication(input, now) }
}

/**
 * Like newApplication, but the result is already applied: status applied, appliedAt now, and
 * the CV used, if there is one (an empty cvId means no CV).
 */
export function newAppliedApplication(
  input: NewApplicationInput,
  now: IsoDate,
): Result<Application, ApplicationFieldError[]> {
  const errors = validateApplicationFields(input)
  if (errors.length > 0) return { ok: false, error: errors }
  return { ok: true, value: { ...createApplication(input, now), status: 'applied', appliedAt: now } }
}

/**
 * Edits company, role, link and notes. Like a new application, it needs a link or a company
 * after trimming, and a link, if there is one, must be http or https. Fields left out stay
 * as they are; empty notes are removed.
 */
export function updateApplication(
  application: Application,
  changes: ApplicationChanges,
): Result<Application, ApplicationFieldError[]> {
  const company = (changes.company ?? application.company).trim()
  const role = (changes.role ?? application.role).trim()
  const url = (changes.url ?? application.url).trim()
  const errors = validateApplicationFields({ company, url })
  if (errors.length > 0) return { ok: false, error: errors }

  const { notes: _notes, ...rest } = application
  const next: Application = { ...rest, company, role, url }
  const notes = changes.notes ?? application.notes
  if (notes !== undefined && notes.trim() !== '') next.notes = notes
  return { ok: true, value: next }
}

/**
 * Moves a to-apply application to applied, recording the date and the CV used. With null
 * (no CV) any CV the application had is removed.
 */
export function markApplied(
  application: Application,
  cvId: string | null,
  now: IsoDate,
): Result<Application, TransitionError> {
  if (application.status !== 'to_apply') return { ok: false, error: 'invalid_transition' }
  const { cvId: _old, ...rest } = application
  const next: Application = { ...rest, status: 'applied', appliedAt: now }
  if (cvId !== null && cvId !== '') next.cvId = cvId
  return { ok: true, value: next }
}

const ALLOWED: Record<Status, readonly Status[]> = {
  to_apply: ['applied', 'interview'],
  applied: ['to_apply', 'interview', 'offer'],
  interview: ['applied', 'offer'],
  offer: ['interview'],
  closed: [],
}

function withoutClosedReason(application: Application): Application {
  const { closedReason: _removed, closedFrom: _from, ...rest } = application
  return rest
}

/**
 * The status a closed application returns to: the stage it was closed from, if that is
 * known and fits its dates; otherwise applied when it has appliedAt, else to_apply.
 */
export function reopenTarget(application: Application): Status {
  const fallback: Status = application.appliedAt !== undefined ? 'applied' : 'to_apply'
  const from = application.closedFrom
  if (from === undefined) return fallback
  if (from === 'to_apply') return application.appliedAt === undefined ? 'to_apply' : fallback
  return application.appliedAt === undefined ? fallback : from
}

function withoutApplied(application: Application): Application {
  const { appliedAt: _applied, repliedAt: _replied, ...rest } = application
  return rest
}

/**
 * Changes status if the transition is allowed.
 * - Forward: to_apply -> applied -> interview -> offer. to_apply may jump to
 *   interview and applied may jump to offer.
 * - Back one stage: offer -> interview, interview -> applied, applied -> to_apply.
 *   Stepping back to to_apply clears appliedAt and repliedAt; cvId stays.
 * - Closing is allowed from any non-closed status and needs a closedReason. It records
 *   the stage in closedFrom.
 * - Reopening a closed application goes back to closedFrom (see reopenTarget), which for
 *   older data without it is applied if it has appliedAt, otherwise to_apply. It clears
 *   closedReason and closedFrom.
 * - Reaching applied, interview or offer fills appliedAt if missing. Reaching
 *   interview or offer also fills repliedAt and interviewAt if missing, and offer
 *   fills offerAt. interviewAt and offerAt are never cleared.
 * - A CV is optional: `cvId`, if given, replaces the one the application has; otherwise
 *   the application keeps what it has (possibly nothing).
 */
export function changeStatus(
  application: Application,
  to: Status,
  now: IsoDate,
  closedReason?: ClosedReason,
  cvId?: string,
): Result<Application, TransitionError> {
  const from = application.status
  if (from === to) return { ok: false, error: 'same_status' }

  const withCv = (next: Application): Result<Application, TransitionError> => {
    if (cvId === undefined || cvId === '') return { ok: true, value: next }
    return { ok: true, value: { ...next, cvId } }
  }

  if (to === 'closed') {
    if (closedReason === undefined) return { ok: false, error: 'closed_reason_required' }
    if (from === 'closed') return { ok: false, error: 'same_status' }
    return { ok: true, value: { ...application, status: 'closed', closedReason, closedFrom: from } }
  }

  if (from === 'closed') {
    const reopenTo = reopenTarget(application)
    if (to !== reopenTo) return { ok: false, error: 'invalid_transition' }
    return withCv({ ...withoutClosedReason(application), status: reopenTo })
  }

  if (!ALLOWED[from].includes(to)) return { ok: false, error: 'invalid_transition' }

  if (to === 'to_apply') {
    return { ok: true, value: { ...withoutApplied(application), status: 'to_apply' } }
  }

  const next: Application = { ...application, status: to }
  next.appliedAt ??= now
  if (to === 'interview' || to === 'offer') {
    next.repliedAt ??= now
    next.interviewAt ??= now
  }
  if (to === 'offer') next.offerAt ??= now
  return withCv(next)
}
