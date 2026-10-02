import type { ApplicationStatus } from '../api/merchantApplications'

const LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Waiting for review',
  RETURNED: 'Returned to applicant',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status]}</span>
}
