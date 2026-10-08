const MAX_URL_LENGTH = 2048

function parseHttpUrl(text: string): URL | null {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) return null
  // Exactly two slashes before the host: browsers would read "http:///x" as host "x".
  if (!/^https?:\/\/[^/\\]/i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' ? url : null
  } catch {
    return null
  }
}

/** True for an absolute http or https link. Rejects javascript:, data:, file: and everything else. */
export function isHttpUrl(text: unknown): boolean {
  return typeof text === 'string' && parseHttpUrl(text) !== null
}

/** The host of an http(s) link without a leading "www.", or null if it is not one. */
export function hostOf(text: string): string | null {
  const url = parseHttpUrl(text)
  if (url === null) return null
  return url.hostname.replace(/^www\./i, '')
}

/**
 * The link to use as an href: the trimmed text if it is an http or https link, else null.
 * Rows only ever make links from this, so javascript:, data: and other schemes never become one.
 */
export function openableLink(text: string): string | null {
  return parseHttpUrl(text) === null ? null : text.trim()
}

const LINKEDIN_JOB_PAGE = /^\/jobs\/view\/(?:[^/]*-)?(\d{1,20})\/?$/
const PLATSBANKEN_AD_PAGE = /^\/platsbanken\/annonser\/(\d{1,12})\/?$/
const LINKEDIN_JOB_ID = /^\d{1,20}$/

/** The job number in `?currentJobId=` on a LinkedIn /jobs/ page (search results, collections), if there is exactly one and it is digits. */
function currentJobId(url: URL): string | undefined {
  if (!url.pathname.startsWith('/jobs/')) return undefined
  const values = url.searchParams.getAll('currentJobId')
  const [value] = values
  return values.length === 1 && value !== undefined && LINKEDIN_JOB_ID.test(value) ? value : undefined
}

/**
 * The short public address of a job ad, for the two sites where the address in the browser is
 * long or depends on a search: a LinkedIn job (a /jobs/view/ page with or without a slug, or any
 * /jobs/ page with ?currentJobId=) becomes https://www.linkedin.com/jobs/view/<number>, and a
 * Platsbanken ad becomes https://arbetsformedlingen.se/platsbanken/annonser/<number>. Query,
 * fragment and login details are dropped. Anything else (other pages, other sites, links with a
 * port, text that is not an http(s) link) is returned exactly as given.
 */
export function cleanJobLink(text: string): string {
  const url = parseHttpUrl(text)
  if (url === null || url.port !== '') return text
  const host = url.hostname.toLowerCase()
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    const id = LINKEDIN_JOB_PAGE.exec(url.pathname)?.[1] ?? currentJobId(url)
    return id === undefined ? text : `https://www.linkedin.com/jobs/view/${id}`
  }
  if (host === 'arbetsformedlingen.se' || host === 'www.arbetsformedlingen.se') {
    const id = PLATSBANKEN_AD_PAGE.exec(url.pathname)?.[1]
    return id === undefined ? text : `https://arbetsformedlingen.se/platsbanken/annonser/${id}`
  }
  return text
}
