import { validateApplicationFields, type ApplicationFieldError } from './application'
import { findByLink } from './duplicates'
import type { Application, Cv } from './types'

export type QuickAddTarget = 'to_apply' | 'applied'

export interface QuickAddInput {
  company: string
  url: string
  target: QuickAddTarget
  /** The CV in the picker; '' is "No CV". */
  cvId: string
  /** True when the user has already seen the duplicate warning and chose to add anyway. */
  allowDuplicate: boolean
}

export type QuickAddDecision =
  | { kind: 'invalid'; errors: ApplicationFieldError[] }
  /** Saving as applied needs a CV. `noCvs` is true when there is none to pick from. */
  | { kind: 'needs_cv'; noCvs: boolean }
  | { kind: 'duplicate'; existing: Application }
  | { kind: 'ok' }

/**
 * What quick add should do with this input. Checked in this order: the fields, then (only for
 * "applied") the CV, then a link that is already in the list. The first problem wins.
 */
export function decideQuickAdd(
  input: QuickAddInput,
  applications: readonly Application[],
  cvs: readonly Cv[],
): QuickAddDecision {
  const errors = validateApplicationFields(input)
  if (errors.length > 0) return { kind: 'invalid', errors }
  if (input.target === 'applied' && !cvs.some((cv) => cv.id === input.cvId)) {
    return { kind: 'needs_cv', noCvs: cvs.length === 0 }
  }
  if (!input.allowDuplicate) {
    const existing = findByLink(applications, input.url)
    if (existing !== null) return { kind: 'duplicate', existing }
  }
  return { kind: 'ok' }
}
