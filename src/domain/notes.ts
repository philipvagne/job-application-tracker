export const NOTE_PREVIEW_MAX = 70

export interface NotePreview {
  /** The first non-empty line, trimmed, and cut at `max` graphemes when it is longer. */
  text: string
  /** The line was cut, so the row shows an ellipsis after it. */
  truncated: boolean
  /** There is more to read: the line was cut, or more non-empty lines follow it. */
  hasMore: boolean
}

type Segmenter = { segment(input: string): Iterable<{ segment: string }> }

/** Characters as a reader sees them: "å" written as a + ring, or a family emoji, count as one. */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter: Segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (part) => part.segment)
  }
  return Array.from(text) // Older browsers: code points, which never split a surrogate pair.
}

/**
 * What a row shows of a note: the first non-empty line cut at `max` graphemes (never inside a
 * character), and whether there is more to open. Null if the note is missing or only whitespace.
 */
export function notePreview(notes: string | undefined, max: number = NOTE_PREVIEW_MAX): NotePreview | null {
  if (notes === undefined) return null
  const lines = notes
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const first = lines[0]
  if (first === undefined) return null
  const parts = graphemes(first)
  const moreLines = lines.length > 1
  if (parts.length <= max) return { text: first, truncated: false, hasMore: moreLines }
  return { text: parts.slice(0, max).join('').trimEnd(), truncated: true, hasMore: true }
}
