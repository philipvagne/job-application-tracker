import { describe, expect, it } from 'vitest'
import { importData, type ImportError, type ImportErrorCode } from '../domain'
import { readImportText } from '../storage'
import { formatImportError, formatImportPath } from './importErrors'
import { dictionaries } from './t'

const en = dictionaries.en
const sv = dictionaries.sv

describe('formatImportPath', () => {
  it('numbers list items from 1 and translates nested names', () => {
    expect(formatImportPath('applications[0].status', en)).toBe('Applications, #1, status')
    expect(formatImportPath('applications[1].closedReason', sv)).toBe('Ansökningar, #2, orsak till avslut')
    expect(formatImportPath('cvs[2]', en)).toBe('CV list, #3')
    expect(formatImportPath('cvs[2].name', sv)).toBe('CV-listan, #3, namn')
  })

  it('keeps unknown names and paths that do not start with a known part', () => {
    expect(formatImportPath('applications[0].extra', en)).toBe('Applications, #1, extra')
    expect(formatImportPath('version', en)).toBe('version')
    expect(formatImportPath('$', en)).toBe('$')
    expect(formatImportPath('a.status', en)).toBe('a.status')
    expect(formatImportPath('constructor', en)).toBe('constructor')
    expect(formatImportPath('applications[x]', en)).toBe('applications[x]')
  })
})

describe('formatImportError', () => {
  it('fills in params', () => {
    const error: ImportError = { code: 'out_of_range', path: 'settings.reminderDays', params: { min: 1, max: 365 } }
    expect(formatImportError(error, en)).toBe('Settings, reminder days: must be a whole number from 1 to 365.')
    expect(formatImportError(error, sv)).toBe('Inställningar, dagar till påminnelse: måste vara ett heltal från 1 till 365.')
  })

  it('shows friendly names for the top-level parts', () => {
    expect(formatImportError({ code: 'missing_field', path: 'cvs' }, en)).toBe('CV list: a required value is missing.')
    expect(formatImportError({ code: 'missing_field', path: 'cvs' }, sv)).toBe('CV-listan: ett obligatoriskt värde saknas.')
    expect(formatImportError({ code: 'missing_field', path: 'applications' }, en)).toBe(
      'Applications: a required value is missing.',
    )
  })

  it('translates type names and joins lists', () => {
    expect(
      formatImportError({ code: 'wrong_type', path: 'cvs', params: { expected: 'array', actual: 'string' } }, sv),
    ).toBe('CV-listan: förväntade en lista, men hittade text.')
    expect(
      formatImportError({ code: 'invalid_value', path: 'a.status', params: { allowed: ['x', 'y'] } }, en),
    ).toBe('a.status: this value isn\'t allowed. Allowed values: x, y.')
  })

  it('keeps an unknown type name as it is', () => {
    expect(
      formatImportError({ code: 'wrong_type', path: 'p', params: { expected: 'object', actual: 'bigint' } }, en),
    ).toBe('p: expected an object, but found bigint.')
  })

  it('shows the size limit in megabytes', () => {
    expect(
      formatImportError({ code: 'too_large', path: '$', params: { maxBytes: 2 * 1024 * 1024 } }, en),
    ).toBe('The file is larger than 2 MB.')
  })

  it('shows text from the file as plain text, unchanged', () => {
    const text = formatImportError(
      { code: 'duplicate_id', path: 'applications[1].id', params: { id: '<img src=x onerror=alert(1)>' } },
      en,
    )
    expect(text).toContain('<img src=x onerror=alert(1)>')
  })

  it('has a message with no leftover placeholder for every real error', () => {
    const codes: ImportErrorCode[] = [
      'unreadable',
      'unsupported_version',
      'missing_field',
      'wrong_type',
      'invalid_value',
      'empty_value',
      'invalid_date',
      'invalid_url',
      'duplicate_id',
      'unknown_cv',
      'closed_reason_mismatch',
      'out_of_range',
      'too_large',
    ]
    const bad = [
      ['unreadable text', 'not json'],
      ['too large', 'x'.repeat(10)],
      ['version', JSON.stringify({ version: 9 })],
      ['empty', '{"version":1}'],
      ['types', JSON.stringify({ version: 1, cvs: 'x', applications: {}, settings: [] })],
      [
        'values',
        JSON.stringify({
          version: 1,
          cvs: [{ id: 'c', name: '' }, { id: 'c', name: 'n' }],
          applications: [
            { id: 'a', company: 'c', role: 'r', url: '', status: 'nope', cvId: 'zzz', createdAt: 'x', appliedAt: 'x' },
            { id: 'a', company: 'c', role: 'r', url: '', status: 'closed', cvId: 'c', createdAt: '2026-10-01T00:00:00.000Z' },
          ],
          settings: { reminderDays: 999, language: 'fr', lastExportAt: 'x' },
        }),
      ],
    ] as const
    const seen = new Set<ImportErrorCode>()
    for (const [name, text] of bad) {
      const result = name === 'too large' ? readImportText(text, 5) : readImportText(text)
      if (result.ok) throw new Error(`${name} should fail`)
      for (const error of result.errors) {
        seen.add(error.code)
        for (const dict of [en, sv]) expect(formatImportError(error, dict)).not.toMatch(/\{\w+\}|importErrors\./)
      }
    }
    // Codes not reachable from the samples above are still formatted without leftovers.
    for (const code of codes) {
      for (const dict of [en, sv]) {
        const text = formatImportError({ code, path: 'p', params: { found: 2, supported: 1, expected: 'array', actual: 'null', allowed: ['a'], id: 'i', cvId: 'c', status: 's', min: 1, max: 2, maxBytes: 1048576 } }, dict)
        expect(text).not.toMatch(/\{\w+\}|importErrors\./)
      }
    }
    expect(importData(null).ok).toBe(false)
    expect(seen.size).toBeGreaterThan(6)
  })
})
