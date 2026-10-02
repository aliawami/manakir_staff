import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Where the Django API runs during development (docker-compose maps it to 8001).
// Override with: API_PROXY_TARGET=http://localhost:8000 npm run dev
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    // The browser only ever talks to this dev server. Requests to /api/... are
    // forwarded to Django, so there is no cross-origin request and no CORS
    // setting is needed while developing.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
