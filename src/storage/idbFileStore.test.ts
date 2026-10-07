import { describe, expect, it } from 'vitest'
import type { StoredCvFile } from './cvFileStore'
import { createIdbFileStore } from './idbFileStore'

const file: StoredCvFile = {
  blob: new Blob(['%PDF-1.7']),
  fileName: 'cv.pdf',
  size: 8,
  storedAt: '2026-10-07T08:00:00.000Z',
}

interface FakeError {
  name: string
}

interface FakeRequest {
  result?: unknown
  error?: FakeError
  onsuccess?: () => void
  onerror?: () => void
  onblocked?: () => void
  onupgradeneeded?: () => void
}

interface FakeTransaction {
  error: FakeError | null
  oncomplete?: () => void
  onabort?: () => void
  objectStore: () => Record<string, () => FakeRequest>
}

const later = (run: () => void): void => {
  setTimeout(run, 0)
}

function asFactory(fake: object): IDBFactory {
  return fake as unknown as IDBFactory
}

/** A factory whose open request ends the way `finish` says. */
function openingAs(finish: (request: FakeRequest) => void): IDBFactory {
  return asFactory({
    open: () => {
      const request: FakeRequest = {}
      later(() => finish(request))
      return request
    },
  })
}

/** A factory that opens fine, but whose transactions abort with this error. */
function abortingWith(error: FakeError): IDBFactory {
  let calls = 0
  const database = {
    close: () => undefined,
    transaction: (): FakeTransaction => {
      calls += 1
      const tx: FakeTransaction = {
        error,
        objectStore: () => ({
          add: () => {
            later(() => tx.onabort?.())
            return {}
          },
          getAllKeys: () => {
            later(() => tx.onabort?.())
            return {}
          },
        }),
      }
      return tx
    },
    get calls() {
      return calls
    },
  }
  return openingAs((request) => {
    request.result = database
    request.onsuccess?.()
  })
}

describe('createIdbFileStore errors', () => {
  it('says quota when the browser runs out of room while storing', async () => {
    const store = createIdbFileStore(abortingWith({ name: 'QuotaExceededError' }))
    expect(await store.put('cv1', file)).toEqual({ ok: false, code: 'quota' })
  })

  it('says exists for a constraint error', async () => {
    const store = createIdbFileStore(abortingWith({ name: 'ConstraintError' }))
    expect(await store.put('cv1', file)).toEqual({ ok: false, code: 'exists' })
  })

  it('says unknown for other aborts', async () => {
    const store = createIdbFileStore(abortingWith({ name: 'AbortError' }))
    expect(await store.keys()).toEqual({ ok: false, code: 'unknown' })
  })

  it('says blocked when another tab holds the database', async () => {
    const store = createIdbFileStore(openingAs((request) => request.onblocked?.()))
    expect(await store.keys()).toEqual({ ok: false, code: 'blocked' })
  })

  it('says unavailable when opening fails', async () => {
    const failing = openingAs((request) => {
      request.error = { name: 'UnknownError' }
      request.onerror?.()
    })
    expect(await createIdbFileStore(failing).keys()).toEqual({ ok: false, code: 'unavailable' })
  })

  it('says unavailable when open throws a security error', async () => {
    const throwing = asFactory({
      open: () => {
        throw Object.assign(new Error('denied'), { name: 'SecurityError' })
      },
    })
    expect(await createIdbFileStore(throwing).get('cv1')).toEqual({ ok: false, code: 'unavailable' })
  })

  it('says quota when opening fails for lack of room', async () => {
    const failing = openingAs((request) => {
      request.error = { name: 'QuotaExceededError' }
      request.onerror?.()
    })
    expect(await createIdbFileStore(failing).keys()).toEqual({ ok: false, code: 'quota' })
  })

  it('tries to open again after a failure', async () => {
    let attempt = 0
    const database = {
      close: () => undefined,
      transaction: (): FakeTransaction => {
        const tx: FakeTransaction = {
          error: null,
          objectStore: () => ({
            getAllKeys: () => {
              const request: FakeRequest = { result: ['cv1'] }
              later(() => tx.oncomplete?.())
              return request
            },
          }),
        }
        return tx
      },
    }
    const flaky = openingAs((request) => {
      attempt += 1
      if (attempt === 1) {
        request.onblocked?.()
      } else {
        request.result = database
        request.onsuccess?.()
      }
    })
    const store = createIdbFileStore(flaky)
    expect(await store.keys()).toEqual({ ok: false, code: 'blocked' })
    expect(await store.keys()).toEqual({ ok: true, value: ['cv1'] })
  })

  it('closes a connection that arrives after it already reported blocked', async () => {
    let closed = false
    const database = { close: () => (closed = true), transaction: () => ({}) }
    const store = createIdbFileStore(
      openingAs((request) => {
        request.onblocked?.()
        request.result = database
        request.onsuccess?.()
      }),
    )
    expect(await store.keys()).toEqual({ ok: false, code: 'blocked' })
    expect(closed).toBe(true)
  })

  it('reports unknown rather than throwing if a transaction cannot start', async () => {
    const database = {
      close: () => undefined,
      transaction: () => {
        throw Object.assign(new Error('closing'), { name: 'TransactionInactiveError' })
      },
    }
    const store = createIdbFileStore(
      openingAs((request) => {
        request.result = database
        request.onsuccess?.()
      }),
    )
    expect(await store.keys()).toEqual({ ok: false, code: 'unknown' })
  })
})
