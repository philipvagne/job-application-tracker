import type { ImportError, ImportErrorCode } from '../domain'
import { lookup, t, type Dict, type Params } from './t'

const MEGABYTE = 1024 * 1024

function paramText(value: string | number | string[]): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

/** Turns an import error code and its params into a sentence in the language of `dict`. */
export function formatImportError(error: ImportError, dict: Dict): string {
  const params: Record<string, string | number> = { path: error.path }
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
