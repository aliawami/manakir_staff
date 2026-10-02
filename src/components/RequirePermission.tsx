import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

/**
 * Shows a screen only to people holding a permission. This is a courtesy: the
 * server refuses the data anyway, so this only avoids showing an empty or
 * failing screen to someone who cannot use it.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <section>
        <h1>Not allowed</h1>
        <p>Your roles do not include access to this screen.</p>
      </section>
    )
  }
  return <>{children}</>
}
