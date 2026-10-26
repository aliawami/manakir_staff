import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { ar } from '../i18n/collections'

/** The frame around every signed-in screen: header with who you are + sign-out. */
export function Layout() {
  const { state, signOut, can } = useAuth()
  if (state.status !== 'signedIn') return null

  const { me } = state
  // Accounts created through phone sign-up can have a blank name.
  const displayName = me.full_name.trim() || me.phone_number

  return (
    <>
      <header className="app-header">
        <strong>Manakir Staff</strong>
        <nav aria-label="Main">
          {can(PERMISSIONS.viewApplications) && <NavLink to="/applications">Applications</NavLink>}
          {can(PERMISSIONS.viewCollections) && (
            <NavLink to="/collections" lang="ar">
              {ar.nav}
            </NavLink>
          )}
        </nav>
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
