import { describe, expect, it } from 'vitest'
import {
  defaultSortFor,
  effectiveSort,
  filterAndSortApplications,
  isSortKey,
  matchesQuery,
  neighbourApplications,
  normalizeSearchText,
  shouldShowListControls,
  sortOptionsFor,
  type SortKey,
} from './listView'
import { STATUSES, type Application, type Language } from './types'

function make(id: string, overrides: Partial<Application> = {}): Application {
  return {
    id,
    company: `Company ${id}`,
    role: '',
    url: '',
    status: 'applied',
    createdAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  }
}

const ids = (list: readonly Application[]): string[] => list.map((a) => a.id)

function view(list: readonly Application[], query: string, sort: SortKey = 'added_asc', language: Language = 'sv') {
  return filterAndSortApplications(list, { query, sort, language })
}

describe('normalizeSearchText', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeSearchText('ÅÄÖ Café')).toBe('aao cafe')
    expect(normalizeSearchText('Göteborg')).toBe('goteborg')
  })
})

describe('search', () => {
  const list = [
    make('a', { company: 'Acme AB', role: 'Frontendutvecklare', notes: 'Ring Anna på måndag' }),
    make('b', { company: 'Östersunds kommun', url: 'https://www.jobs.example.se/lediga-jobb/12345-utvecklare' }),
    make('c', { company: '', role: '', url: 'https://careers.greenhouse.io/foo/backend' }),
  ]

  it('returns every row, in order, for an empty or whitespace-only query', () => {
    expect(ids(view(list, ''))).toEqual(['a', 'b', 'c'])
    expect(ids(view(list, '   \t '))).toEqual(['a', 'b', 'c'])
  })

  it('ignores case', () => {
    expect(ids(view(list, 'ACME'))).toEqual(['a'])
    expect(ids(view(list, 'acme ab'))).toEqual(['a'])
  })

  it('ignores accents in both the query and the text', () => {
    expect(ids(view(list, 'ostersund'))).toEqual(['b'])
    expect(ids(view(list, 'Östersund'))).toEqual(['b'])
    expect(ids(view(list, 'mandag'))).toEqual(['a'])
    expect(ids(view(list, 'måndag'))).toEqual(['a'])
    expect(ids(view(list, 'manday'))).toEqual([])
  })

  it('matches in the role', () => {
    expect(ids(view(list, 'frontend'))).toEqual(['a'])
  })

  it('matches in the notes', () => {
    expect(ids(view(list, 'anna'))).toEqual(['a'])
  })

  it('matches in the link host and path', () => {
    expect(ids(view(list, 'greenhouse'))).toEqual(['c'])
    expect(ids(view(list, 'lediga-jobb'))).toEqual(['b'])
    expect(ids(view(list, 'example.se'))).toEqual(['b'])
  })

  it('needs every word to match somewhere', () => {
    expect(ids(view(list, 'acme frontend'))).toEqual(['a'])
    expect(ids(view(list, 'acme greenhouse'))).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(view(list, 'zzz')).toEqual([])
  })

  it('tests a single row', () => {
    expect(matchesQuery(make('x', { company: 'Acme' }), 'acme')).toBe(true)
    expect(matchesQuery(make('x', { company: 'Acme' }), 'nope')).toBe(false)
  })
})

describe('sorting', () => {
  it('sorts by added date, newest or oldest first, keeping the order of equal dates', () => {
    const list = [
      make('a', { createdAt: '2026-10-02T08:00:00.000Z' }),
      make('b', { createdAt: '2026-10-03T08:00:00.000Z' }),
      make('c', { createdAt: '2026-10-02T08:00:00.000Z' }),
    ]
    expect(ids(view(list, '', 'added_desc'))).toEqual(['b', 'a', 'c'])
    expect(ids(view(list, '', 'added_asc'))).toEqual(['a', 'c', 'b'])
  })

  it('sorts by applied date and puts rows without one last', () => {
    const list = [
      make('a', { appliedAt: '2026-10-02T08:00:00.000Z' }),
      make('b'),
      make('c', { appliedAt: '2026-10-05T08:00:00.000Z' }),
      make('d', { appliedAt: '2026-10-02T08:00:00.000Z' }),
    ]
    expect(ids(view(list, '', 'applied_desc'))).toEqual(['c', 'a', 'd', 'b'])
    expect(ids(view(list, '', 'applied_asc'))).toEqual(['a', 'd', 'c', 'b'])
  })

  it('sorts by company with Swedish letters after z, ignoring case', () => {
    const list = [
      make('1', { company: 'Östra AB' }),
      make('2', { company: 'zeta' }),
      make('3', { company: 'Åre AB' }),
      make('4', { company: 'Ärla AB' }),
      make('5', { company: 'alfa' }),
    ]
    expect(ids(view(list, '', 'company', 'sv'))).toEqual(['5', '2', '3', '4', '1'])
  })

  it('follows the language: in English å sorts with a', () => {
    const list = [make('1', { company: 'Zeta' }), make('2', { company: 'Åre' }), make('3', { company: 'Alfa' })]
    expect(ids(view(list, '', 'company', 'en'))).toEqual(['3', '2', '1'])
  })

  it('puts a missing company last, in both languages, and keeps the order of equal names', () => {
    const list = [
      make('1', { company: '' }),
      make('2', { company: 'Beta' }),
      make('3', { company: '   ' }),
      make('4', { company: 'beta' }),
      make('5', { company: 'Alfa' }),
    ]
    expect(ids(view(list, '', 'company', 'sv'))).toEqual(['5', '2', '4', '1', '3'])
    expect(ids(view(list, '', 'company', 'en'))).toEqual(['5', '2', '4', '1', '3'])
  })

  it('filters and sorts together, without changing the input', () => {
    const list = [make('a', { company: 'Beta' }), make('b', { company: 'Alfa' }), make('c', { company: 'Gamma' })]
    const copy = [...list]
    expect(ids(view(list, 'a', 'company'))).toEqual(['b', 'a', 'c'])
    expect(list).toEqual(copy)
  })
})

describe('sort options per tab', () => {
  it('has no applied-date sorts in To apply', () => {
    expect(sortOptionsFor('to_apply')).toEqual(['added_desc', 'added_asc', 'company'])
  })

  it('has every sort in the other tabs', () => {
    for (const status of STATUSES.filter((s) => s !== 'to_apply')) expect(sortOptionsFor(status)).toHaveLength(5)
  })

  it('defaults to newest added in To apply and latest applied elsewhere', () => {
    expect(defaultSortFor('to_apply')).toBe('added_desc')
    for (const status of ['applied', 'interview', 'offer', 'closed'] as const) {
      expect(defaultSortFor(status)).toBe('applied_desc')
    }
  })

  it('uses the saved sort when it fits the tab', () => {
    expect(effectiveSort('applied', 'company')).toBe('company')
    expect(effectiveSort('to_apply', 'added_asc')).toBe('added_asc')
  })

  it("falls back to the tab's default when nothing is saved or the saved sort does not fit", () => {
    expect(effectiveSort('to_apply', null)).toBe('added_desc')
    expect(effectiveSort('applied', null)).toBe('applied_desc')
    expect(effectiveSort('closed', null)).toBe('applied_desc')
    expect(effectiveSort('to_apply', 'applied_desc')).toBe('added_desc')
    expect(effectiveSort('to_apply', 'applied_asc')).toBe('added_desc')
  })

  it('recognises only known sort keys', () => {
    expect(isSortKey('company')).toBe(true)
    expect(isSortKey('newest')).toBe(false)
    expect(isSortKey(3)).toBe(false)
    expect(isSortKey(undefined)).toBe(false)
  })
})

describe('shouldShowListControls', () => {
  it('is hidden when the tab is empty and there is no search (also after delete-all)', () => {
    expect(shouldShowListControls(0, '')).toBe(false)
  })

  it('is shown as soon as the tab has a row, however few', () => {
    expect(shouldShowListControls(1, '')).toBe(true)
    expect(shouldShowListControls(6, '')).toBe(true)
    expect(shouldShowListControls(7, '')).toBe(true)
  })

  it('stays visible while there is a search, even with no rows', () => {
    expect(shouldShowListControls(0, 'acme')).toBe(true)
    expect(shouldShowListControls(0, ' ')).toBe(true)
    expect(shouldShowListControls(2, 'acme')).toBe(true)
  })
})

describe('neighbourApplications', () => {
  const list = [make('a'), make('b'), make('c')]

  it('gives the row after, then the row before', () => {
    expect(ids(neighbourApplications(list, 'b'))).toEqual(['c', 'a'])
    expect(ids(neighbourApplications(list, 'a'))).toEqual(['b'])
    expect(ids(neighbourApplications(list, 'c'))).toEqual(['b'])
  })

  it('uses the rows as shown: the filtered and sorted list, not the stored order', () => {
    const stored = [
      make('a', { company: 'Alfa' }),
      make('b', { company: 'Beta' }),
      make('c', { company: 'Alfa Two' }),
      make('d', { company: 'Delta' }),
    ]
    const shown = view(stored, 'alfa', 'company')
    expect(ids(shown)).toEqual(['a', 'c'])
    // In storage "b" sits between them; in the shown list it is not there.
    expect(ids(neighbourApplications(shown, 'a'))).toEqual(['c'])
    expect(ids(neighbourApplications(shown, 'c'))).toEqual(['a'])
  })

  it('is empty for a row that is not shown, or the only row', () => {
    expect(neighbourApplications(list, 'zzz')).toEqual([])
    expect(neighbourApplications([make('a')], 'a')).toEqual([])
  })
})
