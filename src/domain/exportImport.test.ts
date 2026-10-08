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
    expect(out.version).toBe(2)
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
    expect(errorsOf({ ...valid(), version: 3 })).toEqual([
      { code: 'unsupported_version', path: 'version', params: { supported: 2, found: 3 } },
    ])
    expect(errorsOf({ ...valid(), version: 0 })[0]?.code).toBe('unsupported_version')
    expect(errorsOf({ ...valid(), version: '2' })[0]?.code).toBe('unsupported_version')
    expect(errorsOf({ ...valid(), version: null })[0]).toEqual({
      code: 'unsupported_version',
      path: 'version',
      params: { supported: 2, found: 'null' },
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
        params: { allowed: ['no_reply', 'not_selected', 'declined_offer', 'declined', 'withdrawn'] },
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

  it.each(['no_reply', 'not_selected', 'declined_offer', 'declined', 'withdrawn'])(
    'accepts the closed reason %s (declined and withdrawn are older reasons and are kept as they are)',
    (reason) => {
      const r = importData(mutateApp((a) => (a['closedReason'] = reason)))
      expect(r.ok && r.state.applications[1]?.closedReason).toBe(reason)
    },
  )

  it('checks closedFrom: a known stage, and only on a closed application', () => {
    const ok = importData(mutateApp((a) => (a['closedFrom'] = 'interview')))
    expect(ok.ok && ok.state.applications[1]?.closedFrom).toBe('interview')
    expect(errorsOf(mutateApp((a) => (a['closedFrom'] = 'closed')))).toEqual([
      {
        code: 'invalid_value',
        path: 'applications[1].closedFrom',
        params: { allowed: ['to_apply', 'applied', 'interview', 'offer'] },
      },
    ])
    expect(errorsOf(mutateApp((a) => (a['closedFrom'] = 'applied'), 0))).toEqual([
      { code: 'closed_reason_mismatch', path: 'applications[0].closedFrom', params: { status: 'to_apply' } },
    ])
  })

  it('round-trips closedFrom and leaves it out when not set', () => {
    const closed = state.applications.map((a) => (a.status === 'closed' ? { ...a, closedFrom: 'offer' as const } : a))
    const withFrom: AppState = { ...state, applications: closed }
    expect(importData(JSON.parse(JSON.stringify(exportData(withFrom))))).toEqual({ ok: true, state: withFrom })
    expect(exportData(state).applications.some((a) => 'closedFrom' in a)).toBe(false)
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

  it('does not need a CV before the application has been sent', () => {
    expect(importData(mutateApp((a) => { delete a['cvId']; delete a['appliedAt']; delete a['repliedAt']; delete a['interviewAt'] })).ok).toBe(true)
    expect(importData(mutateApp((a) => delete a['cvId'], 0)).ok).toBe(true)
  })

  it('needs a CV whenever appliedAt is present', () => {
    expect(errorsOf(mutateApp((a) => delete a['cvId']))).toEqual([
      { code: 'missing_field', path: 'applications[1].cvId' },
    ])
    expect(errorsOf(mutateApp((a) => { delete a['cvId']; a['appliedAt'] = '2026-10-01T08:00:00.000Z' }, 0))).toEqual([
      { code: 'missing_field', path: 'applications[0].cvId' },
    ])
  })

  it('checks a CV that is present even before the application has been sent', () => {
    expect(errorsOf(mutateApp((a) => (a['cvId'] = 'nope'), 0))).toEqual([
      { code: 'unknown_cv', path: 'applications[0].cvId', params: { cvId: 'nope' } },
    ])
    expect(errorsOf(mutateApp((a) => (a['cvId'] = 5), 0))).toEqual([
      { code: 'wrong_type', path: 'applications[0].cvId', params: { expected: 'string', actual: 'number' } },
    ])
  })

  it('accepts an empty role and an empty link', () => {
    const r = importData(mutateApp((a) => { a['role'] = ''; a['url'] = '' }))
    expect(r.ok && [r.state.applications[1]?.role, r.state.applications[1]?.url]).toEqual(['', ''])
  })

  it('rejects an empty or blank company', () => {
    for (const company of ['', '   ']) {
      expect(errorsOf(mutateApp((a) => (a['company'] = company)))).toEqual([
        { code: 'empty_value', path: 'applications[1].company' },
      ])
    }
  })

  it('rejects links that are not http or https', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.se', 'a.se', 'https://', 'https://a b.se']) {
      expect(errorsOf(mutateApp((a) => (a['url'] = url)))).toEqual([
        { code: 'invalid_url', path: 'applications[1].url' },
      ])
    }
    expect(errorsOf(mutateApp((a) => (a['url'] = 7)))).toEqual([
      { code: 'wrong_type', path: 'applications[1].url', params: { expected: 'string', actual: 'number' } },
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

describe('version 1 files', () => {
  it('are upgraded and read like version 2', () => {
    const v1 = { ...valid(), version: 1 }
    expect(importData(v1)).toEqual({ ok: true, state })
  })

  it('export again as version 2', () => {
    const r = importData({ ...valid(), version: 1 })
    expect(r.ok && exportData(r.state).version).toBe(2)
  })

  it('are still checked in full', () => {
    const v1 = { ...valid(), version: 1, cvs: 'x' }
    expect(errorsOf(v1)[0]).toEqual({ code: 'wrong_type', path: 'cvs', params: { expected: 'array', actual: 'string' } })
  })

  it('accept the old file shape with no CV file details', () => {
    const old = {
      version: 1,
      cvs: [{ id: 'c', name: 'Short' }],
      applications: [{ id: 'a', company: 'A', role: '', url: '', status: 'to_apply', createdAt: '2026-10-01T08:00:00.000Z' }],
      settings: { reminderDays: 14, language: 'en' },
    }
    expect(importData(old).ok).toBe(true)
  })
})

describe('an old toldThem field', () => {
  it('is ignored, whatever it holds, and is not exported again', () => {
    for (const value of ['Jag nämnde React', 5, null, { x: 1 }]) {
      const r = importData(mutateApp((a) => (a['toldThem'] = value), 0))
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect('toldThem' in (r.state.applications[0] ?? {})).toBe(false)
        expect(JSON.stringify(exportData(r.state))).not.toContain('toldThem')
      }
    }
  })
})

describe('CV file details', () => {
  const file = { fileName: 'cv.pdf', size: 1000, type: 'application/pdf' as const }
  const withFile: AppState = {
    ...state,
    cvs: [{ id: 'cv1', name: 'Short', createdAt: '2026-10-01T08:00:00.000Z', file }, ...state.cvs.slice(1)],
  }

  // A rejected CV also leaves its applications pointing at a missing CV; only the CV errors matter here.
  const cvErrorsOf = (input: unknown): ImportError[] => errorsOf(input).filter((e) => e.path.startsWith('cvs'))

  function mutateCv(change: (cv: Record<string, unknown>) => void): unknown {
    const data = JSON.parse(JSON.stringify(exportData(withFile))) as Record<string, unknown>
    change((data['cvs'] as Record<string, unknown>[])[0] as Record<string, unknown>)
    return data
  }

  it('round-trip through JSON', () => {
    expect(importData(JSON.parse(JSON.stringify(exportData(withFile))))).toEqual({ ok: true, state: withFile })
  })

  it('are left out of the export when not set', () => {
    const out = exportData(state)
    expect(Object.keys(out.cvs[0] ?? {})).toEqual(['id', 'name'])
  })

  it('reject a file that is not an object, and missing or wrong parts', () => {
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = 'x')))).toEqual([
      { code: 'wrong_type', path: 'cvs[0].file', params: { expected: 'object', actual: 'string' } },
    ])
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = {}))).map((e) => e.code)).toEqual([
      'missing_field',
      'missing_field',
      'missing_field',
    ])
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, fileName: '' })))).toEqual([
      { code: 'empty_value', path: 'cvs[0].file.fileName' },
    ])
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, fileName: 'x'.repeat(256) })))[0]?.code).toBe('out_of_range')
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, fileName: 5 }))) [0]?.code).toBe('wrong_type')
  })

  it('reject sizes that are zero, too big, fractional or not numbers', () => {
    for (const size of [0, -1, 5 * 1024 * 1024 + 1]) {
      expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, size })))[0]?.code).toBe('out_of_range')
    }
    for (const size of [1.5, '10', null, Number.NaN]) {
      expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, size })))[0]?.code).toBe('wrong_type')
    }
    expect(importData(mutateCv((cv) => (cv['file'] = { ...file, size: 5 * 1024 * 1024 }))).ok).toBe(true)
  })

  it('reject any type but PDF', () => {
    expect(cvErrorsOf(mutateCv((cv) => (cv['file'] = { ...file, type: 'text/html' })))).toEqual([
      { code: 'invalid_value', path: 'cvs[0].file.type', params: { allowed: ['application/pdf'] } },
    ])
  })

  it('reject a bad createdAt on a CV', () => {
    expect(cvErrorsOf(mutateCv((cv) => (cv['createdAt'] = 'yesterday')))).toEqual([
      { code: 'invalid_date', path: 'cvs[0].createdAt' },
    ])
  })

  it('keeps markup in file names as plain text', () => {
    const r = importData(mutateCv((cv) => (cv['file'] = { ...file, fileName: '<img src=x>.pdf' })))
    expect(r.ok && r.state.cvs[0]?.file?.fileName).toBe('<img src=x>.pdf')
  })
})

