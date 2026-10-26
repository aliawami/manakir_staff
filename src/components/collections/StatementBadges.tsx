import type { Statement, StatementStatus } from '../../api/cashCollections'
import { ar } from '../../i18n/collections'

export function StatusBadge({ status }: { status: StatementStatus }) {
  return status === 'DUE' ? (
    <span className="badge badge-returned">{ar.badge.due}</span>
  ) : (
    <span className="badge badge-approved">{ar.badge.collected}</span>
  )
}

/** Status, plus "late" and "extended" when they apply. */
export function StatementBadges({ statement }: { statement: Pick<Statement, 'status' | 'overdue' | 'extended'> }) {
  return (
    <span className="badges">
      <StatusBadge status={statement.status} />
      {statement.overdue && <span className="badge badge-rejected">{ar.badge.overdue}</span>}
      {statement.extended && <span className="badge">{ar.badge.extended}</span>}
    </span>
  )
}
