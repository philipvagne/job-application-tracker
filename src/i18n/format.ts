import type { Language } from '../domain'

/** "113 KB" or "1.2 MB" (decimal comma in Swedish). Sizes are in 1024-based units. */
export function formatFileSize(bytes: number, language: Language): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  const number = (value: number, digits: number): string =>
    new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  if (bytes < 1024 * 1024) return `${number(Math.max(1, Math.round(bytes / 1024)), 0)} KB`
  return `${number(Math.round((bytes / (1024 * 1024)) * 10) / 10, 1)} MB`
}
