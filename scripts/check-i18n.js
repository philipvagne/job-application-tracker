// Checks that the Swedish and English language files match. No dependencies.
// Run: node scripts/check-i18n.js   (also run by `npm test` and `npm run build`)
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Turns a nested dictionary into [path, value] pairs, e.g. ["banner.notSaved.title", "..."]. */
function flatten(node, prefix = '') {
  const entries = []
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (isObject(value)) entries.push(...flatten(value, path))
    else entries.push([path, value])
  }
  return entries
}

function placeholders(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
}

/** Returns a list of problems (empty when the files are consistent). */
export function checkDictionaries(en, sv) {
  const problems = []
  const left = new Map(flatten(en))
  const right = new Map(flatten(sv))

  for (const key of left.keys()) if (!right.has(key)) problems.push(`Missing in sv: ${key}`)
  for (const key of right.keys()) if (!left.has(key)) problems.push(`Missing in en: ${key}`)

  for (const [name, map] of [
    ['en', left],
    ['sv', right],
  ]) {
    for (const [key, value] of map) {
      if (typeof value !== 'string') problems.push(`Not a string in ${name}: ${key}`)
      else if (value.trim() === '') problems.push(`Empty value in ${name}: ${key}`)
    }
  }

  for (const [key, a] of left) {
    const b = right.get(key)
    if (typeof a !== 'string' || typeof b !== 'string') continue
    if (placeholders(a).join() !== placeholders(b).join()) {
      problems.push(`Different {placeholders} in ${key}: en has [${placeholders(a)}], sv has [${placeholders(b)}]`)
    }
  }
  return problems
}

function readJson(relative) {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'))
}

function main() {
  let problems
  try {
    problems = checkDictionaries(readJson('../src/i18n/en.json'), readJson('../src/i18n/sv.json'))
  } catch (e) {
    problems = [`Could not read the language files: ${e instanceof Error ? e.message : String(e)}`]
  }
  if (problems.length > 0) {
    console.error(`Language files are inconsistent:\n- ${problems.join('\n- ')}`)
    process.exit(1)
  }
  console.log('Language files OK')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
