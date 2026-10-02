import { Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

/** The frame around every signed-in screen: header with who you are + sign-out. */
export function Layout() {
  const { state, signOut } = useAuth()
  if (state.status !== 'signedIn') return null

  const { me } = state
  // Accounts created through phone sign-up can have a blank name.
  const displayName = me.full_name.trim() || me.phone_number

  return (
    <>
      <header className="app-header">
        <strong>Manakir Staff</strong>
        <span className="spacer" />
        <span dir="auto">{displayName}</span>
        <button className="secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  )
}
