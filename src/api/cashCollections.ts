import { api } from './client'

/**
 * Cash commission collection (staff/cash-collections/ in the API).
 *
 * A *statement* is everything one salon owes Manakir for one collection week
 * (Sunday to Saturday). Money values arrive as strings with two decimals and are
 * kept as strings: they are only ever shown, never calculated with here.
 */

export type StatementStatus = 'DUE' | 'COLLECTED'

export type Ordering = 'oldest' | 'newest'

export const PAGE_SIZE = 20

export type Statement = {
  salon: { id: number; name: string }
  /** The Sunday that starts the week, "YYYY-MM-DD". Together with the salon it identifies the statement. */
  week_start: string
  week_end: string
  /** The Saturday it is due on, or a week later if the week was extended. */
  due_date: string
  extended: boolean
  /** DUE = something is still to collect. */
  status: StatementStatus
  /** Something is still due and the due date has passed. */
  overdue: boolean
  bookings_count: number
  cash_total: string
  commission_total: string
  due_total: string
  collected_total: string
  last_collected_at: string | null
}

export type StatementLine = {
  id: number
  booking: number
  paid_at: string
  cash_amount: string
  commission_amount: string
  commission_vat_amount: string
  commission_total: string
  status: StatementStatus
  collected_at: string | null
  collected_by: { id: number; full_name: string } | null
  note: string
}

export type StatementDetail = Statement & { collections: StatementLine[] }

export type Totals = {
  statements: number
  due_total: string
  overdue_total: string
  /** Collected this calendar month (Saudi time). Not affected by the filters, unlike the rest. */
  collected_this_month: string
}

export type StatementPage = {
  count: number
  page: number
  page_size: number
  /** Over every statement that matches the filters, not only this page. */
  totals: Totals
  results: Statement[]
}

export type ListParams = {
  /** null = every status */
  status: StatementStatus | null
  /** null = overdue or not */
  overdue: boolean | null
  ordering: Ordering
  page: number
}

const BASE = 'staff/cash-collections/statements/'

export function fetchStatements(params: ListParams): Promise<StatementPage> {
  const query = new URLSearchParams()
  if (params.status !== null) query.set('status', params.status)
  if (params.overdue !== null) query.set('overdue', String(params.overdue))
  query.set('ordering', params.ordering)
  query.set('page', String(params.page))
  query.set('page_size', String(PAGE_SIZE))
  return api<StatementPage>(`${BASE}?${query.toString()}`)
}

function statementPath(salonId: string | number, weekStart: string): string {
  return `${BASE}${salonId}/${weekStart}/`
}

export function fetchStatement(salonId: string | number, weekStart: string): Promise<StatementDetail> {
  return api<StatementDetail>(statementPath(salonId, weekStart))
}

/**
 * Confirm that the salon paid what is due. `expectedAmount` must be the
 * `due_total` that was on screen: if it changed meanwhile the server refuses
 * (409 `amount_changed`) so nobody confirms a number they did not see.
 */
export function collectStatement(
  salonId: string | number,
  weekStart: string,
  body: { expected_amount: string; note: string },
): Promise<StatementDetail> {
  return api<StatementDetail>(`${statementPath(salonId, weekStart)}collect/`, {
    method: 'POST',
    body,
  })
}

/** Give Manakir's staff one more week to collect. The server allows it once. */
export function extendStatement(
  salonId: string | number,
  weekStart: string,
  body: { note: string },
): Promise<StatementDetail> {
  return api<StatementDetail>(`${statementPath(salonId, weekStart)}extend/`, {
    method: 'POST',
    body,
  })
}
