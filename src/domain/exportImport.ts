import {
  CLOSED_FROM,
  CLOSED_REASONS,
  LANGUAGES,
  STATUSES,
  type AppState,
  type Application,
  type ClosedFrom,
  type ClosedReason,
  type Cv,
  type CvFile,
  type Language,
  type Settings,
  type Status,
} from './types'
import { MAX_CV_FILE_BYTES, MAX_FILE_NAME_LENGTH } from './cvFile'
import { EXPORT_VERSION, migrateToLatest } from './migrate'
import { isHttpUrl } from './url'

export interface ExportFile {
  version: typeof EXPORT_VERSION
  applications: Application[]
  cvs: Cv[]
  settings: Settings
}

export type ImportErrorCode =
  | 'unreadable'
  | 'unsupported_version'
  | 'missing_field'
  | 'wrong_type'
  | 'invalid_value'
  | 'empty_value'
  | 'company_or_link_required'
  | 'invalid_date'
  | 'invalid_url'
  | 'duplicate_id'
  | 'unknown_cv'
  | 'closed_reason_mismatch'
  | 'out_of_range'
  | 'too_large'

export type ImportErrorParams = Record<string, string | number | string[]>

/**
 * A problem found in an imported file. `path` locates it, e.g. "applications[2].status"
 * ("$" is the file itself). The UI turns code and params into text.
 */
export interface ImportError {
  code: ImportErrorCode
  path: string
  params?: ImportErrorParams
}

export type ImportResult =
  | { ok: true; state: AppState }
  | { ok: false; errors: ImportError[] }

export const MIN_REMINDER_DAYS = 1
export const MAX_REMINDER_DAYS = 365

function copyApplication(a: Application): Application {
  const copy: Application = {
    id: a.id,
    company: a.company,
    role: a.role,
    url: a.url,
    status: a.status,
    createdAt: a.createdAt,
  }
  if (a.cvId !== undefined) copy.cvId = a.cvId
  if (a.closedReason !== undefined) copy.closedReason = a.closedReason
  if (a.appliedAt !== undefined) copy.appliedAt = a.appliedAt
  if (a.repliedAt !== undefined) copy.repliedAt = a.repliedAt
  if (a.interviewAt !== undefined) copy.interviewAt = a.interviewAt
  if (a.offerAt !== undefined) copy.offerAt = a.offerAt
  if (a.notes !== undefined) copy.notes = a.notes
  if (a.closedFrom !== undefined) copy.closedFrom = a.closedFrom
  return copy
}

function copyCv(cv: Cv): Cv {
  const copy: Cv = { id: cv.id, name: cv.name }
  if (cv.createdAt !== undefined) copy.createdAt = cv.createdAt
  if (cv.file !== undefined) {
    copy.file = { fileName: cv.file.fileName, size: cv.file.size, type: cv.file.type }
  }
  return copy
}

/** Produces a versioned, JSON-serialisable copy of the state. */
export function exportData(state: AppState): ExportFile {
  return {
    version: EXPORT_VERSION,
    applications: state.applications.map(copyApplication),
    cvs: state.cvs.map(copyCv),
    settings: copySettings(state.settings),
  }
}