describe('settings.lastCvId', () => {
  const withCv: AppState = { ...state, settings: { ...state.settings, lastCvId: 'cv2' } }

  it('round-trips and is exported only when set', () => {
    expect(importData(JSON.parse(JSON.stringify(exportData(withCv))))).toEqual({ ok: true, state: withCv })
    expect('lastCvId' in exportData(state).settings).toBe(false)
  })

  it('must refer to an existing CV', () => {
    const data = valid()
    data['settings'] = { reminderDays: 14, language: 'sv', lastCvId: 'nope' }
    expect(errorsOf(data)).toEqual([
      { code: 'unknown_cv', path: 'settings.lastCvId', params: { cvId: 'nope' } },
    ])
  })

  it('must be text', () => {
    const data = valid()
    data['settings'] = { reminderDays: 14, language: 'sv', lastCvId: 3 }
    expect(errorsOf(data)).toEqual([
      { code: 'wrong_type', path: 'settings.lastCvId', params: { expected: 'string', actual: 'number' } },
    ])
  })

  it('is rejected when there are no CVs at all', () => {
    const data: Record<string, unknown> = { ...valid(), cvs: [], applications: [] }
    data['settings'] = { reminderDays: 14, language: 'sv', lastCvId: 'cv1' }
    expect(errorsOf(data).map((e) => e.code)).toEqual(['unknown_cv'])
  })
})

