export const STATUSES = ['to_apply', 'applied', 'interview', 'offer', 'closed'] as const
export type Status = (typeof STATUSES)[number]

export const CLOSED_REASONS = ['no_reply', 'declined', 'withdrawn'] as const
export type ClosedReason = (typeof CLOSED_REASONS)[number]

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
  cvId: string
  createdAt: IsoDate
  appliedAt?: IsoDate
  repliedAt?: IsoDate
  /** First time the application reached interview. Never cleared. */
  interviewAt?: IsoDate
  /** First time the application reached offer. Never cleared. */
  offerAt?: IsoDate
  notes?: string
}

export interface Cv {
  id: string
  name: string
}

export interface Settings {
  reminderDays: number
  language: Language
}

export interface AppState {
  applications: Application[]
  cvs: Cv[]
  settings: Settings
}

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }
