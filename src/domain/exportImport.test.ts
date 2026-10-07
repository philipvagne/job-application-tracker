import { describe, expect, it } from 'vitest'
import { exportData, importData, type ImportError } from './exportImport'
import type { AppState } from './types'

const state: AppState = {
  cvs: [
    { id: 'cv1', name: 'Short' },
    { id: 'cv2', name: 'Långt CV' },
  ],
  settings: { reminderDays: 14, language: 'sv' },
  applications: [
    {
      id: 'a1',
      company: 'Acme AB',
      role: 'Dev',
      url: 'https://example.com/job/1',
      status: 'to_apply',
      cvId: 'cv1',
      createdAt: '2026-10-01T08:00:00.000Z',
    },
    {
      id: 'a2',
      company: 'Globex',
      role: 'Engineer',
      url: '',
      status: 'closed',
      closedReason: 'no_reply',
      cvId: 'cv2',
      createdAt: '2026-09-01T08:00:00.000Z',
      appliedAt: '2026-09-02T08:00:00+02:00',
      repliedAt: '2026-09-09T08:00:00.000Z',
      interviewAt: '2026-09-09T08:00:00.000Z',
      notes: 'Rad ett\n"citat" <b>x</b> 😀',
    },
    {
      id: 'a3',
      company: 'Initech',
      role: 'Lead',
      url: 'https://example.com/job/3',
      status: 'offer',
      cvId: 'cv1',
      createdAt: '2026-09-01T08:00:00.000Z',
      appliedAt: '2026-09-02T08:00:00.000Z',
      repliedAt: '2026-09-05T08:00:00.000Z',
      interviewAt: '2026-09-05T08:00:00.000Z',
      offerAt: '2026-09-12T08:00:00.000Z',
    },
  ],
}

function valid(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(exportData(state))) as Record<string, unknown>
}

function errorsOf(input: unknown): ImportError[] {
  const r = importData(input)
  if (r.ok) throw new Error('expected import to fail')
  return r.errors
}

/** Edits application number `index` (default 1, the closed one) in a copy of the valid file. */
function mutateApp(change: (a: Record<string, unknown>) => void, index = 1): unknown {
  const data = valid()
  const apps = data['applications'] as Record<string, unknown>[]
  change(apps[index] as Record<string, unknown>)
  return data
}

describe('exportData', () => {
  it('produces a versioned object', () => {
    const out = exportData(state)
    expect(out.version).toBe(1)
    expect(out.applications).toHaveLength(3)
  })

  it('omits optional fields that are not set', () => {
    const first = exportData(state).applications[0]
    expect(first && Object.keys(first).sort()).toEqual(['company', 'createdAt', 'cvId', 'id', 'role', 'status', 'url'])
  })

  it('includes interviewAt and offerAt', () => {
    const third = exportData(state).applications[2]
    expect(third?.interviewAt).toBe('2026-09-05T08:00:00.000Z')
    expect(third?.offerAt).toBe('2026-09-12T08:00:00.000Z')
  })

  it('does not share references with the state', () => {
    const out = exportData(state)
    expect(out.applications[0]).not.toBe(state.applications[0])
    expect(out.settings).not.toBe(state.settings)
  })
})

describe('round trip', () => {
  it('restores the state exactly, through JSON text', () => {
    const text = JSON.stringify(exportData(state))
    expect(importData(JSON.parse(text))).toEqual({ ok: true, state })
  })

  it('round-trips an empty state', () => {
    const empty: AppState = { applications: [], cvs: [], settings: { reminderDays: 7, language: 'en' } }
    expect(importData(JSON.parse(JSON.stringify(exportData(empty))))).toEqual({ ok: true, state: empty })
  })

  it('is stable when exported twice', () => {
    const r = importData(exportData(state))
    expect(r.ok && exportData(r.state)).toEqual(exportData(state))
  })

  it('keeps interviewAt on an application that is back at to_apply', () => {
    const stepped: AppState = {
      ...state,
      applications: [{ ...state.applications[0]!, interviewAt: '2026-09-05T08:00:00.000Z' }],
    }
    expect(importData(JSON.parse(JSON.stringify(exportData(stepped))))).toEqual({ ok: true, state: stepped })
  })
})

describe('importData rejects bad input without throwing', () => {
  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [42, 'number'],
    ['text', 'string'],
    [true, 'boolean'],
    [[], 'array'],
    [[1, 2], 'array'],
  ])('rejects %j', (value, actual) => {
    expect(errorsOf(value)).toEqual([{ code: 'wrong_type', path: '$', params: { expected: 'object', actual } }])
  })

  it('reports a missing or unsupported version', () => {
    expect(errorsOf({})).toEqual([{ code: 'missing_field', path: 'version' }])
    expect(errorsOf({ ...valid(), version: 2 })).toEqual([
      { code: 'unsupported_version', path: 'version', params: { supported: 1, found: 2 } },
    ])
    expect(errorsOf({ ...valid(), version: '1' })[0]?.code).toBe('unsupported_version')
    expect(errorsOf({ ...valid(), version: null })[0]).toEqual({
      code: 'unsupported_version',
      path: 'version',
      params: { supported: 1, found: 'null' },
    })
  })

  it('reports missing top-level fields', () => {
    expect(errorsOf({ version: 1 })).toEqual([
      { code: 'missing_field', path: 'cvs' },
      { code: 'missing_field', path: 'applications' },
      { code: 'missing_field', path: 'settings' },
    ])
  })

  it('rejects wrong types for top-level fields', () => {
    const data = { ...valid(), applications: {}, cvs: 'x', settings: [] }
    expect(errorsOf(data)).toEqual([
      { code: 'wrong_type', path: 'cvs', params: { expected: 'array', actual: 'string' } },
      { code: 'wrong_type', path: 'applications', params: { expected: 'array', actual: 'object' } },
      { code: 'wrong_type', path: 'settings', params: { expected: 'object', actual: 'array' } },
    ])
  })

  it('names the application and field that is wrong', () => {
    expect(errorsOf(mutateApp((a) => delete a['company']))).toEqual([
      { code: 'missing_field', path: 'applications[1].company' },
    ])
    expect(errorsOf(mutateApp((a) => (a['role'] = 5)))).toEqual([
      { code: 'wrong_type', path: 'applications[1].role', params: { expected: 'string', actual: 'number' } },
    ])
    expect(errorsOf(mutateApp((a) => (a['url'] = null)))).toEqual([
      { code: 'wrong_type', path: 'applications[1].url', params: { expected: 'string', actual: 'null' } },
    ])
  })

  it('rejects an invalid status, reason and notes type', () => {
    expect(errorsOf(mutateApp((a) => (a['status'] = 'done')))).toEqual([
      {
        code: 'invalid_value',
        path: 'applications[1].status',
        params: { allowed: ['to_apply', 'applied', 'interview', 'offer', 'closed'] },
      },
    ])
    expect(errorsOf(mutateApp((a) => delete a['status']))[0]).toEqual({
      code: 'missing_field',
      path: 'applications[1].status',
    })
    expect(errorsOf(mutateApp((a) => (a['closedReason'] = 'bored')))).toEqual([
      {
        code: 'invalid_value',
        path: 'applications[1].closedReason',
        params: { allowed: ['no_reply', 'declined', 'withdrawn'] },
      },
    ])
    expect(errorsOf(mutateApp((a) => (a['notes'] = 3)))[0]).toEqual({
      code: 'wrong_type',
      path: 'applications[1].notes',
      params: { expected: 'string', actual: 'number' },
    })
  })

  it('requires closedReason exactly when closed', () => {
    expect(errorsOf(mutateApp((a) => delete a['closedReason']))).toEqual([
      { code: 'closed_reason_mismatch', path: 'applications[1].closedReason', params: { status: 'closed' } },
    ])
    expect(errorsOf(mutateApp((a) => (a['status'] = 'applied')))).toEqual([
      { code: 'closed_reason_mismatch', path: 'applications[1].closedReason', params: { status: 'applied' } },
    ])
  })

  it('requires the dates of the stage an application is currently at', () => {
    const asInterview = (a: Record<string, unknown>): void => {
      a['status'] = 'interview'
      delete a['closedReason']
    }
    expect(errorsOf(mutateApp((a) => { asInterview(a); delete a['appliedAt'] }))).toEqual([
      { code: 'missing_field', path: 'applications[1].appliedAt' },
    ])
    expect(errorsOf(mutateApp((a) => { asInterview(a); delete a['interviewAt'] }))).toEqual([
      { code: 'missing_field', path: 'applications[1].interviewAt' },
    ])
    expect(errorsOf(mutateApp((a) => delete a['offerAt'], 2))).toEqual([
      { code: 'missing_field', path: 'applications[2].offerAt' },
    ])
    expect(
      errorsOf(mutateApp((a) => { a['status'] = 'applied'; delete a['closedReason']; delete a['appliedAt'] })),
    ).toEqual([{ code: 'missing_field', path: 'applications[1].appliedAt' }])
  })

  it('does not require dates for closed or to_apply applications', () => {
    expect(importData(mutateApp((a) => { delete a['appliedAt']; delete a['interviewAt'] })).ok).toBe(true)
  })

  it('rejects malformed dates in every date field', () => {
    for (const field of ['createdAt', 'appliedAt', 'repliedAt', 'interviewAt', 'offerAt']) {
      for (const value of ['yesterday', '2026-10-07', '2026-13-45T00:00:00Z', 20261007, null]) {
        expect(errorsOf(mutateApp((a) => (a[field] = value)))).toEqual([
          { code: 'invalid_date', path: `applications[1].${field}` },
        ])
      }
    }
  })

  it('rejects a missing createdAt, empty id and duplicate ids', () => {
    expect(errorsOf(mutateApp((a) => delete a['createdAt']))).toEqual([
      { code: 'missing_field', path: 'applications[1].createdAt' },
    ])
    expect(errorsOf(mutateApp((a) => (a['id'] = '')))).toEqual([{ code: 'empty_value', path: 'applications[1].id' }])
    expect(errorsOf(mutateApp((a) => (a['id'] = 'a1')))).toEqual([
      { code: 'duplicate_id', path: 'applications[1].id', params: { id: 'a1' } },
    ])
  })

  it('rejects an application pointing to a missing CV', () => {
    expect(errorsOf(mutateApp((a) => (a['cvId'] = 'nope')))).toEqual([
      { code: 'unknown_cv', path: 'applications[1].cvId', params: { cvId: 'nope' } },
    ])
  })

  it('rejects non-object applications and CVs', () => {
    const data = valid()
    data['applications'] = [null, 'x', 3]
    data['cvs'] = [[], 7]
    expect(errorsOf(data).map((e) => e.path)).toEqual(['cvs[0]', 'cvs[1]', 'applications[0]', 'applications[1]', 'applications[2]'])
  })

  it('rejects bad CVs', () => {
    const data = valid()
    data['cvs'] = [{ id: 'cv1', name: '' }, { id: 'cv1', name: 'X' }, { name: 'No id' }, { id: 5, name: 'N' }]
    expect(errorsOf(data).filter((e) => e.path.startsWith('cvs'))).toEqual([
      { code: 'empty_value', path: 'cvs[0].name' },
      { code: 'duplicate_id', path: 'cvs[1].id', params: { id: 'cv1' } },
      { code: 'missing_field', path: 'cvs[2].id' },
      { code: 'wrong_type', path: 'cvs[3].id', params: { expected: 'string', actual: 'number' } },
    ])
  })

  it('rejects bad settings', () => {
    const cases: [unknown, ImportError][] = [
      [{ reminderDays: 0, language: 'sv' }, { code: 'out_of_range', path: 'settings.reminderDays', params: { min: 1, max: 365 } }],
      [{ reminderDays: 400, language: 'sv' }, { code: 'out_of_range', path: 'settings.reminderDays', params: { min: 1, max: 365 } }],
      [{ reminderDays: 1.5, language: 'sv' }, { code: 'wrong_type', path: 'settings.reminderDays', params: { expected: 'integer', actual: 'number' } }],
      [{ reminderDays: Number.NaN, language: 'sv' }, { code: 'wrong_type', path: 'settings.reminderDays', params: { expected: 'integer', actual: 'number' } }],
      [{ reminderDays: '14', language: 'sv' }, { code: 'wrong_type', path: 'settings.reminderDays', params: { expected: 'integer', actual: 'string' } }],
      [{ language: 'sv' }, { code: 'missing_field', path: 'settings.reminderDays' }],
      [{ reminderDays: 14, language: 'fr' }, { code: 'invalid_value', path: 'settings.language', params: { allowed: ['sv', 'en'] } }],
      [{ reminderDays: 14 }, { code: 'missing_field', path: 'settings.language' }],
      [null, { code: 'wrong_type', path: 'settings', params: { expected: 'object', actual: 'null' } }],
    ]
    for (const [settings, expected] of cases) {
      expect(errorsOf({ ...valid(), settings })).toEqual([expected])
    }
  })

  it('accepts the reminderDays boundaries', () => {
    for (const reminderDays of [1, 365]) {
      expect(importData({ ...valid(), settings: { reminderDays, language: 'en' } }).ok).toBe(true)
    }
  })

  it('collects several errors at once', () => {
    const data = mutateApp((a) => {
      a['company'] = 1
      a['status'] = 'nope'
      a['createdAt'] = 'x'
    })
    expect(errorsOf(data).map((e) => e.code)).toEqual(['wrong_type', 'invalid_value', 'invalid_date'])
  })

  it('returns only plain data, never text for people', () => {
    const data = mutateApp((a) => {
      a['status'] = 'nope'
      a['cvId'] = 'x'
    })
    expect(JSON.parse(JSON.stringify(errorsOf(data)))).toEqual(errorsOf(data))
  })

  it('does not throw on hostile objects', () => {
    const hostile = {
      get version(): number {
        throw new Error('boom')
      },
    }
    expect(importData(hostile)).toEqual({ ok: false, errors: [{ code: 'unreadable', path: '$' }] })
  })

  it('drops unknown fields and ignores prototype keys', () => {
    const data = JSON.parse(
      '{"__proto__":{"polluted":true},"version":1,"extra":1,"cvs":[],"applications":[],"settings":{"reminderDays":7,"language":"en","x":1}}',
    ) as unknown
    expect(importData(data)).toEqual({
      ok: true,
      state: { applications: [], cvs: [], settings: { reminderDays: 7, language: 'en' } },
    })
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('keeps markup in text as plain strings', () => {
    const r = importData(valid())
    expect(r.ok && r.state.applications[1]?.notes).toContain('<b>x</b>')
  })
})
