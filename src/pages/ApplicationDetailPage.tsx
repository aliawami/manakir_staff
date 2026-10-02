import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError, describeError } from '../api/errors'
import { fetchApplication } from '../api/merchantApplications'
import type { ApplicationDetail } from '../api/merchantApplications'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { DocumentsSection } from '../components/DocumentsSection'
import { HistorySection } from '../components/HistorySection'
import { StatusBadge } from '../components/StatusBadge'
import { ageLabel, formatDate, formatDateTime, realName } from '../lib/format'

/** The queue's filters, passed along by the row that was clicked so "Back" returns to the same view. */
function queueSearch(state: unknown): string {
  const value = (state as { queueSearch?: unknown } | null)?.queueSearch
  return typeof value === 'string' && value.startsWith('?') ? value : ''
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { can } = useAuth()
  const validId = /^\d+$/.test(id)

  const query = useQuery({
    queryKey: ['applications', 'detail', id],
    queryFn: () => fetchApplication(id),
    enabled: validId,
  })

  const back = (
    <p>
      <Link to={{ pathname: '/applications', search: queueSearch(location.state) }}>
        ← Back to the queue
      </Link>
    </p>
  )

  if (!validId || (query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <section>
        {back}
        <h1>Application not found</h1>
        <p>There is no application with this number.</p>
      </section>
    )
  }

  if (query.isError) {
    return (
      <section>
        {back}
        <div role="alert" className="panel">
          <p className="error">{describeError(query.error)}</p>
          <button onClick={() => void query.refetch()}>Try again</button>
        </div>
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section>
        {back}
        <p>Loading…</p>
      </section>
    )
  }

  const application = query.data

  return (
    <section>
      {back}
      <h1>
        <span dir="auto">{application.name || application.name_ar}</span>
        {application.name && application.name_ar && (
          <span className="subtitle" dir="auto">
            {application.name_ar}
          </span>
        )}
      </h1>
      <p>
        <StatusBadge status={application.status} />
      </p>

      <Overview application={application} />

      <DocumentsSection
        applicationId={application.id}
        documents={application.documents}
        canView={can(PERMISSIONS.viewDocuments)}
      />

      <HistorySection history={application.history} />
    </section>
  )
}

function Overview({ application }: { application: ApplicationDetail }) {
  const name = realName(application.applicant.full_name)
  const autoClosed =
    application.status === 'REJECTED' && application.decided_by === null && application.decided_at !== null

  return (
    <section>
      <h2>Application</h2>
      <dl className="facts">
        <dt>Applicant</dt>
        <dd>
          {name ? <span dir="auto">{name}</span> : <em>No name on the account</em>}
          <div dir="ltr">{application.applicant.phone_number}</div>
          {!name && (
            <div className="muted">
              The account has no name. Call her on this number if you need to confirm who she is.
            </div>
          )}
        </dd>

        <dt>National address</dt>
        <dd dir="auto">{application.national_address || '—'}</dd>

        <dt>First submitted</dt>
        <dd>
          {formatDateTime(application.submitted_at)}{' '}
          <span className="muted">({ageLabel(application.submitted_at)})</span>
          {application.resubmission_count > 0 && (
            <div className="muted">Resubmitted {application.resubmission_count} time(s) after corrections</div>
          )}
        </dd>

        {application.status === 'RETURNED' && application.correction_deadline && (
          <>
            <dt>Correction deadline</dt>
            <dd>The application closes automatically on {formatDate(application.correction_deadline)}.</dd>
          </>
        )}

        {application.decided_at && (
          <>
            <dt>Last decision</dt>
            <dd>
              {formatDateTime(application.decided_at)}
              {' · '}
              {autoClosed
                ? 'automatically (no correction in time)'
                : application.decided_by
                  ? application.decided_by.full_name.trim() || `Staff #${application.decided_by.id}`
                  : 'unknown'}
              {application.decision_reason && <blockquote dir="auto">{application.decision_reason}</blockquote>}
            </dd>
          </>
        )}

        {application.salon !== null && (
          <>
            <dt>Salon</dt>
            <dd>Salon #{application.salon} was created (draft) when this was approved.</dd>
          </>
        )}
      </dl>
    </section>
  )
}
