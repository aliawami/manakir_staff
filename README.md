# Manakir Staff

Internal web app for Manakir staff (React + TypeScript + Vite). First feature: merchant application review.
It talks to the Django API (`manakir_api`) and has no database of its own.

## Run it

```bash
npm install          # once, and after package.json changes
npm run dev          # http://localhost:5173
```

The dev server forwards every `/api/...` request to the Django API, so the browser never makes a
cross-origin request and no CORS setting is needed. The API is expected at `http://localhost:8001`
(the docker-compose mapping). Elsewhere:

```bash
API_PROXY_TARGET=http://localhost:8000 npm run dev
```

Sign in with a staff phone number. With `OTP_MOCK_ENABLED=True` on the API, the code is shown on the
sign-in screen (development builds only).

## Commands

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | dev server with hot reload                     |
| `npm test`         | run all tests once (`npm run test:watch` to keep running) |
| `npm run lint`     | oxlint                                         |
| `npm run build`    | type-check, then production build into `dist/` |

## How sign-in is kept

- Access token (60 min): in memory only. Gone on reload.
- Refresh token (30 days, single-use, rotated on every refresh): `sessionStorage`. Survives a reload,
  gone when the tab is closed. Never `localStorage`.
- `src/api/client.ts` renews the access token on a 401 and repeats the request once. Concurrent
  requests share ONE refresh, because the server accepts each refresh token only once.

## Rule for every screen

The screens only decide what to SHOW (`useAuth().can(...)` hides buttons). The API checks every
request itself; never rely on the UI for security.

## Layout

```
src/api/        talking to the API (client.ts is the only place that calls fetch)
src/auth/       who is signed in (session.ts = tokens, AuthContext.tsx = app-wide state)
src/components/ shared pieces (RequireAuth, Layout)
src/pages/      one file per screen
src/test/       test helpers (fakeApi = a pretend server)
```

## Production

`npm run build` makes static files in `dist/`. In production the app and the API must be reachable on the
same origin (a reverse proxy sending `/api` to Django), or the API must allow this origin with CORS.
Decide this before deploying; it is not set up yet.
