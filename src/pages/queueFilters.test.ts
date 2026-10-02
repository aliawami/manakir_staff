import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, readFilters, toListParams, writeFilters } from './queueFilters'

const read = (query: string) => readFilters(new URLSearchParams(query))

describe('readFilters', () => {
  it('an empty URL is "waiting for review, oldest first, page 1"', () => {
    expect(read('')).toEqual({ status: 'SUBMITTED', ordering: 'oldest', page: 1 })
    expect(read('')).toEqual(DEFAULT_FILTERS)
  })

  it('reads valid values', () => {
    expect(read('status=RETURNED&ordering=newest&page=3')).toEqual({
      status: 'RETURNED',
      ordering: 'newest',
      page: 3,
    })
    expect(read('status=all').status).toBe('all')
  })

  it('replaces anything unknown with the default instead of passing it on', () => {
    expect(read('status=EVIL&ordering=sideways')).toEqual(DEFAULT_FILTERS)
    expect(read('status=submitted').status).toBe('SUBMITTED') // lowercase is not valid: default
  })

  it('accepts only whole pages from 1 up', () => {
    for (const bad of ['0', '-3', '2.5', 'abc', '', '1e3', '99999999']) {
      expect(read(`page=${bad}`).page, bad).toBe(1)
    }
    expect(read('page=10000').page).toBe(10000)
  })
})

describe('writeFilters / toListParams', () => {
  it('writes all three values so the URL says exactly what is shown', () => {
    const written = writeFilters({ status: 'all', ordering: 'newest', page: 2 })
    expect(written.toString()).toBe('status=all&ordering=newest&page=2')
    expect(readFilters(written)).toEqual({ status: 'all', ordering: 'newest', page: 2 })
  })

  it('"all" becomes no status filter for the API', () => {
    expect(toListParams({ status: 'all', ordering: 'oldest', page: 1 }).status).toBeNull()
    expect(toListParams({ status: 'APPROVED', ordering: 'oldest', page: 1 }).status).toBe('APPROVED')
  })
})
