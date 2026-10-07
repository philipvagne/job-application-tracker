import type { IsoDate } from '../domain'

export type FileStoreErrorCode =
  /** There is no IndexedDB, or the browser refuses to open it (some private modes). */
  | 'unavailable'
  /** Another tab holds the database open and blocks it. */
  | 'blocked'
  /** The browser's storage is full. */
  | 'quota'
  /** A file with this id is already stored. Files are never replaced. */
  | 'exists'
  | 'unknown'

export type FileStoreResult<T> = { ok: true; value: T } | { ok: false; code: FileStoreErrorCode }

export interface StoredCvFile {
  blob: Blob
  fileName: string
  size: number
  storedAt: IsoDate
}

/**
 * Where CV files live, keyed by the id of their CV entry. Files are written once and
 * never changed. Every method resolves with a result; none rejects.
 */
export interface CvFileStore {
  /** Stores a file. Fails with `exists` if the id is taken. */
  put(id: string, file: StoredCvFile): Promise<FileStoreResult<void>>
  /** The file, or null if there is none under this id. */
  get(id: string): Promise<FileStoreResult<StoredCvFile | null>>
  /** The ids of every stored file. */
  keys(): Promise<FileStoreResult<string[]>>
  delete(id: string): Promise<FileStoreResult<void>>
  /** Removes every file. Used by "delete all my data". */
  clearAll(): Promise<FileStoreResult<void>>
}

const ok = (): FileStoreResult<void> => ({ ok: true, value: undefined })

/** Files held in memory only. For tests, and as a stand-in that never persists. */
export function createMemoryFileStore(): CvFileStore {
  const files = new Map<string, StoredCvFile>()
  return {
    put(id, file) {
      if (files.has(id)) return Promise.resolve({ ok: false, code: 'exists' })
      files.set(id, file)
      return Promise.resolve(ok())
    },
    get: (id) => Promise.resolve({ ok: true, value: files.get(id) ?? null }),
    keys: () => Promise.resolve({ ok: true, value: [...files.keys()] }),
    delete(id) {
      files.delete(id)
      return Promise.resolve(ok())
    },
    clearAll() {
      files.clear()
      return Promise.resolve(ok())
    },
  }
}

/** A store for browsers without IndexedDB: every call says `unavailable`. */
export function createUnavailableFileStore(): CvFileStore {
  const fail = (): Promise<{ ok: false; code: FileStoreErrorCode }> =>
    Promise.resolve({ ok: false, code: 'unavailable' })
  return { put: fail, get: fail, keys: fail, delete: fail, clearAll: fail }
}
