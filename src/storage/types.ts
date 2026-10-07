/** The subset of the Web Storage API we use, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** A string key-value store. Methods may throw; callers in this folder catch. */
export interface Storage {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

export type SaveErrorCode = 'quota' | 'unknown'

export type SaveResult =
  /** `persistent` is false while data is only held in memory and is lost on reload. */
  | { ok: true; persistent: boolean }
  | { ok: false; code: SaveErrorCode }

export type ClearResult = { ok: true } | { ok: false; code: SaveErrorCode }
