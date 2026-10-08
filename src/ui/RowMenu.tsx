import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import type { Application } from '../domain'
import type { TextKey } from '../i18n'
import { useApp } from '../state/AppContext'

export type MenuAction = 'reply' | 'toInterview' | 'toOffer' | 'back' | 'close' | 'edit' | 'delete'

/** The actions that make sense for this application, in menu order. */
export function menuActionsFor(application: Application): MenuAction[] {
  switch (application.status) {
    case 'to_apply':
      return ['edit', 'delete']
    case 'applied':
      return [
        ...(application.repliedAt === undefined ? (['reply'] as const) : []),
        'toInterview',
        'toOffer',
        'back',
        'close',
        'edit',
        'delete',
      ]
    case 'interview':
      return ['toOffer', 'back', 'close', 'edit', 'delete']
    case 'offer':
      return ['back', 'close', 'edit', 'delete']
    case 'closed':
      return []
  }
}

const LABEL: Record<MenuAction, TextKey> = {
  reply: 'menu.reply',
  toInterview: 'menu.toInterview',
  toOffer: 'menu.toOffer',
  back: 'menu.back',
  close: 'menu.close',
  edit: 'menu.edit',
  delete: 'menu.delete',
}

interface RowMenuProps {
  application: Application
  onAction: (action: MenuAction) => void
}

/**
 * A "More" disclosure built on <details>: Enter or Space on the summary opens it, Tab walks
 * through the buttons, Escape closes it and returns to the summary.
 */
export function RowMenu({ application, onAction }: RowMenuProps) {
  const { t } = useApp()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      const details = detailsRef.current
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function closeMenu(): void {
    if (detailsRef.current !== null) detailsRef.current.open = false
    summaryRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && detailsRef.current?.open === true) {
      event.stopPropagation()
      closeMenu()
    }
  }

  // Tabbing out of the menu closes it. A missing relatedTarget (some browsers do not focus
  // a clicked button) is ignored, so the click still lands.
  function onBlur(event: FocusEvent): void {
    const next = event.relatedTarget
    if (next instanceof Node && detailsRef.current !== null && !detailsRef.current.contains(next)) {
      detailsRef.current.open = false
    }
  }

  const company = application.company

  return (
    <details ref={detailsRef} className="menu" onKeyDown={onKeyDown} onBlur={onBlur}>
      <summary
        ref={summaryRef}
        id={`more-${application.id}`}
        className="btn btn--small"
        aria-label={t('row.actionFor', { action: t('row.more'), company })}
      >
        {t('row.more')}
      </summary>
      <ul className="menu__list">
        {menuActionsFor(application).map((action) => (
          <li key={action}>
            <button
              type="button"
              className="btn menu__item"
              aria-label={t('row.actionFor', { action: t(LABEL[action]), company })}
              onClick={() => {
                closeMenu()
                onAction(action)
              }}
            >
              {t(LABEL[action])}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
