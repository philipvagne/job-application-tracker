import { validateApplicationFields, type ApplicationFieldError } from './application'
import { findByLink } from './duplicates'
import type { Application } from './types'

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
  | { kind: 'duplicate'; existing: Application }
  | { kind: 'ok' }

/**
 * What quick add should do with this input. Checked in this order: the fields, then a link
 * that is already in the list. The first problem wins. No CV is fine for both targets.
 */
export function decideQuickAdd(
  input: QuickAddInput,
  applications: readonly Application[],
): QuickAddDecision {
  const errors = validateApplicationFields(input)
  if (errors.length > 0) return { kind: 'invalid', errors }
  if (!input.allowDuplicate) {
    const existing = findByLink(applications, input.url)
    if (existing !== null) return { kind: 'duplicate', existing }
  }
  return { kind: 'ok' }
}

/** Where focus goes after a job from the bookmark has filled the quick-add card. */
export type PrefillFocus = 'save' | 'company' | 'role'

/**
 * A job with a role (Platsbanken) is ready to save, so the save button gets the focus. Without a
 * role the user has to type one, so the Role field gets it; with no company either (only the
 * link) the Company field comes first, as it is the first field in the panel.
 */
export function focusAfterPrefill(prefill: { company: string; role: string }): PrefillFocus {
  if (prefill.role !== '') return 'save'
  return prefill.company === '' ? 'company' : 'role'
}
