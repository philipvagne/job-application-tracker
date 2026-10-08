import type { Application } from './types'
import { cleanJobLink, hostOf } from './url'

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid)$/i

/**
 * A comparable form of a link, or null if it is not an http(s) link. Scheme and host are
 * lower case, "www." and a trailing slash are dropped, and so are the fragment and tracking
 * parameters (utm_*, fbclid, gclid). Other parameters stay: job ids often live there.
 * LinkedIn and Platsbanken job links are first made short (see cleanJobLink), so the same job
 * from a search page and from its own page has the same key, also for links saved long.
 */
export function linkKey(text: string): string | null {
  const cleaned = cleanJobLink(text)
  const host = hostOf(cleaned)
  if (host === null) return null
  try {
    const url = new URL(cleaned.trim())
    const kept = [...url.searchParams].filter(([name]) => !TRACKING_PARAM.test(name))
    const query = new URLSearchParams(kept).toString()
    const pathname = url.pathname.replace(/\/+$/, '')
    return `${host.toLowerCase()}${url.port === '' ? '' : `:${url.port}`}${pathname}${query === '' ? '' : `?${query}`}`
  } catch {
    return null
  }
}

/** The first application whose link is the same as `url` (see linkKey), in any status, or null. */
export function findByLink(applications: readonly Application[], url: string): Application | null {
  const key = linkKey(url)
  if (key === null) return null
  return applications.find((a) => linkKey(a.url) === key) ?? null
}
