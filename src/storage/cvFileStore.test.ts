import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import {
  createMemoryFileStore,
  createUnavailableFileStore,
  type CvFileStore,
  type StoredCvFile,
} from './cvFileStore'
import { createIdbFileStore, fileStoreErrorCode } from './idbFileStore'

const T0 = '2026-10-07T08:00:00.000Z'

function stored(text = '%PDF-1.7 hello', name = 'cv.pdf'): StoredCvFile {
  const blob = new Blob([text], { type: 'application/pdf' })
  return { blob, fileName: name, size: blob.size, storedAt: T0 }
}

async function textOf(file: StoredCvFile | null): Promise<string | null> {
  return file === null ? null : file.blob.text()
}

const stores: [string, () => CvFileStore][] = [
  ['memory store', () => createMemoryFileStore()],
  ['IndexedDB store', () => createIdbFileStore(new IDBFactory())],
]

describe.each(stores)('%s', (_name, make) => {
  it('stores a file and gives it back with its details', async () => {
    const store = make()
    expect(await store.put('cv1', stored('%PDF-1.7 hello'))).toEqual({ ok: true, value: undefined })
    const got = await store.get('cv1')
    expect(got.ok).toBe(true)
    if (!got.ok || got.value === null) throw new Error('expected a file')
    expect(await textOf(got.value)).toBe('%PDF-1.7 hello')
    expect(got.value).toEqual(expect.objectContaining({ fileName: 'cv.pdf', size: 14, storedAt: T0 }))
  })

  it('gives null for an id with no file', async () => {
    expect(await make().get('nope')).toEqual({ ok: true, value: null })
  })

  it('never replaces a file: a second put under the same id says exists and keeps the first', async () => {
    const store = make()
    await store.put('cv1', stored('first'))
    expect(await store.put('cv1', stored('second'))).toEqual({ ok: false, code: 'exists' })
    const got = await store.get('cv1')
    expect(got.ok && (await textOf(got.value))).toBe('first')
  })

  it('lists the ids of all files', async () => {
    const store = make()
    expect(await store.keys()).toEqual({ ok: true, value: [] })
    await store.put('b', stored())
    await store.put('a', stored())
    const keys = await store.keys()
    expect(keys.ok && [...keys.value].sort()).toEqual(['a', 'b'])
  })

  it('deletes one file, and deleting a missing one is fine', async () => {
    const store = make()
    await store.put('a', stored())
    await store.put('b', stored())
    expect(await store.delete('a')).toEqual({ ok: true, value: undefined })
    expect(await store.delete('zzz')).toEqual({ ok: true, value: undefined })
    const keys = await store.keys()
    expect(keys.ok && keys.value).toEqual(['b'])
  })

  it('clears everything', async () => {
    const store = make()
    await store.put('a', stored())
    await store.put('b', stored())
    expect(await store.clearAll()).toEqual({ ok: true, value: undefined })
    expect(await store.keys()).toEqual({ ok: true, value: [] })
  })

  it('allows an id again after it was deleted', async () => {
    const store = make()
    await store.put('a', stored('one'))
    await store.delete('a')
    expect((await store.put('a', stored('two'))).ok).toBe(true)
  })

  it('keeps ids that look like prototype keys apart from real ones', async () => {
    const store = make()
    await store.put('__proto__', stored('x'))
    await store.put('constructor', stored('y'))
    const keys = await store.keys()
    expect(keys.ok && [...keys.value].sort()).toEqual(['__proto__', 'constructor'])
  })
})

describe('IndexedDB store across instances', () => {
  it('keeps files for a new store on the same database, like a reload', async () => {
    const factory = new IDBFactory()
    await createIdbFileStore(factory).put('cv1', stored('persisted'))
    const again = await createIdbFileStore(factory).get('cv1')
    expect(again.ok && (await textOf(again.value))).toBe('persisted')
  })
})

describe('unavailable store', () => {
  it('says unavailable for every call', async () => {
    const store = createUnavailableFileStore()
    const failed = { ok: false, code: 'unavailable' }
    expect(await store.put('a', stored())).toEqual(failed)
    expect(await store.get('a')).toEqual(failed)
    expect(await store.keys()).toEqual(failed)
    expect(await store.delete('a')).toEqual(failed)
    expect(await store.clearAll()).toEqual(failed)
  })

  it('is what an IndexedDB store reports when the browser has no IndexedDB', async () => {
    const store = createIdbFileStore(undefined)
    expect(await store.keys()).toEqual({ ok: false, code: 'unavailable' })
    expect(await store.put('a', stored())).toEqual({ ok: false, code: 'unavailable' })
  })
})

describe('fileStoreErrorCode', () => {
  it.each([
    ['QuotaExceededError', 'quota'],
    ['NS_ERROR_DOM_QUOTA_REACHED', 'quota'],
    ['ConstraintError', 'exists'],
    ['SecurityError', 'unavailable'],
    ['InvalidStateError', 'unavailable'],
    ['NotSupportedError', 'unavailable'],
    ['AbortError', 'unknown'],
    ['Whatever', 'unknown'],
  ])('maps %s to %s', (name, code) => {
    expect(fileStoreErrorCode({ name })).toBe(code)
  })

  it('maps things that are not errors to unknown', () => {
    for (const value of [null, undefined, 'x', 5, {}]) expect(fileStoreErrorCode(value)).toBe('unknown')
  })
})
