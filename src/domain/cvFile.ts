import type { Cv, CvFile, Result } from './types'

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024
export const MAX_FILE_NAME_LENGTH = 255
/** How many bytes from the start of the file are searched for the PDF signature. */
export const PDF_HEADER_BYTES = 1024

export type CvFileError = 'empty' | 'too_large' | 'name_too_long' | 'not_pdf' | 'not_pdf_content'

export interface CvFileCandidate {
  name: string
  size: number
}

const SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

/** True if "%PDF-" appears within the first 1024 bytes, which is what PDF readers accept. */
export function hasPdfSignature(head: Uint8Array): boolean {
  const end = Math.min(head.length, PDF_HEADER_BYTES) - SIGNATURE.length
  for (let i = 0; i <= end; i++) {
    if (SIGNATURE.every((byte, k) => head[i + k] === byte)) return true
  }
  return false
}

/**
 * Checks a file the user picked: not empty, at most 5 MB, a name that ends in .pdf (else
 * not_pdf), and a PDF signature at the start (else not_pdf_content). The browser's own idea of the type is not used, because it is
 * often empty. Nothing checks that the rest of the PDF is well formed or safe.
 */
export function validateCvFile(file: CvFileCandidate, head: Uint8Array): Result<CvFile, CvFileError> {
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: 'empty' }
  if (file.size > MAX_CV_FILE_BYTES) return { ok: false, error: 'too_large' }
  const fileName = file.name
  if (fileName.length > MAX_FILE_NAME_LENGTH) return { ok: false, error: 'name_too_long' }
  if (!/\.pdf$/i.test(fileName)) return { ok: false, error: 'not_pdf' }
  if (!hasPdfSignature(head)) return { ok: false, error: 'not_pdf_content' }
  return { ok: true, value: { fileName, size: file.size, type: 'application/pdf' } }
}

/** A name to suggest for a new CV entry: the file name without ".pdf". */
export function suggestCvName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim()
}

export type CvFileStatus =
  /** The CV is only a name. */
  | 'no_file'
  | 'available'
  /** The entry says there is a file, but this browser does not have it. */
  | 'missing'
  /** The file store could not be read, so it is not known. */
  | 'unknown'

/** `stored` holds the ids of the files in this browser, or null if that could not be read. */
export function cvFileStatus(cv: Cv, stored: ReadonlySet<string> | null): CvFileStatus {
  if (cv.file === undefined) return 'no_file'
  if (stored === null) return 'unknown'
  return stored.has(cv.id) ? 'available' : 'missing'
}
