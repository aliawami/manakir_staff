import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { fetchStatement } from '../api/cashCollections'
import type { StatementDetail, StatementLine } from '../api/cashCollections'
import { ApiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { Money } from '../components/collections/Money'
import { StatementActions } from '../components/collections/StatementActions'
import type { Notice } from '../components/collections/StatementActions'
import { StatementBadges, StatusBadge } from '../components/collections/StatementBadges'
import { ar, collectionErrorMessage, formatDay, formatMoment, formatWeek, isDayIso } from '../i18n/collections'

/** The list's filters, passed along by the row that was clicked so "back" returns to the same view. */
function listSearch(state: unknown): string {
  const value = (state as { listSearch?: unknown } | null)?.listSearch
  return typeof value === 'string' && value.startsWith('?') ? value : ''
}

/** One salon's week: the figures, every booking in it, and the actions. */
export function CollectionDetailPage() {
  const { salonId = '', weekStart = '' } = useParams()
  const location = useLocation()
  const { can } = useAuth()
  const [notice, setNotice] = useState<Notice | null>(null)
  const valid = /^\d+$/.test(salonId) && isDayIso(weekStart)

  const query = useQuery({
    queryKey: ['collections', 'detail', salonId, weekStart],
    queryFn: () => fetchStatement(salonId, weekStart),
    enabled: valid,
  })

  const back = (
    <p>
      <Link to={{ pathname: '/collections', search: listSearch(location.state) }}>
        {ar.detail.back} ←
      </Link>
    </p>
  )

  if (!valid || (query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <section dir="rtl" lang="ar" className="rtl">
        {back}
        <h1>{ar.detail.notFoundTitle}</h1>
        <p>{ar.detail.notFoundBody}</p>
      </section>
    )
  }

  if (query.isError) {
    return (
      <section dir="rtl" lang="ar" className="rtl">
        {back}
        <div role="alert" className="panel">
          <p className="error">{collectionErrorMessage(query.error)}</p>
          <button onClick={() => void query.refetch()}>{ar.retry}</button>
        </div>
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section dir="rtl" lang="ar" className="rtl">
        {back}
        <p>{ar.loading}</p>
      </section>
    )
  }

  const statement = query.data

  return (
    <section dir="rtl" lang="ar" className="rtl">
      {back}
      <h1>
        <span dir="auto">{statement.salon.name}</span>
        <span className="subtitle">{formatWeek(statement.week_start, statement.week_end)}</span>
      </h1>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`cnotice cnotice-${notice.kind}`}
        >
          {notice.text}
          {notice.link && (
            <>
              {' '}
              <Link to={notice.link.to}>{notice.link.label}</Link>
            </>
          )}
        </div>
      )}

      <Facts statement={statement} />

      {can(PERMISSIONS.collectCommissions) && (
        <StatementActions statement={statement} onNotice={setNotice} />
      )}

      <h2>{ar.detail.linesTitle}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{ar.detail.booking}</th>
              <th>{ar.detail.paidAt}</th>
              <th>{ar.detail.cash}</th>
              <th>{ar.detail.commission}</th>
              <th>{ar.detail.vat}</th>
              <th>{ar.detail.total}</th>
              <th>{ar.detail.lineStatus}</th>
              <th>{ar.detail.note}</th>
            </tr>
          </thead>
          <tbody>
            {statement.collections.map((line) => (
              <Line key={line.id} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Facts({ statement }: { statement: StatementDetail }) {
  return (
    <dl className="facts">
      <dt>{ar.detail.status}</dt>
      <dd>
        <StatementBadges statement={statement} />
      </dd>
      <dt>{ar.detail.dueDate}</dt>
      <dd>{formatDay(statement.due_date)}</dd>
      <dt>{ar.detail.bookings}</dt>
      <dd>
        <bdi dir="ltr">{statement.bookings_count}</bdi>
      </dd>
      <dt>{ar.detail.cashTotal}</dt>
      <dd>
        <Money value={statement.cash_total} />
      </dd>
      <dt>{ar.detail.commissionTotal}</dt>
      <dd>
        <Money value={statement.commission_total} />
      </dd>
      <dt>{ar.detail.dueTotal}</dt>
      <dd>
        <strong>
          <Money value={statement.due_total} />
        </strong>
      </dd>
      <dt>{ar.detail.collectedTotal}</dt>
      <dd>
        <Money value={statement.collected_total} />
      </dd>
      {statement.last_collected_at && (
        <>
          <dt>{ar.detail.lastCollected}</dt>
          <dd>{formatMoment(statement.last_collected_at)}</dd>
        </>
      )}
    </dl>
  )
}

function Line({ line }: { line: StatementLine }) {
  return (
    <tr>
      <td>
        <bdi dir="ltr">{line.booking}</bdi>
      </td>
      <td>{formatMoment(line.paid_at)}</td>
      <td>
        <Money value={line.cash_amount} />
      </td>
      <td>
        <Money value={line.commission_amount} />
      </td>
      <td>
        <Money value={line.commission_vat_amount} />
      </td>
      <td>
        <Money value={line.commission_total} />
      </td>
      <td>
        <StatusBadge status={line.status} />
        {line.collected_at && (
          <div className="muted">
            {formatMoment(line.collected_at)}
            {line.collected_by && <> · <span dir="auto">{line.collected_by.full_name}</span></>}
          </div>
        )}
      </td>
      <td dir="auto">{line.note}</td>
    </tr>
  )
}
