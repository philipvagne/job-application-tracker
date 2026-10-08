import { describe, expect, it } from 'vitest'
import { decideQuickAdd, focusAfterPrefill, type QuickAddInput } from './quickAdd'
import type { Application } from './types'

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
    expect(decideQuickAdd(input(), [])).toEqual({ kind: 'ok' })
  })

  it('accepts a company only', () => {
    expect(decideQuickAdd(input({ url: '', company: 'Acme' }), [])).toEqual({ kind: 'ok' })
  })

  it('reports nothing to save, and bad links', () => {
    expect(decideQuickAdd(input({ url: ' ' }), [])).toEqual({ kind: 'invalid', errors: ['company_or_link_required'] })
    expect(decideQuickAdd(input({ url: 'javascript:alert(1)', company: 'A' }), [])).toEqual({
      kind: 'invalid',
      errors: ['invalid_url'],
    })
  })

  it('accepts applied with no CV, and with a CV', () => {
    expect(decideQuickAdd(input({ target: 'applied' }), [])).toEqual({ kind: 'ok' })
    expect(decideQuickAdd(input({ target: 'applied', cvId: 'cv1' }), [])).toEqual({ kind: 'ok' })
  })

  it('checks the fields before duplicates', () => {
    expect(decideQuickAdd(input({ target: 'applied', url: '' }), [existing]).kind).toBe('invalid')
    expect(decideQuickAdd(input({ target: 'applied', url: existing.url }), [existing]).kind).toBe('duplicate')
  })

  it('warns about a link already in the list, in any status, unless told to add anyway', () => {
    const same = input({ url: 'https://www.acme.se/jobs/1/?utm_source=x' })
    expect(decideQuickAdd(same, [existing])).toEqual({ kind: 'duplicate', existing })
    expect(decideQuickAdd({ ...same, allowDuplicate: true }, [existing])).toEqual({ kind: 'ok' })
  })

  it('does not warn when only a company is given', () => {
    expect(decideQuickAdd(input({ url: '', company: 'Acme' }), [{ ...existing, url: '' }])).toEqual({ kind: 'ok' })
  })
})

describe('focusAfterPrefill', () => {
  it('focuses the save button when the job has a role (Platsbanken)', () => {
    expect(focusAfterPrefill({ company: 'Humana AB', role: 'Vårdare' })).toBe('save')
    expect(focusAfterPrefill({ company: '', role: 'Vårdare' })).toBe('save')
  })

  it('focuses the Role field when there is a company but no role', () => {
    expect(focusAfterPrefill({ company: 'Acme AB', role: '' })).toBe('role')
  })

  it('focuses the Company field when there is only a link', () => {
    expect(focusAfterPrefill({ company: '', role: '' })).toBe('company')
  })
})
