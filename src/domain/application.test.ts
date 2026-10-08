import { describe, expect, it } from 'vitest'
import {
  changeStatus,
  createApplication,
  markApplied,
  newApplication,
  reopenTarget,
  updateApplication,
} from './application'
import { CLOSED_REASONS, SELECTABLE_CLOSED_REASONS, STATUSES, type Application, type Status } from './types'

const T0 = '2026-10-01T08:00:00.000Z'
const T1 = '2026-10-05T08:00:00.000Z'
const T2 = '2026-10-07T08:00:00.000Z'

function make(overrides: Partial<Application> = {}): Application {
  return { ...createApplication({ id: 'a1', company: 'Acme AB', role: 'Dev', url: '', cvId: 'cv1' }, T0), ...overrides }
}

describe('createApplication', () => {
  it('creates a to_apply application with the given id and time', () => {
    expect(
      createApplication({ id: 'x', company: ' Acme ', role: ' Dev ', url: ' https://a.se ', cvId: 'cv1' }, T0),
    ).toEqual({
      id: 'x',
      company: 'Acme',
      role: 'Dev',
      url: 'https://a.se',
      status: 'to_apply',
      cvId: 'cv1',
      createdAt: T0,
    })
  })

  it('keeps notes only when given', () => {
    const withNotes = createApplication({ id: 'x', company: 'A', role: 'B', url: '', cvId: 'c', notes: 'hi' }, T0)
    expect(withNotes.notes).toBe('hi')
    expect('notes' in make()).toBe(false)
  })
})

describe('markApplied', () => {
  it('sets appliedAt, cvId and status', () => {
    const r = markApplied(make(), 'cv2', T1)
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ status: 'applied', cvId: 'cv2', appliedAt: T1 }) })
  })

  it('does not mutate the input', () => {
    const app = make()
    markApplied(app, 'cv2', T1)
    expect(app.status).toBe('to_apply')
  })

  it('rejects applications that are not to_apply', () => {
    expect(markApplied(make({ status: 'applied', appliedAt: T0 }), 'cv1', T1)).toEqual({
      ok: false,
      error: 'invalid_transition',
    })
    expect(markApplied(make({ status: 'closed', closedReason: 'withdrawn' }), 'cv1', T1).ok).toBe(false)
  })
})

