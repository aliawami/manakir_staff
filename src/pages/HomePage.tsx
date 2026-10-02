import { useAuth } from '../auth/AuthContext'

/** Placeholder until the review queue (next slice). Shows what the server says about you. */
export function HomePage() {
  const { state } = useAuth()
  if (state.status !== 'signedIn') return null
  const { me } = state

  return (
    <section>
      <h1>Welcome</h1>
      <p>
        Roles: {me.roles.length ? me.roles.join(', ') : 'none'}
        <br />
        Permissions: {me.permissions.length ? me.permissions.join(', ') : 'none'}
      </p>
    </section>
  )
}
