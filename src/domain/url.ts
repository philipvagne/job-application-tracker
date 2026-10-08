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