describe('changeStatus transition table', () => {
  const open: Status[] = ['to_apply', 'applied', 'interview', 'offer']
  const legal: Record<string, boolean> = {
    'to_apply>applied': true,
    'to_apply>interview': true,
    'to_apply>offer': false,
    'applied>to_apply': true,
    'applied>interview': true,
    'applied>offer': true,
    'interview>to_apply': false,
    'interview>applied': true,
    'interview>offer': true,
    'offer>to_apply': false,
    'offer>applied': false,
    'offer>interview': true,
  }

  const pairs = open.flatMap((from) => open.filter((to) => to !== from).map((to) => [from, to] as const))

  it('covers every pair of open statuses', () => {
    expect(pairs).toHaveLength(12)
    expect(Object.keys(legal).sort()).toEqual(pairs.map(([f, t]) => `${f}>${t}`).sort())
  })

  it.each(pairs)('%s -> %s', (from, to) => {
    const app = make({ status: from, appliedAt: from === 'to_apply' ? undefined : T0 })
    const r = changeStatus(app, to, T1)
    if (legal[`${from}>${to}`]) expect(r.ok).toBe(true)
    else expect(r).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it.each(STATUSES)('rejects %s -> %s (same status)', (status) => {
    const app = make({ status, closedReason: status === 'closed' ? 'withdrawn' : undefined })
    expect(changeStatus(app, status, T1, 'declined')).toEqual({ ok: false, error: 'same_status' })
  })
})

describe('changeStatus effects', () => {
  it('sets appliedAt when going to_apply -> applied', () => {
    const r = changeStatus(make(), 'applied', T1)
    expect(r.ok && r.value.appliedAt).toBe(T1)
  })

  it('sets interviewAt and repliedAt when reaching interview, keeping existing values', () => {
    const base = make({ status: 'applied', appliedAt: T0 })
    const r1 = changeStatus(base, 'interview', T2)
    expect(r1.ok && r1.value).toEqual(expect.objectContaining({ interviewAt: T2, repliedAt: T2, appliedAt: T0 }))
    const r2 = changeStatus({ ...base, repliedAt: T1 }, 'interview', T2)
    expect(r2.ok && r2.value.repliedAt).toBe(T1)
  })

  it('sets interviewAt, offerAt and repliedAt when reaching offer straight from applied', () => {
    const r = changeStatus(make({ status: 'applied', appliedAt: T0 }), 'offer', T2)
    expect(r.ok && r.value).toEqual(expect.objectContaining({ interviewAt: T2, offerAt: T2, repliedAt: T2 }))
  })

  it('keeps the first interviewAt when going on to offer', () => {
    const r = changeStatus(make({ status: 'interview', appliedAt: T0, repliedAt: T1, interviewAt: T1 }), 'offer', T2)
    expect(r.ok && r.value).toEqual(expect.objectContaining({ interviewAt: T1, offerAt: T2 }))
  })

  it('goes to_apply -> interview and fills appliedAt, repliedAt and interviewAt if missing', () => {
    const r = changeStatus(make(), 'interview', T1)
    expect(r.ok && r.value).toEqual(
      expect.objectContaining({ status: 'interview', appliedAt: T1, repliedAt: T1, interviewAt: T1 }),
    )
  })

  it('keeps an existing appliedAt when going to_apply -> interview', () => {
    const r = changeStatus(make({ appliedAt: T0 }), 'interview', T1)
    expect(r.ok && r.value.appliedAt).toBe(T0)
  })

  it('steps back from offer to interview and keeps offerAt', () => {
    const app = make({ status: 'offer', appliedAt: T0, repliedAt: T0, interviewAt: T1, offerAt: T2 })
    const r = changeStatus(app, 'interview', '2026-10-09T08:00:00.000Z')
    expect(r.ok && r.value).toEqual({ ...app, status: 'interview' })
  })

  it('steps back from interview to applied and keeps interviewAt and repliedAt', () => {
    const app = make({ status: 'interview', appliedAt: T0, repliedAt: T1, interviewAt: T1 })
    const r = changeStatus(app, 'applied', T2)
    expect(r.ok && r.value).toEqual({ ...app, status: 'applied' })
  })

  it('steps back from applied to to_apply, clearing appliedAt and repliedAt but not cvId, interviewAt or offerAt', () => {
    const app = make({
      status: 'applied',
      cvId: 'cv9',
      appliedAt: T0,
      repliedAt: T1,
      interviewAt: T1,
      offerAt: T2,
    })
    const r = changeStatus(app, 'to_apply', T2)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBe('to_apply')
      expect('appliedAt' in r.value).toBe(false)
      expect('repliedAt' in r.value).toBe(false)
      expect(r.value.cvId).toBe('cv9')
      expect(r.value.interviewAt).toBe(T1)
      expect(r.value.offerAt).toBe(T2)
    }
  })

  it('does not mutate the input', () => {
    const app = make({ status: 'applied', appliedAt: T0 })
    changeStatus(app, 'interview', T1)
    changeStatus(app, 'to_apply', T1)
    expect(app).toEqual(make({ status: 'applied', appliedAt: T0 }))
  })
})

describe('changeStatus closing and reopening', () => {
  it.each(['to_apply', 'applied', 'interview', 'offer'] as const)('closes from %s with a reason', (from) => {
    const r = changeStatus(make({ status: from }), 'closed', T1, 'not_selected')
    expect(r).toEqual({
      ok: true,
      value: expect.objectContaining({ status: 'closed', closedReason: 'not_selected', closedFrom: from }),
    })
  })

  it('requires a closedReason when closing', () => {
    expect(changeStatus(make(), 'closed', T1)).toEqual({ ok: false, error: 'closed_reason_required' })
  })

  it('keeps all dates when closing', () => {
    const app = make({ status: 'interview', appliedAt: T0, repliedAt: T1, interviewAt: T1 })
    const r = changeStatus(app, 'closed', T2, 'no_reply')
    expect(r.ok && r.value).toEqual({ ...app, status: 'closed', closedReason: 'no_reply', closedFrom: 'interview' })
  })

  it('reopens to applied when appliedAt exists and clears closedReason', () => {
    const closed = make({ status: 'closed', closedReason: 'no_reply', appliedAt: T0, interviewAt: T1 })
    const r = changeStatus(closed, 'applied', T2)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBe('applied')
      expect('closedReason' in r.value).toBe(false)
      expect('closedFrom' in r.value).toBe(false)
      expect(r.value.interviewAt).toBe(T1)
    }
  })

  it('reopens to to_apply when there is no appliedAt', () => {
    const closed = make({ status: 'closed', closedReason: 'withdrawn' })
    const r = changeStatus(closed, 'to_apply', T1)
    expect(r.ok && r.value.status).toBe('to_apply')
  })

  it.each(['to_apply', 'interview', 'offer'] as const)('rejects reopening to %s when appliedAt exists', (to) => {
    const closed = make({ status: 'closed', closedReason: 'withdrawn', appliedAt: T0 })
    expect(changeStatus(closed, to, T1)).toEqual({ ok: false, error: 'invalid_transition' })
  })

  it.each(['applied', 'interview', 'offer'] as const)('rejects reopening to %s when appliedAt is missing', (to) => {
    const closed = make({ status: 'closed', closedReason: 'withdrawn' })
    expect(changeStatus(closed, to, T1)).toEqual({ ok: false, error: 'invalid_transition' })
  })
})

