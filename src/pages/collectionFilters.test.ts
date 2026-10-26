import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, readFilters, toListParams, writeFilters } from './collectionFilters'

const read = (query: string) => readFilters(new URLSearchParams(query))

describe('readFilters', () => {
  it('starts with what is still to collect, oldest week first', () => {
    expect(read('')).toEqual({ status: 'DUE', overdue: 'all', ordering: 'oldest', page: 1 })
  })

  it('reads every known value', () => {
    expect(read('status=COLLECTED&overdue=yes&ordering=newest&page=3')).toEqual({
      status: 'COLLECTED',
      overdue: 'yes',
      ordering: 'newest',
      page: 3,
    })
    expect(read('status=all&overdue=no').status).toBe('all')
    expect(read('status=all&overdue=no').overdue).toBe('no')
  })

  it('replaces anything unknown with the default instead of sending it to the API', () => {
    expect(read('status=PAID&overdue=maybe&ordering=random&page=abc')).toEqual(DEFAULT_FILTERS)
    for (const page of ['0', '-1', '1.5', '10001', '']) {
      expect(read(`page=${page}`).page).toBe(1)
    }
  })
})

describe('toListParams and writeFilters', () => {
  it('turns "all" into no filter and yes/no into true/false', () => {
    expect(toListParams({ status: 'all', overdue: 'all', ordering: 'newest', page: 2 })).toEqual({
      status: null,
      overdue: null,
      ordering: 'newest',
      page: 2,
    })
    expect(toListParams({ ...DEFAULT_FILTERS, overdue: 'yes' }).overdue).toBe(true)
    expect(toListParams({ ...DEFAULT_FILTERS, overdue: 'no' }).overdue).toBe(false)
  })

  it('round-trips through the URL', () => {
    const filters = { status: 'COLLECTED', overdue: 'no', ordering: 'newest', page: 4 } as const
    expect(readFilters(writeFilters(filters))).toEqual(filters)
  })
})
