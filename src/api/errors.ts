/**
 * An error answered by the API (or a failure to reach it).
 *
 * The API always answers errors as { status: "error", message, errors }.
 * `status` here is the HTTP status; 0 means no answer was received at all
 * (server down, no network).
 */
export class ApiError extends Error {
  status: number
  errors: unknown

  constructor(status: number, message: string, errors: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/**
 * The most useful single sentence for a person.
 *
 * Validation answers say "Invalid data" and put the real reason in `errors`,
 * as { field: "text" } or { field: ["text", ...] }. When that is the case the
 * field's text is shown, otherwise the error's own message.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const fromFields = firstFieldMessage(error.errors)
    return fromFields ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

function firstFieldMessage(errors: unknown): string | null {
  if (typeof errors !== 'object' || errors === null) return null
  for (const value of Object.values(errors)) {
    if (typeof value === 'string' && value) return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return null
}
