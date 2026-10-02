/**
 * "Who is signed in?", for the whole app.
 *
 * The app is always in exactly one of these states:
 *
 *   loading      checking whether a saved session exists (first page load)
 *   signedOut    nobody is signed in
 *   signedIn     signed in as a staff member (`me` says who and what they may do)
 *   noAccess     signed in, but the account is not a staff account (403)
 *   unavailable  could not find out (server down); `message` says why
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchMe, logout, verifyOtp } from '../api/auth'
import type { StaffMe } from '../api/auth'
import { ApiError, describeError } from '../api/errors'
import { session } from './session'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; me: StaffMe }
  | { status: 'noAccess' }
  | { status: 'unavailable'; message: string }

type AuthContextValue = {
  state: AuthState
  /** Exchange a login code for a session. Throws ApiError for a wrong code. */
  signIn: (phoneNumber: string, otpCode: string) => Promise<void>
  signOut: () => Promise<void>
  /** Look the session up again (used by the "try again" button). */
  reload: () => void
  /** Does the signed-in person hold this permission? Menu convenience only:
   *  the server checks every request itself. */
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadState(): Promise<AuthState> {
  try {
    return { status: 'signedIn', me: await fetchMe() }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { status: 'noAccess' }
    // A 401 here means the session was refused; the client already ended it
    // and the handler below moves the app to signedOut. Anything else (server
    // down, 5xx) is reported without throwing the session away.
    if (error instanceof ApiError && error.status === 401) return { status: 'signedOut' }
    return { status: 'unavailable', message: describeError(error) }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    session.getRefresh() === null ? { status: 'signedOut' } : { status: 'loading' },
  )
  const [attempt, setAttempt] = useState(0)
  // Everything fetched for one person (the queue, applicant phone numbers) must
  // be forgotten when they leave: the next person to sign in on this tab would
  // otherwise see it for a moment before it refreshes.
  const queryClient = useQueryClient()

  // The server refused our refresh token somewhere: back to the sign-in screen.
  useEffect(() => {
    session.setSessionEndedHandler(() => {
      setState({ status: 'signedOut' })
      queryClient.clear()
    })
    return () => session.setSessionEndedHandler(null)
  }, [queryClient])

  // First load (or "try again"): if a refresh token was saved, find out who we are.
  // There is no access token yet after a reload, so the first request gets a 401
  // and the API client refreshes and repeats it by itself.
  useEffect(() => {
    if (session.getRefresh() === null) return
    let cancelled = false
    loadState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const signIn = useCallback(
    async (phoneNumber: string, otpCode: string) => {
      session.setTokens(await verifyOtp(phoneNumber, otpCode))
      queryClient.clear()
      setState(await loadState())
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    await logout()
    session.clear()
    setState({ status: 'signedOut' })
    queryClient.clear()
  }, [queryClient])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      reload,
      can: (permission) =>
        state.status === 'signedIn' && state.me.permissions.includes(permission),
    }),
    [state, signIn, signOut, reload],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
