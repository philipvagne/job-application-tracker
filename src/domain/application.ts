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
  | 'not_applied'
  | 'cv_required'

export type ApplicationFieldError = 'company_required' | 'invalid_url'

export interface ApplicationChanges {
  company?: string
  role?: string
  url?: string
  notes?: string
}

/** Trims the text fields and returns what is wrong with them. Role may be empty; so may the link. */
export function validateApplicationFields(fields: {
  company: string
  url: string
}): ApplicationFieldError[] {
  const errors: ApplicationFieldError[] = []
  if (fields.company.trim() === '') errors.push('company_required')
  const url = fields.url.trim()
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
  if (input.cvId !== undefined) application.cvId = input.cvId
  if (input.notes !== undefined) application.notes = input.notes
  return application
}

/** Like createApplication, but checks company and link first. */
export function newApplication(
  input: NewApplicationInput,
  now: IsoDate,
): Result<Application, ApplicationFieldError[]> {
  const errors = validateApplicationFields(input)
  if (errors.length > 0) return { ok: false, error: errors }
  return { ok: true, value: createApplication(input, now) }
}

/**
 * Edits company, role, link and notes. Company must not be empty after trimming, and a
 * link, if there is one, must be http or https. Fields left out stay as they are; empty
 * notes are removed.
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

/** Moves a to-apply application to applied, recording the date and the CV used. */
export function markApplied(
  application: Application,
  cvId: string,
  now: IsoDate,
): Result<Application, TransitionError> {
  if (application.status !== 'to_apply') return { ok: false, error: 'invalid_transition' }
  return { ok: true, value: { ...application, status: 'applied', cvId, appliedAt: now } }
}

/** Records that the employer replied. Keeps the first reply date if there already is one. */
export function markReplied(
  application: Application,
  now: IsoDate,
): Result<Application, TransitionError> {
  if (application.appliedAt === undefined) return { ok: false, error: 'not_applied' }
  if (application.repliedAt !== undefined) return { ok: true, value: application }
  return { ok: true, value: { ...application, repliedAt: now } }
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
 * - A result that has appliedAt needs a CV: `cvId` if given, else the one the
 *   application already has, else the error cv_required.
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
    const chosen = cvId !== undefined && cvId !== '' ? cvId : next.cvId
    if (next.appliedAt === undefined) return { ok: true, value: next }
    if (chosen === undefined) return { ok: false, error: 'cv_required' }
    return { ok: true, value: { ...next, cvId: chosen } }
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
