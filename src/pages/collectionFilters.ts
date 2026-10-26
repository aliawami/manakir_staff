/**
 * The collections list's filters live in the URL (/collections?status=DUE&overdue=true),
 * so a reload or the back button keeps the place. Anything in the URL that is
 * not a known value falls back to the default instead of being sent to the API
 * (which would answer 400).
 */

import type { ListParams, Ordering, StatementStatus } from '../api/cashCollections'

export type StatusFilter = StatementStatus | 'all'
export type OverdueFilter = 'all' | 'yes' | 'no'

export type CollectionFilters = {
  status: StatusFilter
  overdue: OverdueFilter
  ordering: Ordering
  page: number
}

/** What still has to be collected, the oldest week first. */
export const DEFAULT_FILTERS: CollectionFilters = {
  status: 'DUE',
  overdue: 'all',
  ordering: 'oldest',
  page: 1,
}

const MAX_PAGE = 10_000

export function readFilters(params: URLSearchParams): CollectionFilters {
  const status = params.get('status')
  const overdue = params.get('overdue')
  const ordering = params.get('ordering')
  const page = params.get('page')

  return {
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
  return new URLSearchParams({
    status: filters.status,
    overdue: filters.overdue,
    ordering: filters.ordering,
    page: String(filters.page),
  })
}

export function toListParams(filters: CollectionFilters): ListParams {
  return {
    status: filters.status === 'all' ? null : filters.status,
    overdue: filters.overdue === 'all' ? null : filters.overdue === 'yes',
    ordering: filters.ordering,
    page: filters.page,
  }
}
