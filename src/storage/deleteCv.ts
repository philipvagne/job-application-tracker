import { applicationsUsingCv, type AppState, type Result } from '../domain'
import type { CvFileStore, FileStoreErrorCode } from './cvFileStore'

export type DeleteCvErrorCode =
  | 'unknown_cv'
  /** The file was removed but the change could not be saved, so the CV entry is still listed. */
  | 'save_failed'
  | Exclude<FileStoreErrorCode, 'exists'>

export interface DeleteCvDeps {
  files: CvFileStore
  getState: () => AppState
  /** Removes the entry from the app's data and saves it. Returns false if that did not work; then nothing is changed. */
  removeEntry: (cvId: string) => boolean
}

/**
 * Deletes a CV: first its file (if it has one), then the entry. If the file cannot be
 * removed nothing else is touched, so the CV stays and can be tried again. A file that is
 * already gone counts as removed, and so does a browser without file storage (there is no
 * file to keep). If the entry cannot be saved after the file is gone, the entry stays and
 * shows the usual "file missing" note. Returns how many applications lost the CV. Never throws.
 */
export async function deleteCvAndFile(
  deps: DeleteCvDeps,
  cvId: string,
): Promise<Result<{ affected: number }, DeleteCvErrorCode>> {
  const cv = deps.getState().cvs.find((c) => c.id === cvId)
  if (cv === undefined) return { ok: false, error: 'unknown_cv' }

  if (cv.file !== undefined) {
    const removed = await deps.files.delete(cvId)
    if (!removed.ok && removed.code !== 'unavailable') {
      return { ok: false, error: removed.code === 'exists' ? 'unknown' : removed.code }
    }
  }

  // Counted after the await: another tab may have changed the data meanwhile.
  const current = deps.getState()
  if (!current.cvs.some((c) => c.id === cvId)) return { ok: true, value: { affected: 0 } }
  const affected = applicationsUsingCv(current.applications, cvId)
  if (!deps.removeEntry(cvId)) return { ok: false, error: 'save_failed' }
  return { ok: true, value: { affected } }
}
