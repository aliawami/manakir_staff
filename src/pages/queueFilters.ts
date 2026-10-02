/**
 * The queue's filters live in the URL (/applications?status=RETURNED&page=2),
 * so a reload or the back button keeps the place and a link can be shared.
 * Anything in the URL that is not a known value falls back to the default
 * instead of being sent to the API (which would answer 400).
 */

import { APPLICATION_STATUSES } from '../api/merchantApplications'
import type { ApplicationStatus, ListParams, Ordering } from '../api/merchantApplications'

export type StatusFilter = ApplicationStatus | 'all'

export type QueueFilters = {
  status: StatusFilter
  ordering: Ordering
  page: number
}

/** What needs a decision, longest-waiting first. */
export const DEFAULT_FILTERS: QueueFilters = { status: 'SUBMITTED', ordering: 'oldest', page: 1 }

const MAX_PAGE = 10_000

export function readFilters(params: URLSearchParams): QueueFilters {
  const status = params.get('status')
  const ordering = params.get('ordering')
  const page = params.get('page')

  return {
    status:
      status === 'all' || APPLICATION_STATUSES.includes(status as ApplicationStatus)
        ? (status as StatusFilter)
        : DEFAULT_FILTERS.status,
    ordering: ordering === 'oldest' || ordering === 'newest' ? ordering : DEFAULT_FILTERS.ordering,
    page: page !== null && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= MAX_PAGE
      ? Number(page)
      : DEFAULT_FILTERS.page,
  }
}

export function writeFilters(filters: QueueFilters): URLSearchParams {
  return new URLSearchParams({
    status: filters.status,
    ordering: filters.ordering,
    page: String(filters.page),
  })
}

export function toListParams(filters: QueueFilters): ListParams {
  return {
    status: filters.status === 'all' ? null : filters.status,
    ordering: filters.ordering,
    page: filters.page,
  }
}
