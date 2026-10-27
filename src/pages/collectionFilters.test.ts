import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, readFilters, toListParams, writeFilters } from './collectionFilters'

const read = (query: string) => readFilters(new URLSearchParams(query))

describe('readFilters', () => {
  it('starts with what is still to collect, oldest week first', () => {
    expect(read('')).toEqual({
      view: 'statements',
      status: 'DUE',
      overdue: 'all',
      ordering: 'oldest',
      page: 1,
    })
  })

  it('reads every known value', () => {
    expect(read('status=COLLECTED&overdue=yes&ordering=newest&page=3')).toEqual({
      view: 'statements',
      status: 'COLLECTED',
      overdue: 'yes',
      ordering: 'newest',
      page: 3,
    })
    expect(read('status=all&overdue=no').status).toBe('all')
    expect(read('status=all&overdue=no').overdue).toBe('no')
  })

  it('replaces anything unknown with the default instead of sending it to the API', () => {
    expect(read('view=week&status=PAID&overdue=maybe&ordering=random&page=abc')).toEqual(DEFAULT_FILTERS)
    for (const page of ['0', '-1', '1.5', '10001', '']) {
      expect(read(`page=${page}`).page).toBe(1)
    }
  })
})

describe('toListParams and writeFilters', () => {
  it('turns "all" into no filter and yes/no into true/false', () => {
    expect(toListParams({ ...DEFAULT_FILTERS, status: 'all', ordering: 'newest', page: 2 })).toEqual({
      collectedIn: null,
      status: null,
      overdue: null,
      ordering: 'newest',
      page: 2,
    })
    expect(toListParams({ ...DEFAULT_FILTERS, overdue: 'yes' }).overdue).toBe(true)
    expect(toListParams({ ...DEFAULT_FILTERS, overdue: 'no' }).overdue).toBe(false)
  })

  it('round-trips through the URL', () => {
    const filters = { ...DEFAULT_FILTERS, status: 'COLLECTED', overdue: 'no', ordering: 'newest', page: 4 } as const
    expect(readFilters(writeFilters(filters))).toEqual(filters)
  })

  it('the month view keeps only its page in the URL', () => {
    const filters = { ...DEFAULT_FILTERS, view: 'month', status: 'COLLECTED', overdue: 'yes', page: 3 } as const
    const query = writeFilters(filters)
    expect(query.toString()).toBe('view=month&page=3')
    expect(readFilters(query)).toEqual({ ...DEFAULT_FILTERS, view: 'month', page: 3 })
  })
})

describe('the month view', () => {
  it('asks for what was collected this month, latest first, whatever the other filters were', () => {
    expect(toListParams({ ...DEFAULT_FILTERS, view: 'month', status: 'DUE', overdue: 'yes', ordering: 'oldest', page: 2 })).toEqual({
      status: null,
      overdue: null,
      ordering: 'newest',
      collectedIn: 'this_month',
      page: 2,
    })
  })

  it('anything but "month" is the normal view', () => {
    expect(read('view=month').view).toBe('month')
    for (const view of ['', 'Month', 'week', 'statements']) {
      expect(read(`view=${view}`).view).toBe('statements')
    }
  })
})
