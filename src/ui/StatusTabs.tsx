import type { KeyboardEvent, ReactNode } from 'react'
import { TABS, nextTabIndex, type Status } from '../domain'
import { useApp } from '../state/AppContext'

export const tabId = (status: Status): string => `tab-${status}`
const panelId = (status: Status): string => `panel-${status}`

interface StatusTabsProps {
  selected: Status
  onSelect: (status: Status) => void
  counts: Record<Status, number>
  /** What the selected tab shows. The other panels stay empty. */
  children: ReactNode
}

/**
 * Status tabs with the ARIA tabs pattern: one tab stop in the tablist (roving tabindex), arrow keys,
 * Home and End move between tabs and select them. The count is part of each tab's name.
 */
export function StatusTabs({ selected, onSelect, counts, children }: StatusTabsProps) {
  const { t } = useApp()

  function onKeyDown(event: KeyboardEvent, index: number): void {
    const next = nextTabIndex(index, event.key, TABS.length)
    if (next === null) return
    event.preventDefault()
    const status = TABS[next]
    if (status === undefined) return
    onSelect(status)
    document.getElementById(tabId(status))?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label={t('tracker.tabs.label')} className="tabs">
        {TABS.map((status, index) => (
          <button
            key={status}
            type="button"
            role="tab"
            id={tabId(status)}
            className={status === 'closed' ? 'tab tab--end' : 'tab'}
            aria-selected={status === selected}
            aria-controls={panelId(status)}
            tabIndex={status === selected ? 0 : -1}
            onClick={() => onSelect(status)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {t(`tracker.tab.${status}`)} <span className="tab__count">{counts[status]}</span>
          </button>
        ))}
      </div>
      {TABS.map((status) => (
        <div
          key={status}
          role="tabpanel"
          id={panelId(status)}
          aria-labelledby={tabId(status)}
          hidden={status !== selected}
          // A panel with only a message has nothing to Tab to, so the panel itself can take focus.
          tabIndex={status === selected && counts[status] === 0 ? 0 : undefined}
        >
          {status === selected ? children : null}
        </div>
      ))}
    </div>
  )
}
