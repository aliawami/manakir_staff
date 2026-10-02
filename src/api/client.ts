/**
 * The only place that talks to the API.
 *
 * `api(path)` sends a request with the access token, and unwraps the
 * { status: "success", data } envelope. Errors become `ApiError`.
 *
 * If the API answers 401 (access token expired), the client trades the refresh
 * token for new tokens and repeats the request once. Refresh tokens are
 * SINGLE-USE (the server blacklists the one it just used), so two requests that
 * both get a 401 must share ONE refresh call. Otherwise the second would send
 * an already-used token, be refused, and sign the person out for no reason.
 * That is what `refreshTokens` guarantees.
 */

import { ApiError } from './errors'
import { session } from '../auth/session'
import type { TokenPair } from '../auth/session'

export const API_BASE = '/api/v1'

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  /** false for sign-in calls: no token is sent and no refresh is attempted. */
  auth?: boolean
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true

  const usedToken = useAuth ? session.getAccess() : null
  let response = await send(path, options, usedToken)

  if (response.status === 401 && useAuth && session.getRefresh() !== null) {
    // If another request already renewed the tokens while this one was in
    // flight, the token we used is stale but a fresh one exists: just retry.
    // Otherwise trade the refresh token (shared with any concurrent request).
    const outcome = session.getAccess() !== usedToken ? 'renewed' : await refreshTokens()
    if (outcome === 'renewed') {
      response = await send(path, options, session.getAccess())
    } else if (outcome === 'failed') {
      // The session is NOT over (server hiccup / no network), but this request
      // cannot be answered. Say so, rather than pretending we are signed out.
      throw new ApiError(0, 'Could not renew your session. Check the connection and try again.')
    }
    // 'ended': the app is already back at the sign-in screen; the original 401
    // is reported below.
  }
  return readEnvelope<T>(response)
}

async function send(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    return await fetch(`${API_BASE}/${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Check your connection and that the API is running.',
    )
  }
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const body = await readJson(response)

  if (!response.ok) {
    const message =
      typeof body?.message === 'string' && body.message
        ? body.message
        : `The server answered ${response.status}.`
    throw new ApiError(response.status, message, body?.errors ?? null)
  }
  return body?.data as T
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await response.json()
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null // not JSON (for instance an HTML error page from a proxy)
  }
}

type RefreshOutcome =
  | 'renewed' // new tokens are stored
  | 'ended' // the server refused the refresh token: the session is over
  | 'failed' // could not find out (network / 5xx): session kept as it was

let refreshInFlight: Promise<RefreshOutcome> | null = null

/**
 * Trade the refresh token for a new pair. While one refresh is running,
 * everyone who asks gets that same promise.
 */
export function refreshTokens(): Promise<RefreshOutcome> {
  if (refreshInFlight === null) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<RefreshOutcome> {
  const refresh = session.getRefresh()
  if (refresh === null) return 'ended'

  let response: Response
  try {
    response = await fetch(`${API_BASE}/token/refresh/`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
  } catch {
    return 'failed' // no network: keep the session, the caller reports the failure
  }

  if (response.ok) {
    const body = await readJson(response)
    const tokens = body?.data as Partial<TokenPair> | undefined
    if (typeof tokens?.access === 'string' && typeof tokens.refresh === 'string') {
      session.setTokens({ access: tokens.access, refresh: tokens.refresh })
      return 'renewed'
    }
    return 'failed'
  }

  // The server refused this refresh token (expired, already used, invalid):
  // the session is really over. Anything else (a 5xx) is a hiccup: keep it.
  if (response.status === 401 || response.status === 400) {
    session.end()
    return 'ended'
  }
  return 'failed'
}
