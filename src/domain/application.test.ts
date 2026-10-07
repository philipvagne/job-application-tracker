import { describe, expect, it } from 'vitest'
import { changeStatus, createApplication, markApplied, markReplied } from './application'
import { STATUSES, type Application, type Status } from './types'

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

describe('markReplied', () => {
  it('sets repliedAt without changing status', () => {
    const r = markReplied(make({ status: 'applied', appliedAt: T0 }), T1)
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ status: 'applied', repliedAt: T1 }) })
  })

  it('keeps the first reply date', () => {
    const r = markReplied(make({ status: 'applied', appliedAt: T0, repliedAt: T1 }), T2)
    expect(r.ok && r.value.repliedAt).toBe(T1)
  })

  it('rejects applications that were never applied', () => {
    expect(markReplied(make(), T1)).toEqual({ ok: false, error: 'not_applied' })
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
    const r = changeStatus(make({ status: from }), 'closed', T1, 'declined')
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ status: 'closed', closedReason: 'declined' }) })
  })

  it('requires a closedReason when closing', () => {
    expect(changeStatus(make(), 'closed', T1)).toEqual({ ok: false, error: 'closed_reason_required' })
  })

  it('keeps all dates when closing', () => {
    const app = make({ status: 'interview', appliedAt: T0, repliedAt: T1, interviewAt: T1 })
    const r = changeStatus(app, 'closed', T2, 'no_reply')
    expect(r.ok && r.value).toEqual({ ...app, status: 'closed', closedReason: 'no_reply' })
  })

  it('reopens to applied when appliedAt exists and clears closedReason', () => {
    const closed = make({ status: 'closed', closedReason: 'no_reply', appliedAt: T0, interviewAt: T1 })
    const r = changeStatus(closed, 'applied', T2)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBe('applied')
      expect('closedReason' in r.value).toBe(false)
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
