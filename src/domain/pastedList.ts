import { linkKey } from './duplicates'
import { parseJobTitle } from './parseJobTitle'
import { isHttpUrl } from './url'

export const MAX_PASTED_LINES = 200
export const MAX_PASTED_COMPANY_LENGTH = 120

export interface PastedItem {
  url: string
  company: string
  role: string
}

export interface PastedList {
  items: PastedItem[]
  /** Lines that were not usable: other kinds of links, unusable links, text that is too long, and lines beyond the cap. */
  skipped: number
  /** Links that are already in the list, or repeat an earlier line of the paste. They are left out of `items`. */
  duplicates: number
}

// A scheme followed by // is a link of some kind; these schemes are links without //.
const LINK_LIKE = /^(?:[a-z][a-z0-9+.-]*:\/\/|(?:javascript|data|vbscript|blob|file|about):)/i

/**
 * Turns pasted text into applications to add. Blank lines are ignored and only the
 * first 200 non-blank lines are read.
 * - An http(s) link becomes { url, company: "", role: "" }; the list shows the website name.
 *   A link that is already in `existing` (see linkKey), or earlier in the paste, is counted
 *   in `duplicates` and left out.
 * - Other links (javascript:, data:, ftp:// ...) are skipped.
 * - Other text goes through parseJobTitle for role and company; if that is not sure,
 *   the whole line is the company, unless it is longer than 120 characters (skipped).
 */
export function parsePastedList(text: string, existing: readonly { url: string }[] = []): PastedList {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')

  const items: PastedItem[] = []
  let skipped = Math.max(0, lines.length - MAX_PASTED_LINES)
  let duplicates = 0
  const seen = new Set<string>()
  for (const { url } of existing) {
    const key = linkKey(url)
    if (key !== null) seen.add(key)
  }

  for (const line of lines.slice(0, MAX_PASTED_LINES)) {
    if (isHttpUrl(line)) {
      const key = linkKey(line)
      if (key !== null && seen.has(key)) {
        duplicates += 1
        continue
      }
      if (key !== null) seen.add(key)
      items.push({ url: line, company: '', role: '' })
      continue
    }
    if (LINK_LIKE.test(line)) {
      skipped += 1
      continue
    }
    const parsed = parseJobTitle(line)
    if (parsed.company !== null && parsed.role !== null) {
      items.push({ url: '', company: parsed.company, role: parsed.role })
    } else if (line.length <= MAX_PASTED_COMPANY_LENGTH) {
      items.push({ url: '', company: line, role: '' })
    } else {
      skipped += 1
    }
  }
  return { items, skipped, duplicates }
}
