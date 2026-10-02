import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { HomePage } from './HomePage'

/** "/" sends a reviewer straight to the queue; anyone else sees the plain welcome screen. */
export function HomeRedirect() {
  const { can } = useAuth()
  if (can(PERMISSIONS.viewApplications)) return <Navigate to="/applications" replace />
  return <HomePage />
}
