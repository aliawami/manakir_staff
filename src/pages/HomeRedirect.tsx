import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { PERMISSIONS } from '../auth/permissions'
import { HomePage } from './HomePage'

/** "/" sends a reviewer to the queue and finance to the collections; anyone else sees the plain welcome screen. */
export function HomeRedirect() {
  const { can } = useAuth()
  if (can(PERMISSIONS.viewApplications)) return <Navigate to="/applications" replace />
  if (can(PERMISSIONS.viewCollections)) return <Navigate to="/collections" replace />
  return <HomePage />
}
