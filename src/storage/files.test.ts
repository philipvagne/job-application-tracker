import { describe, expect, it } from 'vitest'
import { importData, type AppState } from '../domain'
import { MAX_IMPORT_BYTES, buildExportFile, readImportText } from './files'

const state: AppState = {
  cvs: [{ id: 'cv1', name: 'Långt CV' }],
  settings: { reminderDays: 14, language: 'en' },
  applications: [
    {
      id: 'a1',
      company: 'Acme <script>alert(1)</script>',
      role: 'Dev',
      url: 'https://example.com/1',
      status: 'to_apply',
      cvId: 'cv1',
      createdAt: '2026-10-01T08:00:00.000Z',
      notes: 'Rad ett\n"citat" 😀',
    },
  ],
}

describe('buildExportFile', () => {
  it('names the file with the local date', () => {
    // TZ is Europe/Stockholm: 23:30Z on 31 Dec is already 1 Jan locally.
    expect(buildExportFile(state, '2026-12-31T23:30:00.000Z').filename).toBe('job-tracker-backup-2027-01-01.json')
    expect(buildExportFile(state, '2026-10-07T09:00:00.000Z').filename).toBe('job-tracker-backup-2026-10-07.json')
  })

  it('records now as lastExportAt without changing the input state', () => {
    const now = '2026-10-07T09:00:00.000Z'
    const file = buildExportFile(state, now)
    expect(JSON.parse(file.content).settings.lastExportAt).toBe(now)
    expect(state.settings.lastExportAt).toBeUndefined()
  })

  it('round-trips through readImportText', () => {
    const now = '2026-10-07T09:00:00.000Z'
    const result = readImportText(buildExportFile(state, now).content)
    expect(result).toEqual({
      ok: true,
      state: { ...state, settings: { ...state.settings, lastExportAt: now } },
    })
  })

  it('falls back to a plain name for an unparseable now', () => {
    const file = buildExportFile(state, 'garbage')
    expect(file.filename).toBe('job-tracker-backup.json')
    expect(JSON.parse(file.content).settings.lastExportAt).toBeUndefined()
  })
})

describe('readImportText', () => {
  const good = buildExportFile(state, '2026-10-07T09:00:00.000Z').content

  it('has a 2 MiB default limit', () => {
    expect(MAX_IMPORT_BYTES).toBe(2 * 1024 * 1024)
  })

  it('rejects input over the limit', () => {
    expect(readImportText(good, 10)).toEqual({
      ok: false,
      errors: [{ code: 'too_large', path: '$', params: { maxBytes: 10 } }],
    })
  })

  it('measures UTF-8 bytes, not characters, and allows exactly the limit', () => {
    const text = '"ååå"' // 5 characters, 8 bytes
    expect(readImportText(text, 7)).toMatchObject({ ok: false, errors: [{ code: 'too_large' }] })
    expect(readImportText(text, 8)).toMatchObject({ ok: false, errors: [{ code: 'wrong_type' }] })
  })

  it('rejects oversized input without parsing it', () => {
    const huge = '['.repeat(MAX_IMPORT_BYTES + 1)
    expect(readImportText(huge)).toMatchObject({ ok: false, errors: [{ code: 'too_large' }] })
  })

  it.each([[''], ['   '], ['{"version":1,'], ['not json'], ['undefined']])('rejects malformed JSON %j', (text) => {
    expect(readImportText(text)).toEqual({ ok: false, errors: [{ code: 'unreadable', path: '$' }] })
  })

  it('passes parsed-but-invalid content to importData and returns its errors', () => {
    expect(readImportText('[]')).toEqual(importData([]))
    expect(readImportText('{"version":2}')).toEqual(importData({ version: 2 }))
    expect(readImportText('null')).toEqual(importData(null))
  })

  it('strips a leading BOM', () => {
    const result = readImportText('﻿' + good)
    expect(result.ok).toBe(true)
  })

  it('does not treat a BOM in the middle as valid', () => {
    expect(readImportText(good.replace('{', '{﻿'))).toMatchObject({ ok: false })
  })
})