function copySettings(s: Settings): Settings {
  const copy: Settings = { reminderDays: s.reminderDays, language: s.language }
  if (s.lastExportAt !== undefined) copy.lastExportAt = s.lastExportAt
  if (s.lastCvId !== undefined) copy.lastCvId = s.lastCvId
  if (s.showWeekSummary !== undefined) copy.showWeekSummary = s.showWeekSummary
  return copy
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function error(code: ImportErrorCode, path: string, params?: ImportErrorParams): ImportError {
  return params === undefined ? { code, path } : { code, path, params }
}

function wrongType(path: string, expected: string, value: unknown): ImportError {
  return error('wrong_type', path, { expected, actual: typeName(value) })
}

/** The details of a CV's PDF, if the entry has one. The file itself is not part of the backup. */
function validateCvFileDetails(raw: unknown, path: string, errors: ImportError[]): CvFile | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) {
    errors.push(wrongType(path, 'object', raw))
    return undefined
  }
  const before = errors.length
  const { fileName, size, type } = raw

  if (fileName === undefined) errors.push(error('missing_field', `${path}.fileName`))
  else if (typeof fileName !== 'string') errors.push(wrongType(`${path}.fileName`, 'string', fileName))
  else if (fileName === '') errors.push(error('empty_value', `${path}.fileName`))
  else if (fileName.length > MAX_FILE_NAME_LENGTH) {
    errors.push(error('out_of_range', `${path}.fileName`, { min: 1, max: MAX_FILE_NAME_LENGTH }))
  }

  if (size === undefined) errors.push(error('missing_field', `${path}.size`))
  else if (typeof size !== 'number' || !Number.isInteger(size)) {
    errors.push(wrongType(`${path}.size`, 'integer', size))
  } else if (size < 1 || size > MAX_CV_FILE_BYTES) {
    errors.push(error('out_of_range', `${path}.size`, { min: 1, max: MAX_CV_FILE_BYTES }))
  }

  if (type === undefined) errors.push(error('missing_field', `${path}.type`))
  else if (type !== 'application/pdf') {
    errors.push(error('invalid_value', `${path}.type`, { allowed: ['application/pdf'] }))
  }

  if (errors.length > before) return undefined
  return { fileName: fileName as string, size: size as number, type: 'application/pdf' }
}

function validateCvs(raw: unknown, errors: ImportError[]): Cv[] {
  if (raw === undefined) {
    errors.push(error('missing_field', 'cvs'))
    return []
  }
  if (!Array.isArray(raw)) {
    errors.push(wrongType('cvs', 'array', raw))
    return []
  }
  const cvs: Cv[] = []
  const seen = new Set<string>()
  raw.forEach((item: unknown, i) => {
    const path = `cvs[${i}]`
    if (!isRecord(item)) {
      errors.push(wrongType(path, 'object', item))
      return
    }
    const before = errors.length
    const { id, name } = item
    if (id === undefined) errors.push(error('missing_field', `${path}.id`))
    else if (typeof id !== 'string') errors.push(wrongType(`${path}.id`, 'string', id))
    else if (id === '') errors.push(error('empty_value', `${path}.id`))
    else if (seen.has(id)) errors.push(error('duplicate_id', `${path}.id`, { id }))
    else seen.add(id)

    if (name === undefined) errors.push(error('missing_field', `${path}.name`))
    else if (typeof name !== 'string') errors.push(wrongType(`${path}.name`, 'string', name))
    else if (name === '') errors.push(error('empty_value', `${path}.name`))

    const createdAt = item['createdAt']
    if (createdAt !== undefined && !isIsoDate(createdAt)) {
      errors.push(error('invalid_date', `${path}.createdAt`))
    }
    const file = validateCvFileDetails(item['file'], `${path}.file`, errors)

    if (errors.length === before && typeof id === 'string' && typeof name === 'string') {
      const cv: Cv = { id, name }
      if (typeof createdAt === 'string') cv.createdAt = createdAt
      if (file !== undefined) cv.file = file
      cvs.push(cv)
    }
  })
  return cvs
}

function validateApplications(
  raw: unknown,
  cvIds: ReadonlySet<string>,
  errors: ImportError[],
): Application[] {
  if (raw === undefined) {
    errors.push(error('missing_field', 'applications'))
    return []
  }
  if (!Array.isArray(raw)) {
    errors.push(wrongType('applications', 'array', raw))
    return []
  }
  const applications: Application[] = []
  const seen = new Set<string>()

  raw.forEach((item: unknown, i) => {
    const path = `applications[${i}]`
    if (!isRecord(item)) {
      errors.push(wrongType(path, 'object', item))
      return
    }
    const before = errors.length

    const text = (field: string): string => {
      const v = item[field]
      if (v === undefined) errors.push(error('missing_field', `${path}.${field}`))
      else if (typeof v !== 'string') errors.push(wrongType(`${path}.${field}`, 'string', v))
      else return v
      return ''
    }
    const date = (field: string, required: boolean): string | undefined => {
      const v = item[field]
      if (v === undefined) {
        if (required) errors.push(error('missing_field', `${path}.${field}`))
        return undefined
      }
      if (!isIsoDate(v)) {
        errors.push(error('invalid_date', `${path}.${field}`))
        return undefined
      }
      return v
    }

    const id = text('id')
    if (typeof item['id'] === 'string') {
      if (id === '') errors.push(error('empty_value', `${path}.id`))
      else if (seen.has(id)) errors.push(error('duplicate_id', `${path}.id`, { id }))
      else seen.add(id)
    }
    const company = text('company').trim() // May be empty if there is a link.
    const role = text('role') // May be empty.
    const url = text('url').trim() // May be empty if there is a company; otherwise an http(s) link.
    if (typeof item['company'] === 'string' && typeof item['url'] === 'string' && company === '' && url === '') {
      errors.push(error('company_or_link_required', path))
    }
    if (typeof item['url'] === 'string' && url !== '' && !isHttpUrl(url)) {
      errors.push(error('invalid_url', `${path}.url`))
    }

    const status = item['status']
    if (status === undefined) {
      errors.push(error('missing_field', `${path}.status`))
    } else if (!isOneOf(STATUSES, status)) {
      errors.push(error('invalid_value', `${path}.status`, { allowed: [...STATUSES] }))
    }
    const validStatus = isOneOf(STATUSES, status) ? status : undefined

    const closedReason = item['closedReason']
    if (closedReason !== undefined && !isOneOf(CLOSED_REASONS, closedReason)) {
      errors.push(error('invalid_value', `${path}.closedReason`, { allowed: [...CLOSED_REASONS] }))
    } else if (validStatus === 'closed' && closedReason === undefined) {
      errors.push(error('closed_reason_mismatch', `${path}.closedReason`, { status: 'closed' }))
    } else if (validStatus !== undefined && validStatus !== 'closed' && closedReason !== undefined) {
      errors.push(error('closed_reason_mismatch', `${path}.closedReason`, { status: validStatus }))
    }

    // A CV is needed once the application has been sent; before that it may be missing.
    const rawCvId = item['cvId']
    let cvId: string | undefined
    if (rawCvId === undefined) {
      if (item['appliedAt'] !== undefined) errors.push(error('missing_field', `${path}.cvId`))
    } else if (typeof rawCvId !== 'string') {
      errors.push(wrongType(`${path}.cvId`, 'string', rawCvId))
    } else if (!cvIds.has(rawCvId)) {
      errors.push(error('unknown_cv', `${path}.cvId`, { cvId: rawCvId }))
    } else {
      cvId = rawCvId
    }

    const createdAt = date('createdAt', true)
    const appliedAt = date('appliedAt', false)
    const repliedAt = date('repliedAt', false)
    const interviewAt = date('interviewAt', false)
    const offerAt = date('offerAt', false)

    // A stage that is currently reached must have its date.
    const needs = (field: string, present: boolean): void => {
      if (!present && item[field] === undefined) errors.push(error('missing_field', `${path}.${field}`))
    }
    if (validStatus === 'applied' || validStatus === 'interview' || validStatus === 'offer') {
      needs('appliedAt', appliedAt !== undefined)
    }
    if (validStatus === 'interview' || validStatus === 'offer') {
      needs('interviewAt', interviewAt !== undefined)
    }
    if (validStatus === 'offer') needs('offerAt', offerAt !== undefined)

    const notes = item['notes']
    if (notes !== undefined && typeof notes !== 'string') {
      errors.push(wrongType(`${path}.notes`, 'string', notes))
    }
    // An old file's "toldThem" is not read: unknown fields are dropped.

    const closedFrom = item['closedFrom']
    if (closedFrom !== undefined) {
      if (!isOneOf(CLOSED_FROM, closedFrom)) {
        errors.push(error('invalid_value', `${path}.closedFrom`, { allowed: [...CLOSED_FROM] }))
      } else if (validStatus !== undefined && validStatus !== 'closed') {
        errors.push(error('closed_reason_mismatch', `${path}.closedFrom`, { status: validStatus }))
      }
    }

    if (errors.length === before && validStatus !== undefined && createdAt !== undefined) {
      const app: Application = {
        id,
        company,
        role,
        url,
        status: validStatus as Status,
        createdAt,
      }
      if (cvId !== undefined) app.cvId = cvId
      if (closedReason !== undefined) app.closedReason = closedReason as ClosedReason
      if (appliedAt !== undefined) app.appliedAt = appliedAt
      if (repliedAt !== undefined) app.repliedAt = repliedAt
      if (interviewAt !== undefined) app.interviewAt = interviewAt
      if (offerAt !== undefined) app.offerAt = offerAt
      if (typeof notes === 'string') app.notes = notes
      if (closedFrom !== undefined) app.closedFrom = closedFrom as ClosedFrom
      applications.push(app)
    }
  })
  return applications
}

function validateSettings(
  raw: unknown,
  cvIds: ReadonlySet<string>,
  errors: ImportError[],
): Settings | null {
  if (raw === undefined) {
    errors.push(error('missing_field', 'settings'))
    return null
  }
  if (!isRecord(raw)) {
    errors.push(wrongType('settings', 'object', raw))
    return null
  }
  const before = errors.length
  const { reminderDays, language, lastExportAt, lastCvId, showWeekSummary } = raw

  if (reminderDays === undefined) {
    errors.push(error('missing_field', 'settings.reminderDays'))
  } else if (typeof reminderDays !== 'number') {
    errors.push(wrongType('settings.reminderDays', 'integer', reminderDays))
  } else if (!Number.isInteger(reminderDays)) {
    errors.push(error('wrong_type', 'settings.reminderDays', { expected: 'integer', actual: 'number' }))
  } else if (reminderDays < MIN_REMINDER_DAYS || reminderDays > MAX_REMINDER_DAYS) {
    errors.push(
      error('out_of_range', 'settings.reminderDays', { min: MIN_REMINDER_DAYS, max: MAX_REMINDER_DAYS }),
    )
  }

  if (language === undefined) {
    errors.push(error('missing_field', 'settings.language'))
  } else if (!isOneOf(LANGUAGES, language)) {
    errors.push(error('invalid_value', 'settings.language', { allowed: [...LANGUAGES] }))
  }

  if (lastExportAt !== undefined && !isIsoDate(lastExportAt)) {
    errors.push(error('invalid_date', 'settings.lastExportAt'))
  }

  if (lastCvId !== undefined) {
    if (typeof lastCvId !== 'string') errors.push(wrongType('settings.lastCvId', 'string', lastCvId))
    else if (!cvIds.has(lastCvId)) errors.push(error('unknown_cv', 'settings.lastCvId', { cvId: lastCvId }))
  }

  if (showWeekSummary !== undefined && typeof showWeekSummary !== 'boolean') {
    errors.push(wrongType('settings.showWeekSummary', 'boolean', showWeekSummary))
  }

  if (errors.length > before) return null
  const settings: Settings = { reminderDays: reminderDays as number, language: language as Language }
  if (typeof lastExportAt === 'string') settings.lastExportAt = lastExportAt
  if (typeof lastCvId === 'string') settings.lastCvId = lastCvId
  if (typeof showWeekSummary === 'boolean') settings.showWeekSummary = showWeekSummary
  return settings
}

/**
 * Validates untrusted input and returns the parsed state, or a list of errors
 * (codes, not text). Never throws. Unknown extra fields are dropped.
 */
export function importData(raw: unknown): ImportResult {
  try {
    // Files from version 1 are upgraded first, so everything below checks the current shape.
    const input = migrateToLatest(raw)
    if (!isRecord(input)) return { ok: false, errors: [wrongType('$', 'object', input)] }

    const version = input['version']
    if (version === undefined) return { ok: false, errors: [error('missing_field', 'version')] }
    if (version !== EXPORT_VERSION) {
      return {
        ok: false,
        errors: [
          error('unsupported_version', 'version', {
            supported: EXPORT_VERSION,
            found: typeof version === 'number' || typeof version === 'string' ? version : typeName(version),
          }),
        ],
      }
    }

    const errors: ImportError[] = []
    const cvs = validateCvs(input['cvs'], errors)
    const cvIds = new Set(cvs.map((cv) => cv.id))
    const applications = validateApplications(input['applications'], cvIds, errors)
    const settings = validateSettings(input['settings'], cvIds, errors)

    if (errors.length > 0 || settings === null) return { ok: false, errors }
    return { ok: true, state: { applications, cvs, settings } }
  } catch {
    return { ok: false, errors: [error('unreadable', '$')] }
  }
}
