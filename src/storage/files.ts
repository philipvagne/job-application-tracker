import { exportData, importData, type AppState, type ImportResult, type IsoDate } from '../domain'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export interface ExportFileContent {
  filename: string
  content: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * The file name uses the user's local date. The content records `now` as
 * lastExportAt; the caller still has to store that in its own state once the
 * download has happened. An unparseable `now` gives a plain name and no lastExportAt.
 */
export function buildExportFile(state: AppState, now: IsoDate): ExportFileContent {
  const date = new Date(now)
  const valid = !Number.isNaN(date.getTime())
  const data = exportData(valid ? { ...state, settings: { ...state.settings, lastExportAt: now } } : state)
  const stamp = valid ? `-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : ''
  return {
    filename: `job-tracker-backup${stamp}.json`,
    content: JSON.stringify(data, null, 2),
  }
}

/** Checks size (in UTF-8 bytes), strips a leading BOM, parses and validates. Never throws. */
export function readImportText(text: string, maxBytes: number = MAX_IMPORT_BYTES): ImportResult {
  // A UTF-16 code unit is at least one byte, so this cheap check avoids encoding huge input.
  if (text.length > maxBytes || new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, errors: [{ code: 'too_large', path: '$', params: { maxBytes } }] }
  }
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, errors: [{ code: 'unreadable', path: '$' }] }
  }
  return importData(parsed)
}
