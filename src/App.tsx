import { Navigate, Route, Routes } from 'react-router'
import { PERMISSIONS } from './auth/permissions'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { RequirePermission } from './components/RequirePermission'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { SignInPage } from './pages/SignInPage'

export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route
          path="applications"
          element={
            <RequirePermission permission={PERMISSIONS.viewApplications}>
              <ApplicationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="applications/:id"
          element={
            <RequirePermission permission={PERMISSIONS.viewApplications}>
              <ApplicationDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="collections"
          element={
            <RequirePermission permission={PERMISSIONS.viewCollections}>
              <CollectionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="collections/:salonId/:weekStart"
          element={
            <RequirePermission permission={PERMISSIONS.viewCollections}>
              <CollectionDetailPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
