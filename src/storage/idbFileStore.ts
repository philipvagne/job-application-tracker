import {
  createUnavailableFileStore,
  type CvFileStore,
  type FileStoreErrorCode,
  type FileStoreResult,
  type StoredCvFile,
} from './cvFileStore'

export const DB_NAME = 'jobtracker-files'
export const STORE_NAME = 'cvFiles'
const DB_VERSION = 1

function fail(code: FileStoreErrorCode): { ok: false; code: FileStoreErrorCode } {
  return { ok: false, code }
}

function nameOf(e: unknown): string {
  return typeof e === 'object' && e !== null && 'name' in e ? String(e.name) : ''
}

/** Turns an error from an IndexedDB request or transaction into one of our codes. */
export function fileStoreErrorCode(e: unknown): FileStoreErrorCode {
  switch (nameOf(e)) {
    case 'QuotaExceededError':
    case 'NS_ERROR_DOM_QUOTA_REACHED':
      return 'quota'
    case 'ConstraintError':
      return 'exists'
    case 'SecurityError':
    case 'InvalidStateError':
    case 'NotSupportedError':
      return 'unavailable'
    default:
      return 'unknown'
  }
}

function isStored(value: unknown): value is StoredCvFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v['blob'] instanceof Blob &&
    typeof v['fileName'] === 'string' &&
    typeof v['size'] === 'number' &&
    typeof v['storedAt'] === 'string'
  )
}

/**
 * CV files in IndexedDB: one database, one object store, the CV id as the key.
 * Pass `indexedDB`, or undefined if the browser has none.
 */
export function createIdbFileStore(factory: IDBFactory | undefined): CvFileStore {
  let opening: Promise<FileStoreResult<IDBDatabase>> | null = null

  function open(): Promise<FileStoreResult<IDBDatabase>> {
    if (opening !== null) return opening
    const attempt = new Promise<FileStoreResult<IDBDatabase>>((resolve) => {
      if (factory === undefined) {
        resolve(fail('unavailable'))
        return
      }
      let settled = false
      const settle = (result: FileStoreResult<IDBDatabase>): void => {
        if (settled) {
          // A late success after "blocked": do not keep the connection open.
          if (result.ok) result.value.close()
          return
        }
        settled = true
        resolve(result)
      }
      let request: IDBOpenDBRequest
      try {
        request = factory.open(DB_NAME, DB_VERSION)
      } catch (e) {
        const code = fileStoreErrorCode(e)
        settle(fail(code === 'unknown' ? 'unavailable' : code))
        return
      }
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => {
        const db = request.result
        // Another tab wants to upgrade or delete the database: let go, and reopen next time.
        db.onversionchange = () => {
          db.close()
          opening = null
        }
        db.onclose = () => {
          opening = null
        }
        settle({ ok: true, value: db })
      }
      request.onerror = () => {
        const code = fileStoreErrorCode(request.error)
        settle(fail(code === 'unknown' ? 'unavailable' : code))
      }
      request.onblocked = () => settle(fail('blocked'))
    })
    opening = attempt
    void attempt.then((result) => {
      if (!result.ok && opening === attempt) opening = null
    })
    return attempt
  }

  /** Runs one request in its own transaction and resolves when the transaction has finished. */
  async function run<T>(
    mode: IDBTransactionMode,
    start: (store: IDBObjectStore) => IDBRequest,
    read: (request: IDBRequest) => T,
  ): Promise<FileStoreResult<T>> {
    const opened = await open()
    if (!opened.ok) return opened
    return new Promise<FileStoreResult<T>>((resolve) => {
      let tx: IDBTransaction
      let request: IDBRequest
      try {
        tx = opened.value.transaction(STORE_NAME, mode)
        request = start(tx.objectStore(STORE_NAME))
      } catch (e) {
        resolve(fail(fileStoreErrorCode(e)))
        return
      }
      tx.oncomplete = () => {
        try {
          resolve({ ok: true, value: read(request) })
        } catch {
          resolve(fail('unknown'))
        }
      }
      tx.onabort = () => resolve(fail(fileStoreErrorCode(tx.error ?? request.error)))
    })
  }

  return {
    put: (id, file) =>
      run(
        'readwrite',
        (store) => store.add({ blob: file.blob, fileName: file.fileName, size: file.size, storedAt: file.storedAt }, id),
        () => undefined,
      ),
    get: (id) =>
      run(
        'readonly',
        (store) => store.get(id),
        (request): StoredCvFile | null => {
          const value: unknown = request.result
          return isStored(value) ? value : null
        },
      ),
    keys: () =>
      run(
        'readonly',
        (store) => store.getAllKeys(),
        (request) => (request.result as unknown[]).filter((key): key is string => typeof key === 'string'),
      ),
    delete: (id) =>
      run(
        'readwrite',
        (store) => store.delete(id),
        () => undefined,
      ),
    clearAll: () =>
      run(
        'readwrite',
        (store) => store.clear(),
        () => undefined,
      ),
  }
}

/** The browser's own IndexedDB, or a store that always says "unavailable" if there is none or it cannot be touched. */
export function createBrowserFileStore(): CvFileStore {
  try {
    return createIdbFileStore(typeof indexedDB === 'undefined' ? undefined : indexedDB)
  } catch {
    return createUnavailableFileStore()
  }
}
