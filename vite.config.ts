import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * The headers of every "/*" block in public/_headers, so `npm run preview` sends the same
 * security headers as the live site. _headers stays the single source of truth.
 */
function previewHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  let inAllPaths = false
  for (const line of readFileSync('public/_headers', 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      inAllPaths = line.trim() === '/*'
      continue
    }
    const colon = line.indexOf(':')
    if (inAllPaths && colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return headers
}

export default defineConfig({
  plugins: [react()],
  preview: { headers: previewHeaders() },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Fixed zone so week-boundary tests behave the same locally and in CI.
    env: { TZ: 'Europe/Stockholm' },
  },
})
