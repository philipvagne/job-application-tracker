import { bookmarkVersionOfPayload, isOutdatedBookmarkVersion } from './bookmarkVersion'
import { isHttpUrl } from './url'

/** The only payload version this app reads. */
export const ADD_PAYLOAD_VERSION = '1'
/**
 * The newest bookmarklet version this tracker knows. The bookmarklet sends it as `bv`; a payload
 * without it, or with a lower number, comes from a bookmark that should be made again.
 */
export const CURRENT_BOOKMARK_VERSION = 3
/** Company and role are cut at this many characters. */
export const MAX_ADD_TEXT_LENGTH = 200
/** A longer address fragment is not read at all. A link is at most 2048 characters, plus a few short fields. */
const MAX_ADD_HASH_LENGTH = 8192

/** What the quick-add card is filled with. Empty text means "nothing known". */
export interface AddPrefill {
  link: string
  company: string
  role: string
  /** The version of the bookmark that sent this (1 when it did not say). */
  bookmarkVersion: number
  /** True when that is older than the current version. */
  outdatedBookmark: boolean
}

/**
 * The result of reading an address fragment like
 * `#add=1&v=1&bv=3&u=<link>&jo=<company>&jt=<role>&dt=<page title>`.
 * `none`: it is not an add payload at all (no `add` key), so leave the address alone.
 * `invalid`: it is one, but cannot be used.
 */
export type AddHashResult = { kind: 'none' } | { kind: 'invalid' } | { kind: 'prefill'; prefill: AddPrefill }

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function codePointText(code: number): string | null {
  const valid = code >= 1 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
  return valid ? String.fromCodePoint(code) : null
}

/** Job ads often publish titles with HTML entities ("R&amp;D"). Decoded once, as plain text, never as HTML. */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi, (whole, dec?: string, hex?: string, name?: string) => {
    if (dec !== undefined) return codePointText(Number(dec)) ?? whole
    if (hex !== undefined) return codePointText(parseInt(hex, 16)) ?? whole
    return name === undefined ? whole : (NAMED_ENTITIES[name.toLowerCase()] ?? whole)
  })
}

/**
 * Plain text for a company or role: entities decoded, then HTML tags (<br>, <b>) replaced by a
 * space (a lone "<" as in "5 < 6" stays), control characters turned into spaces,
 * invisible formatting characters (zero-width, text-direction overrides) removed, whitespace
 * collapsed, trimmed and cut at MAX_ADD_TEXT_LENGTH characters.
 */
export function cleanAddText(raw: string): string {
  const text = decodeEntities(raw)
    .replace(/<\/?[a-z][^<>]*>/gi, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return Array.from(text).slice(0, MAX_ADD_TEXT_LENGTH).join('').trim()
}

/** The single value of a parameter: null when it is absent, undefined when it is given more than once. */
function single(params: URLSearchParams, name: string): string | null | undefined {
  const all = params.getAll(name)
  if (all.length === 0) return null
  return all.length === 1 ? all[0] : undefined
}

/**
 * Reads the address fragment (with or without the leading "#") that the bookmarklet sends.
 * Anything unexpected makes the whole payload invalid rather than half-used: a wrong version,
 * a repeated field, a missing or non-http(s) link. The page title (`dt`) is sent but not used yet.
 * Fields of older bookmarks that are no longer used (`oc`, `dl`) are ignored.
 */
export function readAddHash(hash: string): AddHashResult {
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  if (!/(?:^|&)add=/.test(body)) return { kind: 'none' }
  if (body.length > MAX_ADD_HASH_LENGTH) return { kind: 'invalid' }

  const params = new URLSearchParams(body)
  const version = single(params, 'v')
  const link = single(params, 'u')
  const company = single(params, 'jo')
  const role = single(params, 'jt')
  const bookmarkVersion = single(params, 'bv')
  if (version !== ADD_PAYLOAD_VERSION) return { kind: 'invalid' }
  if (link === null || link === undefined || company === undefined || role === undefined) return { kind: 'invalid' }
  if (bookmarkVersion === undefined) return { kind: 'invalid' }

  const sentBy = bookmarkVersionOfPayload(bookmarkVersion)
  const trimmedLink = link.trim()
  if (!isHttpUrl(trimmedLink)) return { kind: 'invalid' }
  return {
    kind: 'prefill',
    prefill: {
      link: trimmedLink,
      company: cleanAddText(company ?? ''),
      role: cleanAddText(role ?? ''),
      bookmarkVersion: sentBy,
      outdatedBookmark: isOutdatedBookmarkVersion(sentBy, CURRENT_BOOKMARK_VERSION),
    },
  }
}
