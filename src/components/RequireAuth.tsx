import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'

/**
 * Wraps every screen that needs a signed-in staff member.
 * This only decides what to SHOW. The server refuses anything not allowed,
 * whatever this screen does.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, signOut, reload } = useAuth()
  const location = useLocation()

  switch (state.status) {
    case 'loading':
      return <p className="center-message">Loading…</p>

    case 'signedOut':
      // Remember where the person was going, so sign-in can bring them back.
      return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />

    case 'noAccess':
      return (
        <div className="center-message">
          <h1>No access</h1>
          <p>This account is not allowed to use the staff app.</p>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      )

    case 'unavailable':
      return (
        <div className="center-message">
          <h1>Cannot reach the server</h1>
          <p>{state.message}</p>
          <button onClick={reload}>Try again</button>{' '}
          <button className="secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )

    case 'signedIn':
      return <>{children}</>
  }
}
