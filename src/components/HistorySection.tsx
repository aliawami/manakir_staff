import type { HistoryEntry } from '../api/merchantApplications'
import { formatDate, formatDateTime } from '../lib/format'

const ACTION_LABELS: Record<string, string> = {
  MERCHANT_APPLICATION_RETURNED: 'Returned to the applicant',
  MERCHANT_APPLICATION_REJECTED: 'Rejected',
  MERCHANT_APPLICATION_APPROVED: 'Approved',
  MERCHANT_APPLICATION_AUTO_CLOSED: 'Closed automatically (no correction in time)',
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Earlier decisions and who made them. Survives a resubmission, unlike the row's own reason. */
export function HistorySection({ history }: { history: HistoryEntry[] }) {
  return (
    <section>
      <h2>History</h2>
      {history.length === 0 ? (
        <p className="empty">No decisions yet.</p>
      ) : (
        <ol className="history">
          {history.map((entry) => {
            const reason = text(entry.metadata.reason)
            const registration = text(entry.metadata.registration_number)
            const expiry = text(entry.metadata.expiry_date)
            return (
              <li key={entry.id}>
                <div>
                  <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
                  {' · '}
                  <span dir="auto">{entry.actor ? entry.actor.full_name.trim() || `Staff #${entry.actor.id}` : 'System'}</span>
                </div>
                <div className="muted">{formatDateTime(entry.created_at)}</div>
                {reason && <blockquote dir="auto">{reason}</blockquote>}
                {registration && (
                  <div className="muted">
                    Registration number <span dir="ltr">{registration}</span>
                    {expiry && <>, expires {formatDate(expiry)}</>}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
