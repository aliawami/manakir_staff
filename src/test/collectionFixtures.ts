import type { Statement, StatementDetail, StatementLine, StatementPage } from '../api/cashCollections'

export const BASE = 'staff/cash-collections/statements/'
export const LIST = `GET ${BASE}`
export const DETAIL = `GET ${BASE}7/2026-10-25/`
export const COLLECT = `POST ${BASE}7/2026-10-25/collect/`
export const EXTEND = `POST ${BASE}7/2026-10-25/extend/`

export function statement(overrides: Partial<Statement> = {}): Statement {
  return {
    salon: { id: 7, name: 'صالون ورد' },
    week_start: '2026-10-25',
    week_end: '2026-10-31',
    due_date: '2026-10-31',
    extended: false,
    status: 'DUE',
    overdue: false,
    bookings_count: 2,
    cash_total: '230.00',
    commission_total: '23.00',
    due_total: '23.00',
    collected_total: '0.00',
    last_collected_at: null,
    collected_this_month: '0.00',
    ...overrides,
  }
}

export function line(overrides: Partial<StatementLine> = {}): StatementLine {
  return {
    id: 1,
    booking: 101,
    paid_at: '2026-10-28T09:00:00Z',
    cash_amount: '115.00',
    commission_amount: '10.00',
    commission_vat_amount: '1.50',
    commission_total: '11.50',
    status: 'DUE',
    collected_at: null,
    collected_by: null,
    note: '',
    ...overrides,
  }
}

export function detail(overrides: Partial<StatementDetail> = {}): StatementDetail {
  return {
    ...statement(),
    collections: [line({ id: 1, booking: 101 }), line({ id: 2, booking: 102 })],
    ...overrides,
  }
}

export function pageOf(results: Statement[], overrides: Partial<StatementPage> = {}): StatementPage {
  return {
    count: results.length,
    page: 1,
    page_size: 20,
    totals: { statements: results.length, due_total: '23.00', overdue_total: '0.00', collected_this_month: '0.00' },
    results,
    ...overrides,
  }
}

/** The statement after "collect" succeeded. */
export function collectedDetail(): StatementDetail {
  return detail({
    status: 'COLLECTED',
    due_total: '0.00',
    collected_total: '23.00',
    last_collected_at: '2026-11-02T10:00:00Z',
    collections: [
      line({
        id: 1,
        status: 'COLLECTED',
        collected_at: '2026-11-02T10:00:00Z',
        collected_by: { id: 12, full_name: 'Ghaith' },
        note: 'تم الاستلام باليد',
      }),
      line({ id: 2, booking: 102, status: 'COLLECTED', collected_at: '2026-11-02T10:00:00Z', collected_by: { id: 12, full_name: 'Ghaith' } }),
    ],
  })
}
