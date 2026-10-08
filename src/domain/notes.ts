export const NOTE_PREVIEW_MAX = 200

/**
 * The first non-empty line of a note, trimmed and cut at `max` characters (with an ellipsis),
 * or null if the note is missing or only whitespace. The row shows this, so a long note is
 * never rendered in full there.
 */
export function firstNoteLine(notes: string | undefined, max: number = NOTE_PREVIEW_MAX): string | null {
  if (notes === undefined) return null
  const line = notes
    .split(/\r\n|\r|\n/)
    .map((part) => part.trim())
    .find((part) => part !== '')
  if (line === undefined) return null
  const chars = Array.from(line)
  return chars.length > max ? `${chars.slice(0, max).join('').trimEnd()}…` : line
}
