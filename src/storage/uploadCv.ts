import {
  PDF_HEADER_BYTES,
  addCv,
  validateCvFile,
  type AppState,
  type Cv,
  type CvFile,
  type CvFileError,
  type IsoDate,
  type Result,
} from '../domain'
import type { CvFileStore, FileStoreErrorCode } from './cvFileStore'

export type UploadErrorCode =
  | CvFileError
  | 'name_required'
  | 'name_taken'
  /** The file could not be read. */
  | 'unreadable'
  /** The CV entry could not be saved, so the stored file was removed again. */
  | 'save_failed'
  | Exclude<FileStoreErrorCode, 'exists'>

export interface UploadDeps {
  files: CvFileStore
  newId: () => string
  now: () => IsoDate
  getState: () => AppState
  /** Adds the entry to the app's data and saves it. Returns false if that did not work; then nothing is kept. */
  addEntry: (entry: { id: string; name: string; file: CvFile; now: IsoDate }) => boolean
}

/** A picked file: a Blob with a name, which is what the browser's File is. */
export type PickedFile = Blob & { name: string }

/**
 * Uploads a CV: checks the file and the name first, so nothing is written for a bad
 * request, then stores the file, then adds the entry. If the entry cannot be saved the
 * file is removed again. Never throws.
 */
export async function uploadCv(
  deps: UploadDeps,
  input: { file: PickedFile; name: string },
): Promise<Result<Cv, UploadErrorCode>> {
  const { file } = input

  let head: Uint8Array
  try {
    head = new Uint8Array(await file.slice(0, PDF_HEADER_BYTES).arrayBuffer())
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  const checked = validateCvFile({ name: file.name, size: file.size }, head)
  if (!checked.ok) return checked

  const id = deps.newId()
  const now = deps.now()
  const nameCheck = addCv(deps.getState(), { id, name: input.name })
  if (!nameCheck.ok) {
    return { ok: false, error: nameCheck.error === 'duplicate_id' ? 'unknown' : nameCheck.error }
  }
  const name = input.name.trim()

  // The type is set here, never taken from the browser, so what is stored is always a PDF.
  const blob = file.slice(0, file.size, 'application/pdf')
  const stored = await deps.files.put(id, {
    blob,
    fileName: checked.value.fileName,
    size: checked.value.size,
    storedAt: now,
  })
  if (!stored.ok) return { ok: false, error: stored.code === 'exists' ? 'unknown' : stored.code }

  if (!deps.addEntry({ id, name, file: checked.value, now })) {
    await deps.files.delete(id)
    return { ok: false, error: 'save_failed' }
  }
  return { ok: true, value: { id, name, createdAt: now, file: checked.value } }
}

export type ReadCvError = 'missing' | Exclude<FileStoreErrorCode, 'exists'>

/** The stored PDF for a CV entry, ready to open. `missing` if this browser does not have it. */
export async function readCvFile(files: CvFileStore, id: string): Promise<Result<Blob, ReadCvError>> {
  const found = await files.get(id)
  if (!found.ok) return { ok: false, error: found.code === 'exists' ? 'unknown' : found.code }
  if (found.value === null) return { ok: false, error: 'missing' }
  return { ok: true, value: found.value.blob.slice(0, found.value.blob.size, 'application/pdf') }
}
