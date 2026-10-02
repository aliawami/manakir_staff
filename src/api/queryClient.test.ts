import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('never retries a 4xx: asking again will not change the answer', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(shouldRetry(0, new ApiError(status, 'x'))).toBe(false)
    }
  })

  it('retries a network failure or a 5xx once, then stops', () => {
    expect(shouldRetry(0, new ApiError(0, 'down'))).toBe(true)
    expect(shouldRetry(0, new ApiError(500, 'oops'))).toBe(true)
    expect(shouldRetry(1, new ApiError(500, 'oops'))).toBe(false)
    expect(shouldRetry(0, new Error('unexpected'))).toBe(true)
  })
})