describe('settings.lastExportAt', () => {
  const withLast: AppState = {
    ...state,
    settings: { ...state.settings, lastExportAt: '2026-10-05T10:00:00.000Z' },
  }

  it('round-trips when present', () => {
    const result = importData(JSON.parse(JSON.stringify(exportData(withLast))))
    expect(result).toEqual({ ok: true, state: withLast })
  })

  it('is omitted from the export when absent, and old files without it still import', () => {
    const file = valid()
    expect(Object.keys(file['settings'] as object)).not.toContain('lastExportAt')
    expect(importData(file)).toEqual({ ok: true, state })
  })

  it.each([['yesterday'], [123], [null], ['2026-10-05']])('rejects %j', (bad) => {
    const file = valid()
    ;(file['settings'] as Record<string, unknown>)['lastExportAt'] = bad
    expect(errorsOf(file)).toEqual([{ code: 'invalid_date', path: 'settings.lastExportAt' }])
  })
})

describe('settings.showWeekSummary', () => {
  const on: AppState = { ...state, settings: { ...state.settings, showWeekSummary: true } }

  it('round-trips, and is left out of the export when not set', () => {
    expect(importData(JSON.parse(JSON.stringify(exportData(on))))).toEqual({ ok: true, state: on })
    expect('showWeekSummary' in exportData(state).settings).toBe(false)
    expect(exportData(on).version).toBe(2)
  })

  it('keeps false as false, and reads a file without it as off', () => {
    const off: AppState = { ...state, settings: { ...state.settings, showWeekSummary: false } }
    expect(importData(JSON.parse(JSON.stringify(exportData(off))))).toEqual({ ok: true, state: off })
    const r = importData(valid())
    expect(r.ok && r.state.settings.showWeekSummary).toBeUndefined()
  })

  it('rejects a value that is not true or false', () => {
    const data = valid()
    data['settings'] = { reminderDays: 14, language: 'sv', showWeekSummary: 'yes' }
    expect(errorsOf(data)).toEqual([
      { code: 'wrong_type', path: 'settings.showWeekSummary', params: { expected: 'boolean', actual: 'string' } },
    ])
  })
})
