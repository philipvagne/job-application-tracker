/** Opens a PDF blob in a new tab through a local object URL. Nothing is sent anywhere. */
export function openPdfInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.append(link)
  link.click()
  link.remove()
  // Long enough for the new tab to load it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
