import type { Application, Cv, IsoDate } from './types'

export interface CvStats {
  /** null for the group of applications sent without a CV; its name is then empty. */
  cvId: string | null
  name: string
  applied: number
  replied: number
  interviews: number
}

function countApplied(applications: readonly Application[]): Omit<CvStats, 'cvId' | 'name'> {
  return {
    applied: applications.length,
    replied: applications.filter((a) => a.repliedAt !== undefined).length,
    interviews: applications.filter((a) => a.interviewAt !== undefined).length,
  }
}

/**
 * Per CV, in the order of `cvs`:
 * - applied: applications with an appliedAt date
 * - replied: applied applications with a repliedAt date
 * - interviews: applied applications that have an interviewAt date
 * Applied applications without a CV are their own group, last, with cvId null; it is only
 * there when it has at least one application. Applications that point to an unknown CV are
 * not counted.
 */
export function replyStatsByCv(
  applications: readonly Application[],
  cvs: readonly Cv[],
): CvStats[] {
  const stats: CvStats[] = cvs.map((cv) => ({
    cvId: cv.id,
    name: cv.name,
    ...countApplied(applications.filter((a) => a.cvId === cv.id && a.appliedAt !== undefined)),
  }))
  const withoutCv = applications.filter((a) => a.cvId === undefined && a.appliedAt !== undefined)
  if (withoutCv.length > 0) stats.push({ cvId: null, name: '', ...countApplied(withoutCv) })
  return stats
}

/**
 * Number of applications with appliedAt in the current week, Monday 00:00 up to
 * the next Monday 00:00, in the local time zone of the runtime.
 */
export function applicationsThisWeek(
  applications: readonly Application[],
  now: IsoDate,
): number {
  const current = new Date(now)
  if (Number.isNaN(current.getTime())) return 0

  const daysSinceMonday = (current.getDay() + 6) % 7
  const y = current.getFullYear()
  const m = current.getMonth()
  const d = current.getDate()
  const start = new Date(y, m, d - daysSinceMonday).getTime()
  const end = new Date(y, m, d - daysSinceMonday + 7).getTime()

  return applications.filter((a) => {
    if (a.appliedAt === undefined) return false
    const t = Date.parse(a.appliedAt)
    return t >= start && t < end
  }).length
}
