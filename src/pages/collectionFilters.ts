/**
 * The collections list's filters live in the URL (/collections?status=DUE&overdue=true),
 * so a reload or the back button keeps the place. Anything in the URL that is
 * not a known value falls back to the default instead of being sent to the API
 * (which would answer 400).
 */

import type { ListParams, Ordering, StatementStatus } from '../api/cashCollections'

export type StatusFilter = StatementStatus | 'all'
export type OverdueFilter = 'all' | 'yes' | 'no'

/** The page has two views: all statements (with filters), and what was collected this month. */
export type View = 'statements' | 'month'

export type CollectionFilters = {
  view: View
  status: StatusFilter
  overdue: OverdueFilter
  ordering: Ordering
  page: number
}

/** What still has to be collected, the oldest week first. */
export const DEFAULT_FILTERS: CollectionFilters = {
  view: 'statements',
  status: 'DUE',
  overdue: 'all',
  ordering: 'oldest',
  page: 1,
}

const MAX_PAGE = 10_000

export function readFilters(params: URLSearchParams): CollectionFilters {
  const view = params.get('view')
  const status = params.get('status')
  const overdue = params.get('overdue')
  const ordering = params.get('ordering')
  const page = params.get('page')

  return {
    view: view === 'month' ? 'month' : DEFAULT_FILTERS.view,
    status:
      status === 'all' || status === 'DUE' || status === 'COLLECTED'
        ? status
        : DEFAULT_FILTERS.status,
    overdue: overdue === 'yes' || overdue === 'no' || overdue === 'all' ? overdue : DEFAULT_FILTERS.overdue,
    ordering: ordering === 'oldest' || ordering === 'newest' ? ordering : DEFAULT_FILTERS.ordering,
    page:
      page !== null && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= MAX_PAGE
        ? Number(page)
        : DEFAULT_FILTERS.page,
  }
}

export function writeFilters(filters: CollectionFilters): URLSearchParams {
  // The month view has no filters of its own, only a page.
  if (filters.view === 'month') {
    return new URLSearchParams({ view: 'month', page: String(filters.page) })
  }
  return new URLSearchParams({
    status: filters.status,
    overdue: filters.overdue,
    ordering: filters.ordering,
    page: String(filters.page),
  })
}

export function toListParams(filters: CollectionFilters): ListParams {
  if (filters.view === 'month') {
    return { status: null, overdue: null, ordering: 'newest', collectedIn: 'this_month', page: filters.page }
  }
  return {
    collectedIn: null,
    status: filters.status === 'all' ? null : filters.status,
    overdue: filters.overdue === 'all' ? null : filters.overdue === 'yes',
    ordering: filters.ordering,
    page: filters.page,
  }
}
