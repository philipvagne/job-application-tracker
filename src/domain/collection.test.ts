import { describe, expect, it } from 'vitest'
import {
  addAppliedApplication,
  addApplications,
  addCv,
  deleteApplication,
  deleteCv,
  linkCv,
  markApplicationApplied,
  replaceApplication,
} from './collection'
import type { AppState, Application } from './types'

const T0 = '2026-10-01T08:00:00.000Z'
const T1 = '2026-10-07T08:00:00.000Z'

function app(id: string, overrides: Partial<Application> = {}): Application {
  return { id, company: `Co ${id}`, role: '', url: '', status: 'to_apply', createdAt: T0, ...overrides }
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    applications: [app('a1'), app('a2')],
    cvs: [{ id: 'cv1', name: 'Short' }],
    settings: { reminderDays: 14, language: 'en' },
    ...overrides,
  }
}

describe('addApplications', () => {
  it('appends and does not mutate', () => {
    const before = state()
    const after = addApplications(before, [app('a3')])
    expect(after.applications.map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(before.applications).toHaveLength(2)
  })

  it('returns the same state for an empty list', () => {
    const before = state()
    expect(addApplications(before, [])).toBe(before)
  })
})

describe('replaceApplication', () => {
  it('swaps the application with the same id', () => {
    const after = replaceApplication(state(), app('a2', { company: 'New' }))
    expect(after.applications.map((a) => a.company)).toEqual(['Co a1', 'New'])
  })

  it('ignores an unknown id', () => {
    const before = state()
    expect(replaceApplication(before, app('zzz'))).toBe(before)
  })
})

describe('deleteApplication', () => {
  it('removes the application', () => {
    expect(deleteApplication(state(), 'a1').applications.map((a) => a.id)).toEqual(['a2'])
  })

  it('leaves the state alone for an unknown id and keeps the CVs and settings', () => {
    const before = state()
    expect(deleteApplication(before, 'zzz')).toBe(before)
    const after = deleteApplication(before, 'a1')
    expect(after.cvs).toBe(before.cvs)
    expect(after.settings).toBe(before.settings)
  })
})

describe('addCv', () => {
  it('adds a CV with a trimmed name', () => {
    const r = addCv(state(), { id: 'cv2', name: '  Long CV  ' })
    expect(r.ok && r.value.cvs).toEqual([
      { id: 'cv1', name: 'Short' },
      { id: 'cv2', name: 'Long CV' },
    ])
  })

  it.each(['', '   ', '\t\n'])('rejects the empty name %j', (name) => {
    expect(addCv(state(), { id: 'cv2', name })).toEqual({ ok: false, error: 'name_required' })
  })

  it('rejects a name that is already used, ignoring case and spaces around it', () => {
    for (const name of ['Short', 'short', ' SHORT ']) {
      expect(addCv(state(), { id: 'cv2', name })).toEqual({ ok: false, error: 'name_taken' })
    }
  })

  it('compares non-English letters ignoring case too', () => {
    const s = state({ cvs: [{ id: 'cv1', name: 'Utvecklare Öst' }] })
    expect(addCv(s, { id: 'cv2', name: 'utvecklare öst' })).toEqual({ ok: false, error: 'name_taken' })
  })

  it('rejects a reused id', () => {
    expect(addCv(state(), { id: 'cv1', name: 'Other' })).toEqual({ ok: false, error: 'duplicate_id' })
  })

  it('does not touch the settings and does not mutate', () => {
    const before = state()
    const r = addCv(before, { id: 'cv2', name: 'Long' })
    expect(r.ok && r.value.settings).toBe(before.settings)
    expect(before.cvs).toHaveLength(1)
  })
})

describe('markApplicationApplied', () => {
  it('marks applied, sets the CV and remembers it as the last one used', () => {
    const r = markApplicationApplied(state(), 'a1', 'cv1', T1)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.applications[0]).toEqual(app('a1', { status: 'applied', cvId: 'cv1', appliedAt: T1 }))
    expect(r.value.applications[1]).toEqual(app('a2'))
    expect(r.value.settings.lastCvId).toBe('cv1')
  })

  it('marks applied with no CV, and leaves the last used CV as it was', () => {
    const before = state({ settings: { ...state().settings, lastCvId: 'cv1' } })
    const r = markApplicationApplied(before, 'a1', null, T1)
    expect(r.ok && r.value.applications[0]).toEqual(app('a1', { status: 'applied', appliedAt: T1 }))
    expect(r.ok && r.value.settings.lastCvId).toBe('cv1')
  })

  it('fails for an unknown application or CV, and for an application that is not to_apply', () => {
    expect(markApplicationApplied(state(), 'zzz', 'cv1', T1)).toEqual({ ok: false, error: 'unknown_application' })
    expect(markApplicationApplied(state(), 'a1', 'zzz', T1)).toEqual({ ok: false, error: 'unknown_cv' })
    const applied = state({ applications: [app('a1', { status: 'applied', cvId: 'cv1', appliedAt: T0 })] })
    expect(markApplicationApplied(applied, 'a1', 'cv1', T1)).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it('does not change anything when it fails', () => {
    const before = state()
    const r = markApplicationApplied(before, 'a1', 'zzz', T1)
    expect(r.ok).toBe(false)
    expect(before.settings.lastCvId).toBeUndefined()
  })
})

describe('addCv with a file', () => {
  const file = { fileName: 'cv.pdf', size: 1234, type: 'application/pdf' as const }

  it('stores the file details and createdAt, trimming the name', () => {
    const r = addCv(state(), { id: 'cv2', name: ' Long ', file, now: T1 })
    expect(r.ok && r.value.cvs[1]).toEqual({ id: 'cv2', name: 'Long', createdAt: T1, file })
  })

  it('leaves file and createdAt out when not given', () => {
    const r = addCv(state(), { id: 'cv2', name: 'Long' })
    expect(r.ok && Object.keys(r.value.cvs[1] ?? {})).toEqual(['id', 'name'])
  })

  it('copies the file details, so later changes to the input do not leak in', () => {
    const mutable = { ...file }
    const r = addCv(state(), { id: 'cv2', name: 'Long', file: mutable })
    mutable.size = 1
    expect(r.ok && r.value.cvs[1]?.file?.size).toBe(1234)
  })

  it('checks the name before anything else, even with a file', () => {
    expect(addCv(state(), { id: 'cv2', name: 'SHORT', file })).toEqual({ ok: false, error: 'name_taken' })
    expect(addCv(state(), { id: 'cv2', name: ' ', file })).toEqual({ ok: false, error: 'name_required' })
  })

  it('has no way to change an entry afterwards: the same id is refused', () => {
    const first = addCv(state(), { id: 'cv2', name: 'Long', file })
    if (!first.ok) throw new Error('setup failed')
    expect(addCv(first.value, { id: 'cv2', name: 'Longer', file })).toEqual({ ok: false, error: 'duplicate_id' })
  })
})

describe('linkCv', () => {
  const applied = app('a3', { status: 'applied', cvId: 'cv1', appliedAt: T0 })
  const two = (): AppState =>
    state({
      applications: [app('a1'), applied],
      cvs: [
        { id: 'cv1', name: 'Short' },
        { id: 'cv2', name: 'Long' },
      ],
    })

  it('links a to-apply application to a CV', () => {
    const r = linkCv(two(), 'a1', 'cv2')
    expect(r.ok && r.value.applications[0]?.cvId).toBe('cv2')
  })

  it('changes the CV of an applied application', () => {
    const r = linkCv(two(), 'a3', 'cv2')
    expect(r.ok && r.value.applications[1]).toEqual({ ...applied, cvId: 'cv2' })
  })

  it('returns the same state when nothing changes', () => {
    const before = two()
    const r = linkCv(before, 'a3', 'cv1')
    expect(r.ok && r.value).toBe(before)
    const none = linkCv(before, 'a1', null)
    expect(none.ok && none.value).toBe(before)
  })

  it('removes the link from a to-apply application', () => {
    const before = two()
    const linked = linkCv(before, 'a1', 'cv1')
    if (!linked.ok) throw new Error('setup failed')
    const r = linkCv(linked.value, 'a1', null)
    expect(r.ok && 'cvId' in (r.value.applications[0] ?? {})).toBe(false)
  })

  it('removes the CV of an application that was sent', () => {
    const r = linkCv(two(), 'a3', null)
    const { cvId: _removed, ...withoutCv } = applied
    expect(r.ok && r.value.applications[1]).toEqual(withoutCv)
  })

  it('refuses an unknown application or CV', () => {
    expect(linkCv(two(), 'zzz', 'cv1')).toEqual({ ok: false, error: 'unknown_application' })
    expect(linkCv(two(), 'a1', 'zzz')).toEqual({ ok: false, error: 'unknown_cv' })
  })

  it('does not mutate the input', () => {
    const before = two()
    linkCv(before, 'a1', 'cv2')
    expect(before.applications[0]).toEqual(app('a1'))
  })
})

describe('addAppliedApplication', () => {
  const applied = app('n1', { status: 'applied', appliedAt: T1, cvId: 'cv1' })

  it('adds it at the end and remembers the CV as the last used, without mutating', () => {
    const before = state()
    const r = addAppliedApplication(before, applied)
    expect(r.ok && r.value.applications.map((a) => a.id)).toEqual(['a1', 'a2', 'n1'])
    expect(r.ok && r.value.settings.lastCvId).toBe('cv1')
    expect(before).toEqual(state())
  })

  it('refuses an unknown CV and an application that is not applied', () => {
    expect(addAppliedApplication(state(), { ...applied, cvId: 'nope' })).toEqual({ ok: false, error: 'unknown_cv' })
    expect(addAppliedApplication(state(), app('n2'))).toEqual({ ok: false, error: 'not_applied' })
  })

  it('accepts an application with no CV and leaves the last used CV alone', () => {
    const { cvId: _cv, ...noCv } = applied
    const before = state({ settings: { ...state().settings, lastCvId: 'cv2' } })
    const r = addAppliedApplication(before, noCv)
    expect(r.ok && r.value.applications.map((a) => a.id)).toEqual(['a1', 'a2', 'n1'])
    expect(r.ok && r.value.settings.lastCvId).toBe('cv2')
  })
})

describe('deleteCv', () => {
  const file = { fileName: 'a.pdf', size: 10, type: 'application/pdf' as const }
  const base = (): AppState =>
    state({
      applications: [
        app('a1', { cvId: 'cv1' }),
        app('a2', { cvId: 'cv2' }),
        app('a3', { status: 'applied', appliedAt: T1, cvId: 'cv1', repliedAt: T1, notes: 'n' }),
        app('a4'),
      ],
      cvs: [
        { id: 'cv1', name: 'Short', file },
        { id: 'cv2', name: 'Long' },
      ],
      settings: { reminderDays: 14, language: 'en', lastCvId: 'cv1' },
    })

  it('removes the CV and its link from every application that used it, keeping the rest', () => {
    const r = deleteCv(base(), 'cv1')
    expect(r.ok && r.value.cvs).toEqual([{ id: 'cv2', name: 'Long' }])
    const apps = r.ok ? r.value.applications : []
    expect(apps.map((a) => a.cvId)).toEqual([undefined, 'cv2', undefined, undefined])
    expect('cvId' in (apps[0] ?? {})).toBe(false)
    expect(apps[2]).toEqual(app('a3', { status: 'applied', appliedAt: T1, repliedAt: T1, notes: 'n' }))
  })

  it('clears the last used CV only when it was this one', () => {
    const first = deleteCv(base(), 'cv1')
    expect(first.ok && 'lastCvId' in first.value.settings).toBe(false)
    const other = deleteCv(base(), 'cv2')
    expect(other.ok && other.value.settings.lastCvId).toBe('cv1')
  })

  it('deletes a name-only CV nobody uses', () => {
    const r = deleteCv(state({ cvs: [{ id: 'cv1', name: 'Short' }, { id: 'cv2', name: 'Long' }] }), 'cv2')
    expect(r.ok && r.value.cvs.map((c) => c.id)).toEqual(['cv1'])
    expect(r.ok && r.value.applications).toEqual(state().applications)
  })

  it('refuses an unknown CV', () => {
    expect(deleteCv(base(), 'zzz')).toEqual({ ok: false, error: 'unknown_cv' })
  })

  it('does not mutate the input', () => {
    const before = base()
    deleteCv(before, 'cv1')
    expect(before).toEqual(base())
  })
})
