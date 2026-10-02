import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { session } from '../auth/session'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  session.clear()
  session.setSessionEndedHandler(null)
  sessionStorage.clear()
})
