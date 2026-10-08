import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { CURRENT_BOOKMARK_VERSION, buildBookmarklet, isLocalAddress } from '../domain'
import { useApp } from '../state/AppContext'
import { Dialog } from './Dialog'

interface BookmarkletDialogProps {
  open: boolean
  onClose: () => void
}

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Where the user gets the bookmarklet: a link to drag to the bookmarks bar, and a copy button for
 * making the bookmark by hand (the way for keyboard users). The `javascript:` address is set
 * through a ref, because React refuses it as an href prop. Clicking the link here only explains.
 */
export function BookmarkletDialog({ open, onClose }: BookmarkletDialogProps) {
  const { t } = useApp()
  const titleId = useId()
  const codeId = useId()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [dragHint, setDragHint] = useState(false)
  const [copy, setCopy] = useState<CopyState>('idle')

  const appUrl = `${window.location.origin}/`
  const boxOpen = t('bookmarklet.boxOpen')
  const boxClose = t('bookmarklet.boxClose')
  const code = useMemo(() => buildBookmarklet(appUrl, { open: boxOpen, close: boxClose }), [appUrl, boxOpen, boxClose])
  const local = isLocalAddress(appUrl)

  useEffect(() => {
    const link = linkRef.current
    if (link === null || code === null) return
    link.setAttribute('href', code)
  }, [code, open])

  function close(): void {
    setDragHint(false)
    setCopy('idle')
    onClose()
  }

  function onLinkClick(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault()
    setDragHint(true)
  }

  async function onCopy(): Promise<void> {
    if (code === null) return
    try {
      await navigator.clipboard.writeText(code)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <Dialog open={open} onClose={close} titleId={titleId} className="dialog--fixed-footer" closeOnBackdrop>
      <h2 id={titleId} className="dialog__title">
        {t('bookmarklet.title')}
      </h2>
      <div className="dialog__body">
        <p>{t('bookmarklet.intro')}</p>
        <p>{t('bookmarklet.platsbanken')}</p>
        {code === null ? (
          <p className="note">{t('bookmarklet.unavailable')}</p>
        ) : (
          <>
            <ol className="bookmarklet__steps">
              <li>{t('bookmarklet.step1')}</li>
              <li>{t('bookmarklet.step2')}</li>
              <li>{t('bookmarklet.step3')}</li>
            </ol>
            <p>
              <a ref={linkRef} className="btn btn--primary bookmarklet__link" onClick={onLinkClick}>
                {t('bookmarklet.linkLabel')}
              </a>
            </p>
            <p role="status" className="note">
              {dragHint ? t('bookmarklet.dragNotClick') : ''}
            </p>

            <h3 className="bookmarklet__heading">{t('bookmarklet.byHandTitle')}</h3>
            <p>{t('bookmarklet.byHand')}</p>
            <p>
              <button type="button" className="btn" onClick={() => void onCopy()}>
                {t('bookmarklet.copy')}
              </button>
            </p>
            <p role="status" className="note">
              {copy === 'copied' ? t('bookmarklet.copied') : copy === 'failed' ? t('bookmarklet.copyFailed') : ''}
            </p>
            {copy === 'failed' && (
              <div className="field">
                <label htmlFor={codeId}>{t('bookmarklet.codeLabel')}</label>
                <textarea
                  id={codeId}
                  className="input input--area bookmarklet__code"
                  rows={4}
                  readOnly
                  value={code}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            )}

            <p className="hint">{t('bookmarklet.address', { address: appUrl })}</p>
            {local && <p className="banner banner--warn bookmarklet__local">{t('bookmarklet.local')}</p>}
            <p className="hint">{t('bookmarklet.limits')}</p>
            <p className="hint">{t('bookmarklet.version', { version: String(CURRENT_BOOKMARK_VERSION) })}</p>
          </>
        )}
      </div>
      <div className="dialog__actions dialog__actions--fixed">
        <button type="button" className="btn btn--primary" data-autofocus onClick={close}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  )
}
