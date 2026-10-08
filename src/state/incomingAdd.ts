import { readAddHash, type AddHashResult } from '../domain'

/** An add payload that arrived through the address, and a number that is new for each one. */
export interface IncomingAdd {
  id: number
  result: Exclude<AddHashResult, { kind: 'none' }>
}

/** The parts of `window` this needs, so tests can pass a fake. */
export interface UrlWindow {
  location: { hash: string; pathname: string; search: string }
  history: { replaceState(data: unknown, unused: string, url?: string): void }
}

/**
 * Reads an add payload from the address fragment and removes the fragment, so the job's link
 * does not stay in the address bar or get bookmarked or shared by accident. An address without
 * an `add` payload is left alone. Nothing here saves anything.
 */
export function takeAddFromUrl(win: UrlWindow): Exclude<AddHashResult, { kind: 'none' }> | null {
  const result = readAddHash(win.location.hash)
  if (result.kind === 'none') return null
  try {
    win.history.replaceState(null, '', win.location.pathname + win.location.search)
  } catch {
    // The address stays as it is; the payload has still been read once.
  }
  return result
}
