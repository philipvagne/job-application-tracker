import type { Application } from './types'

/** How many applications point to this CV, in any status. */
export function applicationsUsingCv(applications: readonly Application[], cvId: string): number {
  return applications.filter((a) => a.cvId === cvId).length
}
