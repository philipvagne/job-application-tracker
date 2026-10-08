export const STATUSES = ['to_apply', 'applied', 'interview', 'offer', 'closed'] as const
export type Status = (typeof STATUSES)[number]

/**
 * `declined` (the older, ambiguous one: it never said who said no) and `withdrawn` are
 * legacy reasons. They are still read and shown, but no longer offered: see
 * SELECTABLE_CLOSED_REASONS.
 */
export const CLOSED_REASONS = ['no_reply', 'not_selected', 'declined_offer', 'declined', 'withdrawn'] as const
export type ClosedReason = (typeof CLOSED_REASONS)[number]

/** The reasons a user can pick when closing an application. */
export const SELECTABLE_CLOSED_REASONS = ['no_reply', 'not_selected', 'declined_offer'] as const

/** The stages an application can be closed from. */
export const CLOSED_FROM = ['to_apply', 'applied', 'interview', 'offer'] as const
export type ClosedFrom = (typeof CLOSED_FROM)[number]

export const LANGUAGES = ['sv', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** All dates are ISO 8601 strings with a time and a zone, e.g. 2026-10-07T09:30:00.000Z. */
export type IsoDate = string

export interface Application {
  id: string
  company: string
  role: string
  url: string
  status: Status
  closedReason?: ClosedReason
  /** The CV used. Optional: an application can be sent without choosing a CV. */
  cvId?: string
  createdAt: IsoDate
  appliedAt?: IsoDate
  repliedAt?: IsoDate
  /** First time the application reached interview. Never cleared. */
  interviewAt?: IsoDate
  /** First time the application reached offer. Never cleared. */
  offerAt?: IsoDate
  notes?: string
  /** The stage the application was at when it was closed. Only present while closed. */
  closedFrom?: ClosedFrom
}

/** Details of the PDF stored for a CV entry. The file itself lives in IndexedDB under the CV's id. */
export interface CvFile {
  fileName: string
  size: number
  type: 'application/pdf'
}

/** A CV entry. Never edited after it is added: a new version is a new entry. */
export interface Cv {
  id: string
  name: string
  createdAt?: IsoDate
  /** Missing for a CV that is only a name. */
  file?: CvFile
}

export interface Settings {
  reminderDays: number
  language: Language
  /** When the user last exported a backup. Absent if they never have. */
  lastExportAt?: IsoDate
  /** The CV used for the latest application. Must be an existing CV when present. */
  lastCvId?: string
  /** Show "N applications this week" above the lists. Absent means off. */
  showWeekSummary?: boolean
}

export interface AppState {
  applications: Application[]
  cvs: Cv[]
  settings: Settings
}

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }
