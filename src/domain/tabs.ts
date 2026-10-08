import { STATUSES, type Application, type Status } from './types'

/** One tab per status, in display order. */
export const TABS: readonly Status[] = STATUSES

export function applicationsWithStatus(applications: readonly Application[], status: Status): Application[] {
  return applications.filter((a) => a.status === status)
}

/** How many applications each tab holds. Every application is in exactly one tab. */
export function countsByStatus(applications: readonly Application[]): Record<Status, number> {
  const counts: Record<Status, number> = { to_apply: 0, applied: 0, interview: 0, offer: 0, closed: 0 }
  for (const a of applications) counts[a.status] += 1
  return counts
}

/** The tab to show first: to_apply if it has anything, else the first tab that does, else to_apply. */
export function defaultTab(applications: readonly Application[]): Status {
  const counts = countsByStatus(applications)
  if (counts.to_apply > 0) return 'to_apply'
  return TABS.find((tab) => counts[tab] > 0) ?? 'to_apply'
}

/**
 * The tab to select after a key press on a tab, or null if the key does nothing.
 * Arrow keys wrap around; Home and End go to the first and last tab.
 */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count
    case 'ArrowLeft':
      return (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
