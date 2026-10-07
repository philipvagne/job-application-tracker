import { describe, expect, it } from 'vitest'
import type { AppState } from '../domain'
import {
  createMemoryFileStore,
  type CvFileStore,
  type FileStoreErrorCode,
  type FileStoreResult,
} from './cvFileStore'
import { readCvFile, uploadCv, type PickedFile, type UploadDeps } from './uploadCv'

const NOW = '2026-10-07T08:00:00.000Z'

function pdf(name = 'My CV.pdf', body = '%PDF-1.7\nhello'): PickedFile {
  return Object.assign(new Blob([body], { type: 'application/pdf' }), { name })
}

function emptyState(): AppState {
  return { applications: [], cvs: [{ id: 'old', name: 'Old CV' }], settings: { reminderDays: 14, language: 'en' } }
}

interface Setup {
  deps: UploadDeps
  files: CvFileStore
  state: AppState
  puts: () => number
}

function setup(options: { saves?: boolean; files?: CvFileStore } = {}): Setup {
  const base = options.files ?? createMemoryFileStore()
  let putCount = 0
  const files: CvFileStore = {
    ...base,
    put: (id, file) => {
      putCount += 1
      return base.put(id, file)
    },
  }
  const holder = { state: emptyState() }
  const deps: UploadDeps = {
    files,
    newId: () => 'new-id',
    now: () => NOW,
    getState: () => holder.state,
    addEntry: (entry) => {
      if (options.saves === false) return false
      holder.state = { ...holder.state, cvs: [...holder.state.cvs, { id: entry.id, name: entry.name, file: entry.file, createdAt: entry.now }] }
      return true
    },
  }
  return {
    deps,
    files,
    get state() {
      return holder.state
    },
    puts: () => putCount,
  }
}

function failingStore(code: FileStoreErrorCode): CvFileStore {
  const base = createMemoryFileStore()
  const fail = (): Promise<FileStoreResult<never>> => Promise.resolve({ ok: false, code })
  return { ...base, put: fail, get: fail }
}

describe('uploadCv', () => {
  it('stores the file and adds the entry', async () => {
    const s = setup()
    const r = await uploadCv(s.deps, { file: pdf(), name: ' New CV ' })
    expect(r).toEqual({
      ok: true,
      value: {
        id: 'new-id',
        name: 'New CV',
        createdAt: NOW,
        file: { fileName: 'My CV.pdf', size: 14, type: 'application/pdf' },
      },
    })
    expect(s.state.cvs.map((c) => c.id)).toEqual(['old', 'new-id'])
    const stored = await s.files.get('new-id')
    expect(stored.ok && stored.value?.fileName).toBe('My CV.pdf')
  })

  it('stores the file as application/pdf whatever the browser said', async () => {
    const s = setup()
    const odd = Object.assign(new Blob(['%PDF-1.7 x'], { type: 'text/html' }), { name: 'cv.pdf' })
    await uploadCv(s.deps, { file: odd, name: 'A' })
    const stored = await s.files.get('new-id')
    expect(stored.ok && stored.value?.blob.type).toBe('application/pdf')
  })

  it('writes nothing for files that fail the checks', async () => {
    const cases: [string, PickedFile, string][] = [
      ['empty', pdf('a.pdf', ''), 'empty'],
      ['wrong extension', pdf('a.txt'), 'not_pdf'],
      ['not a PDF inside', pdf('a.pdf', '<html>'), 'not_pdf_content'],
      ['too large', Object.assign(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]), { name: 'a.pdf' }), 'too_large'],
      ['name too long', pdf(`${'a'.repeat(300)}.pdf`), 'name_too_long'],
    ]
    for (const [, file, error] of cases) {
      const s = setup()
      expect(await uploadCv(s.deps, { file, name: 'X' })).toEqual({ ok: false, error })
      expect(s.puts()).toBe(0)
      expect(s.state.cvs).toHaveLength(1)
    }
  })

  it('writes nothing when the name is empty or already used', async () => {
    const s = setup()
    expect(await uploadCv(s.deps, { file: pdf(), name: '   ' })).toEqual({ ok: false, error: 'name_required' })
    expect(await uploadCv(s.deps, { file: pdf(), name: 'old cv' })).toEqual({ ok: false, error: 'name_taken' })
    expect(s.puts()).toBe(0)
  })

  it('reports a file that cannot be read', async () => {
    const s = setup()
    const broken = Object.assign(new Blob(['%PDF-']), {
      name: 'a.pdf',
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error('read failed')) }),
    }) as unknown as PickedFile
    expect(await uploadCv(s.deps, { file: broken, name: 'X' })).toEqual({ ok: false, error: 'unreadable' })
    expect(s.puts()).toBe(0)
  })

  it.each(['quota', 'unavailable', 'blocked', 'unknown'] as const)(
    'passes on a storage error (%s) and adds no entry',
    async (code) => {
      const s = setup({ files: failingStore(code) })
      expect(await uploadCv(s.deps, { file: pdf(), name: 'New' })).toEqual({ ok: false, error: code })
      expect(s.state.cvs).toHaveLength(1)
    },
  )

  it('treats an unexpected "exists" as unknown', async () => {
    const s = setup({ files: failingStore('exists') })
    expect(await uploadCv(s.deps, { file: pdf(), name: 'New' })).toEqual({ ok: false, error: 'unknown' })
  })

  it('removes the stored file again when the entry cannot be saved', async () => {
    const s = setup({ saves: false })
    expect(await uploadCv(s.deps, { file: pdf(), name: 'New' })).toEqual({ ok: false, error: 'save_failed' })
    expect(s.puts()).toBe(1)
    expect(await s.files.keys()).toEqual({ ok: true, value: [] })
  })

  it('does not change the picked file', async () => {
    const s = setup()
    const file = pdf()
    await uploadCv(s.deps, { file, name: 'New' })
    expect(await file.text()).toBe('%PDF-1.7\nhello')
  })

  it('keeps markup in names as plain text', async () => {
    const s = setup()
    const r = await uploadCv(s.deps, { file: pdf('<img src=x onerror=alert(1)>.pdf'), name: '<b>CV</b>' })
    expect(r.ok && [r.value.name, r.value.file?.fileName]).toEqual(['<b>CV</b>', '<img src=x onerror=alert(1)>.pdf'])
  })
})

describe('readCvFile', () => {
  it('returns the stored file as a PDF blob', async () => {
    const s = setup()
    await uploadCv(s.deps, { file: pdf(), name: 'New' })
    const r = await readCvFile(s.files, 'new-id')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.type).toBe('application/pdf')
    expect(await r.value.text()).toBe('%PDF-1.7\nhello')
  })

  it('says missing when this browser has no such file', async () => {
    expect(await readCvFile(createMemoryFileStore(), 'nope')).toEqual({ ok: false, error: 'missing' })
  })

  it.each(['unavailable', 'blocked', 'unknown'] as const)('passes on the store error %s', async (code) => {
    expect(await readCvFile(failingStore(code), 'x')).toEqual({ ok: false, error: code })
  })
})
