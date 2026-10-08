import { describe, expect, it } from 'vitest'
import { deleteCv, type AppState } from '../domain'
import { createMemoryFileStore, createUnavailableFileStore, type CvFileStore, type FileStoreErrorCode } from './cvFileStore'
import { deleteCvAndFile } from './deleteCv'

const NOW = '2026-10-07T08:00:00.000Z'
const file = { fileName: 'a.pdf', size: 10, type: 'application/pdf' as const }

function initial(): AppState {
  return {
    applications: [
      { id: 'a1', company: 'A', role: '', url: '', status: 'to_apply', cvId: 'cv1', createdAt: NOW },
      { id: 'a2', company: 'B', role: '', url: '', status: 'to_apply', cvId: 'cv1', createdAt: NOW },
      { id: 'a3', company: 'C', role: '', url: '', status: 'to_apply', createdAt: NOW },
    ],
    cvs: [
      { id: 'cv1', name: 'Short', file },
      { id: 'cv2', name: 'Name only' },
    ],
    settings: { reminderDays: 14, language: 'en' },
  }
}

async function setup(options: { files?: CvFileStore; saves?: boolean } = {}) {
  const files = options.files ?? createMemoryFileStore()
  await files.put('cv1', { blob: new Blob(['%PDF-1.7']), fileName: 'a.pdf', size: 8, storedAt: NOW })
  const holder = { state: initial() }
  const deps = {
    files,
    getState: () => holder.state,
    removeEntry: (id: string): boolean => {
      if (options.saves === false) return false
      const r = deleteCv(holder.state, id)
      if (r.ok) holder.state = r.value
      return r.ok
    },
  }
  return { files, deps, holder }
}

function failingDelete(code: FileStoreErrorCode): CvFileStore {
  return { ...createMemoryFileStore(), delete: () => Promise.resolve({ ok: false, code }) }
}

describe('deleteCvAndFile', () => {
  it('removes the file and the entry, and says how many applications lost the CV', async () => {
    const s = await setup()
    expect(await deleteCvAndFile(s.deps, 'cv1')).toEqual({ ok: true, value: { affected: 2 } })
    expect(s.holder.state.cvs.map((c) => c.id)).toEqual(['cv2'])
    expect(await s.files.keys()).toEqual({ ok: true, value: [] })
  })

  it('deletes a CV without a file and does not touch the file store', async () => {
    const s = await setup()
    expect(await deleteCvAndFile(s.deps, 'cv2')).toEqual({ ok: true, value: { affected: 0 } })
    expect(s.holder.state.cvs.map((c) => c.id)).toEqual(['cv1'])
    expect(await s.files.keys()).toEqual({ ok: true, value: ['cv1'] })
  })

  it('works when the file is already missing', async () => {
    const s = await setup()
    await s.files.delete('cv1')
    expect(await deleteCvAndFile(s.deps, 'cv1')).toEqual({ ok: true, value: { affected: 2 } })
    expect(s.holder.state.cvs.map((c) => c.id)).toEqual(['cv2'])
  })

  it('works in a browser without file storage', async () => {
    const s = await setup({ files: createUnavailableFileStore() })
    expect(await deleteCvAndFile(s.deps, 'cv1')).toEqual({ ok: true, value: { affected: 2 } })
    expect(s.holder.state.cvs.map((c) => c.id)).toEqual(['cv2'])
  })

  it('keeps the CV and the links when the file cannot be removed', async () => {
    for (const code of ['blocked', 'quota', 'unknown'] as const) {
      const s = await setup({ files: failingDelete(code) })
      expect(await deleteCvAndFile(s.deps, 'cv1')).toEqual({ ok: false, error: code })
      expect(s.holder.state).toEqual(initial())
    }
  })

  it('reports a save failure; the entry and the application data stay', async () => {
    const s = await setup({ saves: false })
    expect(await deleteCvAndFile(s.deps, 'cv1')).toEqual({ ok: false, error: 'save_failed' })
    expect(s.holder.state).toEqual(initial())
  })

  it('refuses an unknown CV without touching anything', async () => {
    const s = await setup()
    expect(await deleteCvAndFile(s.deps, 'zzz')).toEqual({ ok: false, error: 'unknown_cv' })
    expect(await s.files.keys()).toEqual({ ok: true, value: ['cv1'] })
  })

  it('counts applications after the file is gone, in case another tab changed the data', async () => {
    const s = await setup()
    const slow: CvFileStore = {
      ...s.files,
      delete: (id) => {
        s.holder.state = { ...s.holder.state, applications: s.holder.state.applications.slice(1) }
        return s.files.delete(id)
      },
    }
    expect(await deleteCvAndFile({ ...s.deps, files: slow }, 'cv1')).toEqual({ ok: true, value: { affected: 1 } })
  })

  it('succeeds with nothing to do when another tab already removed the CV', async () => {
    const s = await setup()
    const gone: CvFileStore = {
      ...s.files,
      delete: (id) => {
        s.holder.state = { ...s.holder.state, cvs: s.holder.state.cvs.filter((c) => c.id !== id) }
        return s.files.delete(id)
      },
    }
    expect(await deleteCvAndFile({ ...s.deps, files: gone }, 'cv1')).toEqual({ ok: true, value: { affected: 0 } })
  })
})
