import type { Application, ClosedReason, IsoDate, Result, Status } from './types'

export interface NewApplicationInput {
  id: string
  company: string
  role: string
  url: string
  cvId: string
  notes?: string
}

export type TransitionError =
  | 'same_status'
  | 'invalid_transition'
  | 'closed_reason_required'
  | 'not_applied'

export function createApplication(input: NewApplicationInput, now: IsoDate): Application {
  const application: Application = {
    id: input.id,
    company: input.company.trim(),
    role: input.role.trim(),
    url: input.url.trim(),
    status: 'to_apply',
    cvId: input.cvId,
    createdAt: now,
  }
  if (input.notes !== undefined) application.notes = input.notes
  return application
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
  const { closedReason: _removed, ...rest } = application
  return rest
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
 * - Closing is allowed from any non-closed status and needs a closedReason.
 * - Reopening a closed application goes to applied if it has appliedAt, otherwise
 *   to to_apply, and clears closedReason.
 * - Reaching applied, interview or offer fills appliedAt if missing. Reaching
 *   interview or offer also fills repliedAt and interviewAt if missing, and offer
 *   fills offerAt. interviewAt and offerAt are never cleared.
 */
export function changeStatus(
  application: Application,
  to: Status,
  now: IsoDate,
  closedReason?: ClosedReason,
): Result<Application, TransitionError> {
  const from = application.status
  if (from === to) return { ok: false, error: 'same_status' }

  if (to === 'closed') {
    if (closedReason === undefined) return { ok: false, error: 'closed_reason_required' }
    return { ok: true, value: { ...application, status: 'closed', closedReason } }
  }

  if (from === 'closed') {
    const reopenTo: Status = application.appliedAt !== undefined ? 'applied' : 'to_apply'
    if (to !== reopenTo) return { ok: false, error: 'invalid_transition' }
    return { ok: true, value: { ...withoutClosedReason(application), status: reopenTo } }
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
  return { ok: true, value: next }
}
