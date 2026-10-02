import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../App'
import { createQueryClient } from '../api/queryClient'
import { AuthProvider } from '../auth/AuthContext'

/** Render the whole app (query cache + router + auth) at a URL, as main.tsx does in the browser. */
export function renderApp(path = '/') {
  // retryDelay 0: the one allowed retry of a failing read happens immediately in tests.
  const queryClient = createQueryClient({ retryDelay: 0 })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  // The cache is returned so a test can check what it holds.
  return { ...result, queryClient }
}
