import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { session } from './auth/session'
import { fail, fakeApi, json, networkDown, ok } from './test/fakeApi'
import type { Handler } from './test/fakeApi'
import { renderApp } from './test/renderApp'

const ME = {
  id: 9,
  phone_number: '0500000001',
  full_name: 'Hussain Reviewer',
  roles: ['merchant_reviewer'],
  permissions: ['staff.access', 'merchant_applications.decide_merchantapplication'],
}

/** "/staff/me/" answers 401 until the request carries the access token. */
const meWith =
  (me: object = ME, token = 'ACCESS-1'): Handler =>
  (call) =>
    call.headers.Authorization === `Bearer ${token}` ? ok(me) : fail(401, 'Not signed in')

const refreshOk: Handler = () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-2' })

describe('signed out', () => {
  it('sends a visitor to the sign-in screen', async () => {
    fakeApi({})
    renderApp('/')
    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  })

  it('does not call the server at all when there is nothing saved', async () => {
    const server = fakeApi({})
    renderApp('/')
    await screen.findByLabelText('Phone number')
    expect(server.calls).toHaveLength(0)
  })
})

describe('signing in', () => {
  function serverForSignIn(overrides: Record<string, Handler> = {}) {
    return fakeApi({
      'POST otp-request/': () => ok({ message: 'sent', otp_code: '123456' }),
      'POST otp-verify/': () => ok({ access: 'ACCESS-1', refresh: 'REFRESH-1' }),
      'GET staff/me/': meWith(),
      ...overrides,
    })
  }

  it('phone, then code, then lands on the home screen as that person', async () => {
    const user = userEvent.setup()
    const server = serverForSignIn()
    renderApp('/')

    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Hussain Reviewer')).toBeInTheDocument()
    expect(screen.getByText(/merchant_reviewer/)).toBeInTheDocument()

    expect(server.to('POST otp-request/')[0].body).toEqual({ phone_number: '0500000001' })
    expect(server.to('POST otp-verify/')[0].body).toEqual({
      phone_number: '0500000001',
      otp_code: '123456',
    })
    expect(server.to('GET staff/me/')[0].headers.Authorization).toBe('Bearer ACCESS-1')
    expect(session.getRefresh()).toBe('REFRESH-1')
  })

  it('shows the development code hint only in development', async () => {
    const user = userEvent.setup()
    serverForSignIn()
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByText(/Development only: the code is 123456/)).toBeInTheDocument()
  })

  it('never shows the code in a production build, even if the server sends it', async () => {
    vi.stubEnv('DEV', false)
    const user = userEvent.setup()
    serverForSignIn()
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await screen.findByLabelText('Code')
    expect(screen.queryByText(/Development only/)).not.toBeInTheDocument()
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument()
  })

  it('a wrong code shows the server reason and stays on the code step', async () => {
    const user = userEvent.setup()
    serverForSignIn({
      'POST otp-verify/': () => fail(400, 'Invalid data', { otp_code: ['The code is wrong or expired.'] }),
    })
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '000000')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The code is wrong or expired.')
    expect(screen.getByLabelText('Code')).toBeInTheDocument()
    expect(session.getRefresh()).toBeNull()
    // and the button works again, so she can retry
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('a failed code request (for example rate-limited) is shown on the phone step', async () => {
    const user = userEvent.setup()
    serverForSignIn({ 'POST otp-request/': () => fail(429, 'Too many requests') })
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()
  })

  it('"Change number" goes back to the phone step and clears the code', async () => {
    const user = userEvent.setup()
    serverForSignIn()
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '12')
    await user.click(screen.getByRole('button', { name: 'Change number' }))

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
    expect(screen.queryByText(/Development only/)).not.toBeInTheDocument()
  })

  it('a valid code for a NON-staff account ends on the "No access" screen', async () => {
    const user = userEvent.setup()
    serverForSignIn({ 'GET staff/me/': () => fail(403, 'Not staff') })
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000002')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('a blank name falls back to the phone number in the header', async () => {
    const user = userEvent.setup()
    serverForSignIn({ 'GET staff/me/': meWith({ ...ME, full_name: ' ' }) })
    renderApp('/')
    await user.type(await screen.findByLabelText('Phone number'), '0500000001')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await user.type(await screen.findByLabelText('Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'Welcome' })
    expect(screen.getByText('0500000001')).toBeInTheDocument()
  })
})

describe('a saved session (page reload)', () => {
  it('restores itself: first call gets 401, tokens are refreshed, the call is repeated', async () => {
    // Only the refresh token survives a reload (the access token lived in memory).
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')

    const server = fakeApi({
      'GET staff/me/': meWith(),
      'POST token/refresh/': refreshOk,
    })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(server.to('POST token/refresh/')[0].body).toEqual({ refresh: 'REFRESH-1' })
    expect(session.getRefresh()).toBe('REFRESH-2')
  })

  it('when the saved session is refused, shows the sign-in screen and forgets it', async () => {
    sessionStorage.setItem('manakir_staff_refresh_token', 'OLD')
    fakeApi({
      'GET staff/me/': () => fail(401, 'Not signed in'),
      'POST token/refresh/': () => fail(401, 'Token is blacklisted'),
    })
    renderApp('/')

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
    expect(session.getRefresh()).toBeNull()
  })

  it('when the server is down, says so, keeps the session, and "Try again" recovers', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    let down = true
    const server = fakeApi({
      'GET staff/me/': (call) => (down ? networkDown(call) : meWith()(call)),
      'POST token/refresh/': refreshOk,
    })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Cannot reach the server' })).toBeInTheDocument()
    expect(session.getRefresh()).toBe('REFRESH-1')

    down = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(server.to('GET staff/me/').length).toBeGreaterThan(1)
  })

  it('a refresh that fails with a server error does not sign her out', async () => {
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    fakeApi({
      'GET staff/me/': () => fail(401, 'Not signed in'),
      'POST token/refresh/': () => json(503, { status: 'error', message: 'down' }),
    })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Cannot reach the server' })).toBeInTheDocument()
    expect(session.getRefresh()).toBe('REFRESH-1')
  })

  it('a non-staff account that reloads sees "No access"', async () => {
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    fakeApi({
      'GET staff/me/': (call) =>
        call.headers.Authorization === 'Bearer ACCESS-1' ? fail(403, 'Not staff') : fail(401, 'x'),
      'POST token/refresh/': refreshOk,
    })
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('visiting /sign-in while signed in goes to the home screen', async () => {
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    fakeApi({ 'GET staff/me/': meWith(), 'POST token/refresh/': refreshOk })
    renderApp('/sign-in')

    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('retires the refresh token on the server, forgets everything, shows sign-in', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    const server = fakeApi({
      'GET staff/me/': meWith(),
      'POST token/refresh/': refreshOk,
      'POST logout/': () => ok({}),
    })
    renderApp('/')
    await screen.findByRole('heading', { name: 'Welcome' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
    expect(server.to('POST logout/')[0].body).toEqual({ refresh: 'REFRESH-2' })
    expect(session.getRefresh()).toBeNull()
    expect(session.getAccess()).toBeNull()
  })

  it('signs out locally even if the server cannot be reached', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    fakeApi({
      'GET staff/me/': meWith(),
      'POST token/refresh/': refreshOk,
      'POST logout/': networkDown,
    })
    renderApp('/')
    await screen.findByRole('heading', { name: 'Welcome' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
    await waitFor(() => expect(session.getRefresh()).toBeNull())
  })

  it('"Sign out" on the No access screen works too', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('manakir_staff_refresh_token', 'REFRESH-1')
    fakeApi({
      'GET staff/me/': (call) =>
        call.headers.Authorization === 'Bearer ACCESS-1' ? fail(403, 'Not staff') : fail(401, 'x'),
      'POST token/refresh/': refreshOk,
      'POST logout/': () => ok({}),
    })
    renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument()
  })
})
