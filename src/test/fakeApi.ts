/**
 * A stand-in for the server, used by the tests instead of real network calls.
 *
 *   const server = fakeApi({
 *     'GET staff/me/': () => ok({ id: 1 }),
 *     'POST otp-verify/': (call) => fail(400, 'Invalid data', { otp_code: 'Wrong code' }),
 *   })
 *   ...
 *   server.calls   // every request the code under test made, in order
 *
 * Keys are "METHOD path" (path relative to /api/v1/, as the app writes it).
 * A request nobody described fails the test loudly instead of hanging.
 */

import { vi } from 'vitest'

export type Call = {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export type Handler = (call: Call) => Response | Promise<Response>

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function ok(data: unknown): Response {
  return json(200, { status: 'success', data })
}

export function fail(status: number, message: string, errors: unknown = null): Response {
  return json(status, { status: 'error', message, errors })
}

export function fakeApi(handlers: Record<string, Handler>) {
  const calls: Call[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const path = url.replace(/^\/api\/v1\//, '')
      const method = init?.method ?? 'GET'
      const call: Call = {
        method,
        path,
        headers: { ...(init?.headers as Record<string, string>) },
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      }
      calls.push(call)

      const handler = handlers[`${method} ${path}`]
      if (!handler) throw new Error(`fakeApi: no handler for ${method} ${path}`)
      return handler(call)
    }),
  )

  return {
    calls,
    /** The requests made to one endpoint. */
    to: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key),
  }
}

/** A handler that fails the way a dead network does (fetch itself throws). */
export const networkDown: Handler = () => {
  throw new TypeError('Failed to fetch')
}
