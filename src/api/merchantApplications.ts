import { api } from './client'

export const APPLICATION_STATUSES = ['SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export type Ordering = 'oldest' | 'newest'

export const PAGE_SIZE = 20

export type Applicant = {
  id: number
  /** Blank (" ") for accounts created through phone sign-up. */
  full_name: string
  phone_number: string
}

/** One row of the review queue (GET staff/merchant-applications/). */
export type ApplicationListItem = {
  id: number
  status: ApplicationStatus
  name: string
  name_ar: string
  applicant: Applicant
  resubmission_count: number
  /** When the FIRST submission happened. Not changed by a resubmission. */
  submitted_at: string
  updated_at: string
  decided_at: string | null
  /** Only set while the application is RETURNED: when it will be closed automatically. */
  correction_deadline: string | null
}

export type Page<T> = {
  count: number
  page: number
  page_size: number
  results: T[]
}

export type ListParams = {
  /** null = every status */
  status: ApplicationStatus | null
  ordering: Ordering
  page: number
}

export function fetchApplications(params: ListParams): Promise<Page<ApplicationListItem>> {
  const query = new URLSearchParams()
  if (params.status !== null) query.set('status', params.status)
  query.set('ordering', params.ordering)
  query.set('page', String(params.page))
  query.set('page_size', String(PAGE_SIZE))
  return api<Page<ApplicationListItem>>(`staff/merchant-applications/?${query.toString()}`)
}
