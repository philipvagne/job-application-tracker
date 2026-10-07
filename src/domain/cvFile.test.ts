import { describe, expect, it } from 'vitest'
import {
  MAX_CV_FILE_BYTES,
  cvFileStatus,
  hasPdfSignature,
  suggestCvName,
  validateCvFile,
} from './cvFile'

const enc = (text: string): Uint8Array => new TextEncoder().encode(text)
const PDF = enc('%PDF-1.7\n%âãÏÓ\n')

describe('hasPdfSignature', () => {
  it('finds %PDF- at the start', () => {
    expect(hasPdfSignature(PDF)).toBe(true)
  })

  it('finds it a little way in, as readers allow', () => {
    expect(hasPdfSignature(enc(`junk\n${'x'.repeat(100)}%PDF-1.4`))).toBe(true)
  })

  it('finds it ending exactly at byte 1024 and not after', () => {
    const atLimit = enc('x'.repeat(1024 - 5) + '%PDF-')
    expect(hasPdfSignature(atLimit)).toBe(true)
    const past = enc('x'.repeat(1024 - 4) + '%PDF-')
    expect(hasPdfSignature(past)).toBe(false)
  })

  it('rejects other content, near misses and nothing', () => {
    for (const text of ['', 'PDF-', '%PDF', '%pdf-1.4', '<html>%PDF</html>', 'GIF89a']) {
      expect(hasPdfSignature(enc(text))).toBe(false)
    }
  })
})

describe('validateCvFile', () => {
  const ok = { name: 'My CV.pdf', size: 120_000 }

  it('accepts a PDF and returns its details', () => {
    expect(validateCvFile(ok, PDF)).toEqual({
      ok: true,
      value: { fileName: 'My CV.pdf', size: 120_000, type: 'application/pdf' },
    })
  })

  it('accepts an upper-case extension and unusual names', () => {
    for (const name of ['CV.PDF', 'cv.Pdf', 'Östen Åkesson – CV (2026) 😀.pdf', '<b>x</b>.pdf', '.pdf']) {
      expect(validateCvFile({ name, size: 10 }, PDF).ok).toBe(true)
    }
  })

  it('rejects an empty file', () => {
    expect(validateCvFile({ ...ok, size: 0 }, PDF)).toEqual({ ok: false, error: 'empty' })
    expect(validateCvFile({ ...ok, size: Number.NaN }, PDF)).toEqual({ ok: false, error: 'empty' })
    expect(validateCvFile({ ...ok, size: -5 }, PDF)).toEqual({ ok: false, error: 'empty' })
  })

  it('accepts exactly 5 MB and rejects one byte more', () => {
    expect(validateCvFile({ ...ok, size: MAX_CV_FILE_BYTES }, PDF).ok).toBe(true)
    expect(validateCvFile({ ...ok, size: MAX_CV_FILE_BYTES + 1 }, PDF)).toEqual({ ok: false, error: 'too_large' })
  })

  it('rejects names that do not end in .pdf', () => {
    for (const name of ['cv.txt', 'cv', 'cv.pdf.exe', 'cv.pdf ', 'cvpdf', 'cv.pdfx']) {
      expect(validateCvFile({ name, size: 10 }, PDF)).toEqual({ ok: false, error: 'not_pdf' })
    }
  })

  it('rejects a .pdf name whose content is not a PDF', () => {
    expect(validateCvFile(ok, enc('<html>hello</html>'))).toEqual({ ok: false, error: 'not_pdf_content' })
    expect(validateCvFile(ok, new Uint8Array())).toEqual({ ok: false, error: 'not_pdf_content' })
  })

  it('reports the name first when both the name and the content are wrong', () => {
    expect(validateCvFile({ name: 'cv.txt', size: 10 }, enc('<html>'))).toEqual({ ok: false, error: 'not_pdf' })
  })

  it('accepts a name of 255 characters and rejects 256', () => {
    expect(validateCvFile({ name: `${'a'.repeat(251)}.pdf`, size: 10 }, PDF).ok).toBe(true)
    expect(validateCvFile({ name: `${'a'.repeat(252)}.pdf`, size: 10 }, PDF)).toEqual({
      ok: false,
      error: 'name_too_long',
    })
  })

  it('checks size before name and content', () => {
    expect(validateCvFile({ name: 'x.txt', size: MAX_CV_FILE_BYTES + 1 }, new Uint8Array()).ok).toBe(false)
    expect(validateCvFile({ name: 'x.txt', size: 0 }, new Uint8Array())).toEqual({ ok: false, error: 'empty' })
  })
})

describe('suggestCvName', () => {
  it('removes .pdf in any case and trims', () => {
    expect(suggestCvName('Short CV.pdf')).toBe('Short CV')
    expect(suggestCvName(' Long.PDF')).toBe('Long')
    expect(suggestCvName('a.pdf.pdf')).toBe('a.pdf')
    expect(suggestCvName('.pdf')).toBe('')
  })
})

describe('cvFileStatus', () => {
  const withFile = { id: 'c1', name: 'A', file: { fileName: 'a.pdf', size: 1, type: 'application/pdf' as const } }

  it('says no_file for a CV that is only a name', () => {
    expect(cvFileStatus({ id: 'c1', name: 'A' }, new Set(['c1']))).toBe('no_file')
    expect(cvFileStatus({ id: 'c1', name: 'A' }, null)).toBe('no_file')
  })

  it('says available when the file is stored', () => {
    expect(cvFileStatus(withFile, new Set(['c1', 'c2']))).toBe('available')
  })

  it('says missing when the entry has file details but the browser has no file', () => {
    expect(cvFileStatus(withFile, new Set())).toBe('missing')
    expect(cvFileStatus(withFile, new Set(['c2']))).toBe('missing')
  })

  it('says unknown when the file store could not be read', () => {
    expect(cvFileStatus(withFile, null)).toBe('unknown')
  })
})