describe('createApplication without a CV', () => {
  it('leaves cvId out', () => {
    const a = createApplication({ id: 'x', company: 'A', role: '', url: '' }, T0)
    expect('cvId' in a).toBe(false)
  })
})

describe('newApplication', () => {
  it('trims and creates a to_apply application, with an empty role and link allowed', () => {
    expect(newApplication({ id: 'n1', company: '  Acme  ', role: '', url: '' }, T0)).toEqual({
      ok: true,
      value: { id: 'n1', company: 'Acme', role: '', url: '', status: 'to_apply', createdAt: T0 },
    })
  })

  it('reports an empty company and a bad link together', () => {
    expect(newApplication({ id: 'n1', company: '   ', role: 'Dev', url: 'javascript:alert(1)' }, T0)).toEqual({
      ok: false,
      error: ['company_required', 'invalid_url'],
    })
  })
})

describe('updateApplication', () => {
  it('changes company, role, link and notes, trimming them', () => {
    const r = updateApplication(make(), { company: ' New AB ', role: ' Lead ', url: ' https://a.se/x ', notes: 'hej' })
    expect(r).toEqual({
      ok: true,
      value: expect.objectContaining({ company: 'New AB', role: 'Lead', url: 'https://a.se/x', notes: 'hej' }),
    })
  })

  it('keeps fields that are not in the changes, and everything else about the application', () => {
    const app = make({ status: 'applied', appliedAt: T0, notes: 'old' })
    const r = updateApplication(app, { role: 'Other' })
    expect(r).toEqual({ ok: true, value: { ...app, role: 'Other' } })
  })

  it('does not mutate the input', () => {
    const app = make()
    updateApplication(app, { company: 'Z' })
    expect(app).toEqual(make())
  })

  it.each(['', '   ', '\t'])('rejects an empty company %j', (company) => {
    expect(updateApplication(make(), { company })).toEqual({ ok: false, error: ['company_required'] })
  })

  it('allows an empty role and an empty link', () => {
    const r = updateApplication(make({ url: 'https://a.se' }), { role: '', url: '' })
    expect(r.ok && [r.value.role, r.value.url]).toEqual(['', ''])
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://a.se',
    'a.se',
    'https://',
    'https://a b.se',
  ])('rejects the link %j', (url) => {
    expect(updateApplication(make(), { url })).toEqual({ ok: false, error: ['invalid_url'] })
  })

  it('removes empty notes and keeps text notes as typed', () => {
    const withNotes = make({ notes: 'something' })
    const cleared = updateApplication(withNotes, { notes: '  ' })
    expect(cleared.ok && 'notes' in cleared.value).toBe(false)
    const kept = updateApplication(withNotes, { notes: '  line\nmore  ' })
    expect(kept.ok && kept.value.notes).toBe('  line\nmore  ')
  })

  it('keeps markup in text as plain text', () => {
    const r = updateApplication(make(), { company: '<b>Acme</b>' })
    expect(r.ok && r.value.company).toBe('<b>Acme</b>')
  })
})

