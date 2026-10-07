export interface ParsedJobTitle {
  role: string | null
  company: string | null
}

const SITES = new Set([
  'linkedin',
  'indeed',
  'glassdoor',
  'monster',
  'platsbanken',
  'arbetsförmedlingen',
  'jobbsafari',
  'jooble',
])

function none(): ParsedJobTitle {
  return { role: null, company: null }
}

/**
 * Best-effort split of a page title such as
 * "Frontend Developer - Acme AB | LinkedIn" into role and company.
 * Returns nulls for both when it is not sure.
 */
export function parseJobTitle(title: unknown): ParsedJobTitle {
  if (typeof title !== 'string') return none()

  const cleaned = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\(\d+\)\s*/, '')
  if (cleaned === '' || cleaned.length > 300) return none()

  const parts = cleaned
    .split(/\s+[|\-–—]\s+/)
    .map((p) => p.trim())
    .filter((p) => p !== '' && !SITES.has(p.toLowerCase()))

  if (parts.length === 2) {
    const [role, company] = parts
    if (role && company) return { role, company }
  }

  if (parts.length === 1) {
    const match = /^(.+?)\s+(?:at|hos|@)\s+(.+)$/i.exec(parts[0] ?? '')
    if (match?.[1] && match[2]) return { role: match[1].trim(), company: match[2].trim() }
  }

  return none()
}
