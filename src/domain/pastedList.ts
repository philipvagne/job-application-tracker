import { linkKey } from './duplicates'
import { isHttpUrl } from './url'

export const MAX_PASTED_LINES = 200

export interface PastedItem {
  url: string
  company: string
  role: string
}

export interface PastedList {
  items: PastedItem[]
  /** Lines that were not usable: anything that is not an http(s) link, and lines beyond the cap. */
  skipped: number
  /** Links that are already in the list, or repeat an earlier line of the paste. They are left out of `items`. */
  duplicates: number
}

/**
 * Turns pasted text into applications to add. Blank lines are ignored and only the
 * first 200 non-blank lines are read.
 * - An http(s) link becomes { url, company: "", role: "" }; the list shows the website name.
 *   A link that is already in `existing` (see linkKey), or earlier in the paste, is counted
 *   in `duplicates` and left out.
 * - Every other line (other kinds of links such as javascript: or ftp://, or plain text)
 *   is skipped. Plain text is never turned into a company.
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
    if (!isHttpUrl(line)) {
      skipped += 1
      continue
    }
    const key = linkKey(line)
    if (key !== null && seen.has(key)) {
      duplicates += 1
      continue
    }
    if (key !== null) seen.add(key)
    items.push({ url: line, company: '', role: '' })
  }
  return { items, skipped, duplicates }
}