describe('changeStatus and the CV', () => {
  const noCv = (overrides: Partial<Application> = {}): Application => {
    const { cvId: _removed, ...rest } = make(overrides)
    return rest
  }

  it('needs a CV for to_apply -> interview when there is none', () => {
    expect(changeStatus(noCv(), 'interview', T1)).toEqual({ ok: false, error: 'cv_required' })
    expect(changeStatus(noCv(), 'interview', T1, undefined, '')).toEqual({ ok: false, error: 'cv_required' })
  })

  it('sets the CV when one is supplied for to_apply -> interview', () => {
    const r = changeStatus(noCv(), 'interview', T1, undefined, 'cv7')
    expect(r.ok && r.value).toEqual(expect.objectContaining({ status: 'interview', cvId: 'cv7', appliedAt: T1 }))
  })

  it('needs a CV for to_apply -> applied when there is none', () => {
    expect(changeStatus(noCv(), 'applied', T1)).toEqual({ ok: false, error: 'cv_required' })
    expect(changeStatus(noCv(), 'applied', T1, undefined, 'cv7').ok).toBe(true)
  })

  it('uses the CV the application already has when none is supplied', () => {
    const r = changeStatus(make({ cvId: 'cv9' }), 'interview', T1)
    expect(r.ok && r.value.cvId).toBe('cv9')
  })

  it('prefers a supplied CV over the existing one', () => {
    const r = changeStatus(make({ cvId: 'cv9' }), 'interview', T1, undefined, 'cv7')
    expect(r.ok && r.value.cvId).toBe('cv7')
  })

  it('does not need a CV to close, to step back to to_apply, or to reopen to to_apply', () => {
    expect(changeStatus(noCv(), 'closed', T1, 'no_reply').ok).toBe(true)
    expect(changeStatus(noCv({ status: 'closed', closedReason: 'withdrawn' }), 'to_apply', T1).ok).toBe(true)
  })

  it('keeps the CV when stepping back to to_apply', () => {
    const r = changeStatus(make({ status: 'applied', appliedAt: T0, cvId: 'cv1' }), 'to_apply', T1)
    expect(r.ok && r.value.cvId).toBe('cv1')
  })

  it('asks for a CV when reopening an applied application that has none', () => {
    const closed = noCv({ status: 'closed', closedReason: 'withdrawn', appliedAt: T0 })
    expect(changeStatus(closed, 'applied', T1)).toEqual({ ok: false, error: 'cv_required' })
    expect(changeStatus(closed, 'applied', T1, undefined, 'cv1').ok).toBe(true)
  })

  it('does not mutate the input when it fails', () => {
    const app = noCv()
    changeStatus(app, 'interview', T1)
    expect(app).toEqual(noCv())
  })
})

describe('closed reasons', () => {
  it('offers no legacy reason, and only reasons that are valid', () => {
    expect(SELECTABLE_CLOSED_REASONS).not.toContain('declined')
    expect(SELECTABLE_CLOSED_REASONS).not.toContain('withdrawn')
    for (const reason of SELECTABLE_CLOSED_REASONS) expect(CLOSED_REASONS).toContain(reason)
  })

  it('still closes with and reopens from a legacy reason', () => {
    const closed = changeStatus(make({ status: 'applied', appliedAt: T0 }), 'closed', T1, 'withdrawn')
    expect(closed.ok && closed.value.closedReason).toBe('withdrawn')
    expect(closed.ok && changeStatus(closed.value, 'applied', T2).ok).toBe(true)
  })
})

describe('reopening to the stage it was closed from', () => {
  const base = { status: 'closed', closedReason: 'no_reply', appliedAt: T0, interviewAt: T1, offerAt: T2 } as const

  it.each(['applied', 'interview', 'offer'] as const)('goes back to %s', (from) => {
    const closed = make({ ...base, closedFrom: from })
    expect(reopenTarget(closed)).toBe(from)
    const r = changeStatus(closed, from, T2)
    expect(r.ok && r.value.status).toBe(from)
    expect(r.ok && 'closedFrom' in r.value).toBe(false)
    expect(r.ok && 'closedReason' in r.value).toBe(false)
  })

  it('goes back to to_apply when closed from to_apply', () => {
    const closed = make({ status: 'closed', closedReason: 'withdrawn', closedFrom: 'to_apply' })
    expect(reopenTarget(closed)).toBe('to_apply')
  })

  it('round-trips through close and reopen', () => {
    const open = make({ status: 'interview', appliedAt: T0, repliedAt: T1, interviewAt: T1 })
    const closed = changeStatus(open, 'closed', T2, 'declined_offer')
    if (!closed.ok) throw new Error('close failed')
    expect(changeStatus(closed.value, 'interview', T2)).toEqual({ ok: true, value: open })
  })

  it('falls back to applied, or to_apply without appliedAt, when closedFrom is missing (older data)', () => {
    expect(reopenTarget(make({ ...base }))).toBe('applied')
    expect(reopenTarget(make({ status: 'closed', closedReason: 'declined' }))).toBe('to_apply')
  })

  it('ignores a closedFrom that does not fit the dates', () => {
    expect(reopenTarget(make({ status: 'closed', closedReason: 'no_reply', closedFrom: 'offer' }))).toBe('to_apply')
    expect(reopenTarget(make({ ...base, closedFrom: 'to_apply' }))).toBe('applied')
  })

  it('rejects reopening to a different stage', () => {
    const closed = make({ ...base, closedFrom: 'interview' })
    expect(changeStatus(closed, 'applied', T2)).toEqual({ ok: false, error: 'invalid_transition' })
  })
})
