import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

/**
 * Retry rule for reads. A 4xx answer (not allowed, not found, bad request) will
 * not change by asking again, so it is shown at once. A network failure or a
 * 5xx gets ONE more try.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function createQueryClient(options: { retryDelay?: number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: options.retryDelay,
      },
    },
  })
}
