import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router'
import { PAGE_SIZE, fetchStatements } from '../api/cashCollections'
import type { Statement, Totals } from '../api/cashCollections'
import { Money } from '../components/collections/Money'
import { StatementBadges } from '../components/collections/StatementBadges'
import { ar, collectionErrorMessage, formatDay, formatWeek } from '../i18n/collections'
import { readFilters, toListParams, writeFilters } from './collectionFilters'
import type { CollectionFilters, OverdueFilter, StatusFilter } from './collectionFilters'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'DUE', label: ar.filters.statusDue },
  { value: 'COLLECTED', label: ar.filters.statusCollected },
  { value: 'all', label: ar.filters.statusAll },
]

const OVERDUE_OPTIONS: { value: OverdueFilter; label: string }[] = [
  { value: 'all', label: ar.filters.overdueAll },
  { value: 'yes', label: ar.filters.overdueOnly },
  { value: 'no', label: ar.filters.overdueNot },
]

/** What each salon owes, one row per salon and week. Arabic, right to left. */
export function CollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const filters = readFilters(searchParams)
  const params = toListParams(filters)

  const query = useQuery({
    queryKey: ['collections', 'list', params],
    queryFn: () => fetchStatements(params),
    placeholderData: keepPreviousData,
  })

  function change(next: Partial<CollectionFilters>) {
    // Changing a filter starts again from page 1.
    const resetPage = next.page === undefined ? { page: 1 } : {}
    setSearchParams(writeFilters({ ...filters, ...resetPage, ...next }))
  }

  return (
    <section dir="rtl" lang="ar" className="rtl">
      <h1>{ar.title}</h1>

      {query.data && <TotalsBar totals={query.data.totals} />}

      <div className="filters">
        <div>
          <label htmlFor="status">{ar.filters.status}</label>
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
          <label htmlFor="overdue">{ar.filters.overdue}</label>
          <select
            id="overdue"
            value={filters.overdue}
            onChange={(e) => change({ overdue: e.target.value as OverdueFilter })}
          >
            {OVERDUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ordering">{ar.filters.ordering}</label>
          <select
            id="ordering"
            value={filters.ordering}
            onChange={(e) => change({ ordering: e.target.value as CollectionFilters['ordering'] })}
          >
            <option value="oldest">{ar.filters.oldest}</option>
            <option value="newest">{ar.filters.newest}</option>
          </select>
        </div>
      </div>

      {query.isError ? (
        <div role="alert" className="panel">
          <p className="error">{collectionErrorMessage(query.error)}</p>
          <button onClick={() => void query.refetch()}>{ar.retry}</button>
        </div>
      ) : query.isPending ? (
        <p>{ar.loading}</p>
      ) : (
        <Results
          data={query.data}
          search={location.search}
          page={filters.page}
          busy={query.isPlaceholderData}
          onPage={(page) => change({ page })}
        />
      )}
    </section>
  )
}

function TotalsBar({ totals }: { totals: Totals }) {
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="muted">{ar.totals.due}</span>
          <strong>
            <Money value={totals.due_total} />
          </strong>
        </div>
        <div className="stat">
          <span className="muted">{ar.totals.overdue}</span>
          <strong className={totals.overdue_total !== '0.00' ? 'error' : undefined}>
            <Money value={totals.overdue_total} />
          </strong>
        </div>
        <div className="stat">
          <span className="muted">{ar.totals.collectedThisMonth}</span>
          <strong>
            <Money value={totals.collected_this_month} />
          </strong>
        </div>
        <div className="stat">
          <span className="muted">{ar.totals.statements}</span>
          <strong>
            <bdi dir="ltr">{totals.statements}</bdi>
          </strong>
        </div>
      </div>
      <p className="muted">{ar.totals.scope}</p>
    </>
  )
}

function Results({
  data,
  search,
  page,
  busy,
  onPage,
}: {
  data: { count: number; results: Statement[] }
  /** The list's own query string, handed to the detail screen so "back" returns here. */
  search: string
  page: number
  busy: boolean
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))

  if (data.count === 0) return <p className="empty">{ar.list.empty}</p>

  if (data.results.length === 0) {
    return (
      <p className="empty">
        {ar.list.emptyPage} <button onClick={() => onPage(1)}>{ar.list.goFirst}</button>
      </p>
    )
  }

  return (
    <>
      <table aria-busy={busy} className={busy ? 'busy' : undefined}>
        <thead>
          <tr>
            <th>{ar.list.salon}</th>
            <th>{ar.list.week}</th>
            <th>{ar.list.dueDate}</th>
            <th>{ar.list.bookings}</th>
            <th>{ar.list.due}</th>
            <th>{ar.list.status}</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((statement) => (
            <Row key={`${statement.salon.id}-${statement.week_start}`} statement={statement} search={search} />
          ))}
        </tbody>
      </table>

      {/* Right to left: "previous" sits on the right, where the list starts. */}
      <div className="pager">
        <button className="secondary" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          {ar.list.previous}
        </button>
        <span>
          <bdi dir="ltr">
            {page} / {pages}
          </bdi>{' '}
          · {data.count}
        </span>
        <button className="secondary" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>
          {ar.list.next}
        </button>
      </div>
    </>
  )
}

function Row({ statement, search }: { statement: Statement; search: string }) {
  return (
    <tr>
      <td>
        <Link
          to={`/collections/${statement.salon.id}/${statement.week_start}`}
          state={{ listSearch: search }}
          dir="auto"
        >
          {statement.salon.name}
        </Link>
      </td>
      <td>{formatWeek(statement.week_start, statement.week_end)}</td>
      <td>{formatDay(statement.due_date)}</td>
      <td>
        <bdi dir="ltr">{statement.bookings_count}</bdi>
      </td>
      <td>
        <Money value={statement.due_total} />
      </td>
      <td>
        <StatementBadges statement={statement} />
      </td>
    </tr>
  )
}
