import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { type SortKey } from '../domain'
import { useApp } from '../state/AppContext'

/** The id of the search field, so focus can be sent back to it. */
export const LIST_SEARCH_ID = 'list-search'

/** How long typing must pause before the number of matches is read out. */
const ANNOUNCE_DELAY_MS = 400

interface ListControlsProps {
  query: string
  onQueryChange: (query: string) => void
  /** Empties the search and puts focus somewhere sensible, even if the controls hide as a result. */
  onClear: () => void
  sort: SortKey
  sortOptions: readonly SortKey[]
  onSortChange: (sort: SortKey) => void
  /** Rows left after the search. */
  resultCount: number
}

/** Search and sort for the rows of the active tab. The caller decides when to show it (shouldShowListControls). */
export function ListControls({
  query,
  onQueryChange,
  onClear,
  sort,
  sortOptions,
  onSortChange,
  resultCount,
}: ListControlsProps) {
  const { t, language } = useApp()
  const sortId = useId()
  const searching = query.trim() !== ''

  const resultsText = t(
    new Intl.PluralRules(language).select(resultCount) === 'one' ? 'list.resultsOne' : 'list.resultsOther',
    { count: resultCount },
  )

  // The visible count follows every key press; what a screen reader hears waits for a pause in typing.
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    if (!searching) {
      setAnnounced('')
      return
    }
    const timer = window.setTimeout(() => setAnnounced(resultsText), ANNOUNCE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [searching, resultsText])

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape' && query !== '') {
      event.preventDefault()
      onClear()
    }
  }

  return (
    <div className="list-controls">
      <div className="list-controls__search">
        <label htmlFor={LIST_SEARCH_ID} className="sr-only">
          {t('list.searchLabel')}
        </label>
        <input
          id={LIST_SEARCH_ID}
          className="input list-controls__input"
          type="search"
          autoComplete="off"
          placeholder={t('list.searchPlaceholder')}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query !== '' && (
          <button type="button" className="list-controls__clear" aria-label={t('list.clear')} onClick={onClear}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="list-controls__sort">
        <label htmlFor={sortId}>{t('list.sortLabel')}</label>
        <select
          id={sortId}
          className="input input--select"
          value={sort}
          onChange={(e) => {
            const next = sortOptions.find((option) => option === e.target.value)
            if (next !== undefined) onSortChange(next)
          }}
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {t(`list.sort.${option}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="list-controls__count" aria-hidden="true">
        {searching ? resultsText : ''}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  )
}
