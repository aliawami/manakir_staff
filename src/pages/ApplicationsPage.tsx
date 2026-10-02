import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { PAGE_SIZE, fetchApplications } from '../api/merchantApplications'
import type { ApplicationListItem } from '../api/merchantApplications'
import { describeError } from '../api/errors'
import { StatusBadge } from '../components/StatusBadge'
import { ageLabel, formatDate, realName } from '../lib/format'
import { readFilters, toListParams, writeFilters } from './queueFilters'
import type { QueueFilters, StatusFilter } from './queueFilters'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'SUBMITTED', label: 'Waiting for review' },
  { value: 'RETURNED', label: 'Returned to applicant' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

/** The review queue: applications, filtered, oldest first by default, 20 per page. */
export function ApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const params = toListParams(filters)

  // The query key is [what, the filters]: a different filter is a different
  // cache entry, like a different argument of a Riverpod family provider.
  const query = useQuery({
    queryKey: ['applications', 'list', params],
    queryFn: () => fetchApplications(params),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  })

  function change(next: Partial<QueueFilters>) {
    // Changing the status or the order starts again from page 1.
    const resetPage = next.page === undefined ? { page: 1 } : {}
    setSearchParams(writeFilters({ ...filters, ...resetPage, ...next }))
  }

  return (
    <section>
      <h1>Applications</h1>

      <div className="filters">
        <div>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => change({ status: e.target.value as StatusFilter })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ordering">Order</label>
          <select
            id="ordering"
            value={filters.ordering}
            onChange={(e) => change({ ordering: e.target.value as QueueFilters['ordering'] })}
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </div>

      {query.isError ? (
        <div role="alert" className="panel">
          <p className="error">{describeError(query.error)}</p>
          <button onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : query.isPending ? (
        <p>Loading…</p>
      ) : (
        <Results
          data={query.data}
          page={filters.page}
          busy={query.isPlaceholderData}
          onPage={(page) => change({ page })}
        />
      )}
    </section>
  )
}

function Results({
  data,
  page,
  busy,
  onPage,
}: {
  data: { count: number; results: ApplicationListItem[] }
  page: number
  busy: boolean
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))

  if (data.count === 0) {
    return <p className="empty">No applications match this filter.</p>
  }

  if (data.results.length === 0) {
    // The URL asks for a page beyond the last (for example after others were decided).
    return (
      <p className="empty">
        This page is empty. <button onClick={() => onPage(1)}>Go to page 1</button>
      </p>
    )
  }

  return (
    <>
      <table aria-busy={busy} className={busy ? 'busy' : undefined}>
        <thead>
          <tr>
            <th>Merchant</th>
            <th>Applicant</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((application) => (
            <Row key={application.id} application={application} />
          ))}
        </tbody>
      </table>

      <div className="pager">
        <button className="secondary" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages} · {data.count} {data.count === 1 ? 'application' : 'applications'}
        </span>
        <button
          className="secondary"
          disabled={page >= pages || busy}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  )
}

function Row({ application }: { application: ApplicationListItem }) {
  const name = realName(application.applicant.full_name)

  return (
    <tr>
      <td>
        <Link to={`/applications/${application.id}`} dir="auto">
          {application.name || application.name_ar}
        </Link>
        {application.name && application.name_ar && (
          <div className="muted" dir="auto">
            {application.name_ar}
          </div>
        )}
      </td>
      <td>
        {name && <div dir="auto">{name}</div>}
        <div className={name ? 'muted' : undefined} dir="ltr">
          {application.applicant.phone_number}
        </div>
      </td>
      <td>
        <StatusBadge status={application.status} />
        {application.status === 'RETURNED' && application.correction_deadline && (
          <div className="muted">Closes {formatDate(application.correction_deadline)}</div>
        )}
      </td>
      <td>
        {formatDate(application.submitted_at)}
        <div className="muted">
          {ageLabel(application.submitted_at)}
          {application.resubmission_count > 0 && ` · resubmitted ×${application.resubmission_count}`}
        </div>
      </td>
    </tr>
  )
}
