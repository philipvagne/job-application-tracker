import type { ImportError, ImportErrorCode } from '../domain'
import { lookup, t, type Dict, type Params } from './t'

const MEGABYTE = 1024 * 1024

function paramText(value: string | number | string[]): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

const PATH_SEGMENT = /^([A-Za-z_]+)(?:\[(\d+)\])?$/

/**
 * Shows an import error path in friendly words, e.g. "cvs" as "CV list" and
 * "applications[1].status" as "Applications, #2, status". Only paths that begin with
 * applications, cvs or settings are changed; names without a translation stay as written.
 */
export function formatImportPath(path: string, dict: Dict): string {
  const parts: string[] = []
  for (const [i, segment] of path.split('.').entries()) {
    const match = PATH_SEGMENT.exec(segment)
    if (match === null) return path
    const [, name = '', index] = match
    const known = lookup(dict, `importPaths.${i === 0 ? 'roots' : 'fields'}.${name}`)
    if (i === 0 && known === undefined) return path
    parts.push(known ?? name)
    if (index !== undefined) parts.push(`#${Number(index) + 1}`)
  }
  return parts.join(', ')
}

/** Turns an import error code and its params into a sentence in the language of `dict`. */
export function formatImportError(error: ImportError, dict: Dict): string {
  const params: Record<string, string | number> = { path: formatImportPath(error.path, dict) }
  for (const [name, value] of Object.entries(error.params ?? {})) params[name] = paramText(value)

  if (error.code === 'wrong_type') {
    for (const name of ['expected', 'actual']) {
      const raw = params[name]
      if (typeof raw === 'string') params[name] = lookup(dict, `typeNames.${raw}`) ?? raw
    }
  }
  const maxBytes = error.params?.['maxBytes']
  if (error.code === 'too_large' && typeof maxBytes === 'number') {
    params['maxMb'] = Math.round((maxBytes / MEGABYTE) * 10) / 10
  }
  return t(dict, `importErrors.${error.code}` satisfies `importErrors.${ImportErrorCode}`, params as Params)
}
