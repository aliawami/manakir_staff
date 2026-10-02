import { api, apiFile } from './client'

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

export type DocumentKind = 'CERTIFICATE' | 'NATIONAL_ID'

export type ApplicationDocument = {
  id: number
  kind: DocumentKind
  original_name: string
  /** The type checked when the file was uploaded (PDF, JPEG or PNG). */
  content_type: string
  size: number
  uploaded_at: string
  /** false = the applicant replaced this file later; it stays listed. */
  is_current: boolean
  superseded_at: string | null
}

export type Person = { id: number; full_name: string }

export type HistoryEntry = {
  id: number
  /** MERCHANT_APPLICATION_RETURNED | _REJECTED | _APPROVED | _AUTO_CLOSED */
  action: string
  /** null = the system acted (automatic closing). */
  actor: Person | null
  created_at: string
  /** For return / reject: { reason }. For approve: what was entered. */
  metadata: Record<string, unknown>
}

/** One application with everything needed to decide (GET staff/merchant-applications/<id>/). */
export type ApplicationDetail = ApplicationListItem & {
  national_address: string
  decision_reason: string
  decided_by: Person | null
  /** Id of the salon created on approval. */
  salon: number | null
  documents: ApplicationDocument[]
  history: HistoryEntry[]
}

export function fetchApplication(id: string): Promise<ApplicationDetail> {
  return api<ApplicationDetail>(`staff/merchant-applications/${id}/`)
}

/**
 * The file itself. Every call is written to the audit log by the server, so
 * this must only ever run because a person asked to open the document: never
 * from an effect, a prefetch or an automatic refetch.
 */
export function fetchDocument(applicationId: number, documentId: number): Promise<Blob> {
  return apiFile(`staff/merchant-applications/${applicationId}/documents/${documentId}/`)
}
