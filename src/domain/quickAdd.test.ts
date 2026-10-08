import { describe, expect, it } from 'vitest'
import { decideQuickAdd, type QuickAddInput } from './quickAdd'
import type { Application, Cv } from './types'

const cvs: Cv[] = [{ id: 'cv1', name: 'Short' }]
const existing: Application = {
  id: 'e1',
  company: '',
  role: '',
  url: 'https://acme.se/jobs/1',
  status: 'closed',
  closedReason: 'no_reply',
  createdAt: '2026-10-01T08:00:00.000Z',
}

function input(overrides: Partial<QuickAddInput> = {}): QuickAddInput {
  return { company: '', url: 'https://b.se/job', target: 'to_apply', cvId: '', allowDuplicate: false, ...overrides }
}

describe('decideQuickAdd', () => {
  it('accepts a link only, with no CV, for To apply', () => {
    expect(decideQuickAdd(input(), [], cvs)).toEqual({ kind: 'ok' })
  })

  it('accepts a company only', () => {
    expect(decideQuickAdd(input({ url: '', company: 'Acme' }), [], cvs)).toEqual({ kind: 'ok' })
  })

  it('reports nothing to save, and bad links', () => {
    expect(decideQuickAdd(input({ url: ' ' }), [], cvs)).toEqual({ kind: 'invalid', errors: ['company_or_link_required'] })
    expect(decideQuickAdd(input({ url: 'javascript:alert(1)', company: 'A' }), [], cvs)).toEqual({
      kind: 'invalid',
      errors: ['invalid_url'],
    })
  })

  it('needs a CV for applied, and says when there are none to pick', () => {
    expect(decideQuickAdd(input({ target: 'applied' }), [], cvs)).toEqual({ kind: 'needs_cv', noCvs: false })
    expect(decideQuickAdd(input({ target: 'applied', cvId: 'gone' }), [], cvs)).toEqual({ kind: 'needs_cv', noCvs: false })
    expect(decideQuickAdd(input({ target: 'applied' }), [], [])).toEqual({ kind: 'needs_cv', noCvs: true })
  })

  it('accepts applied with an existing CV', () => {
    expect(decideQuickAdd(input({ target: 'applied', cvId: 'cv1' }), [], cvs)).toEqual({ kind: 'ok' })
  })

  it('checks the fields before the CV, and the CV before duplicates', () => {
    expect(decideQuickAdd(input({ target: 'applied', url: '' }), [existing], cvs).kind).toBe('invalid')
    expect(decideQuickAdd(input({ target: 'applied', url: existing.url }), [existing], cvs).kind).toBe('needs_cv')
  })

  it('warns about a link already in the list, in any status, unless told to add anyway', () => {
    const same = input({ url: 'https://www.acme.se/jobs/1/?utm_source=x' })
    expect(decideQuickAdd(same, [existing], cvs)).toEqual({ kind: 'duplicate', existing })
    expect(decideQuickAdd({ ...same, allowDuplicate: true }, [existing], cvs)).toEqual({ kind: 'ok' })
  })

  it('does not warn when only a company is given', () => {
    expect(decideQuickAdd(input({ url: '', company: 'Acme' }), [{ ...existing, url: '' }], cvs)).toEqual({ kind: 'ok' })
  })
})
