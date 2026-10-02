import { describe, expect, it, vi } from 'vitest'
import { api, apiFile } from './client'
import { ApiError, describeError } from './errors'
import { session } from '../auth/session'
import { fail, fakeApi, json, networkDown, ok } from '../test/fakeApi'

/** Run a call that must fail and hand back the error it failed with. */
async function failure(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected the call to fail, but it succeeded')
}

function signedInWith(access: string, refresh: string) {
  session.setTokens({ access, refresh })
}

describe('api(): basics', () => {
  it('sends the access token as a Bearer header and unwraps data', async () => {
    signedInWith('A1', 'R1')
    const server = fakeApi({ 'GET staff/me/': () => ok({ id: 7 }) })

    const data = await api<{ id: number }>('staff/me/')

    expect(data).toEqual({ id: 7 })
    expect(server.calls[0].headers.Authorization).toBe('Bearer A1')
  })

  it('sends JSON bodies with a Content-Type', async () => {
    const server = fakeApi({ 'POST x/': () => ok({}) })
    await api('x/', { method: 'POST', body: { a: 1 }, auth: false })
    expect(server.calls[0].body).toEqual({ a: 1 })
    expect(server.calls[0].headers['Content-Type']).toBe('application/json')
  })

  it('auth:false sends no token', async () => {
    signedInWith('A1', 'R1')
    const server = fakeApi({ 'POST otp-request/': () => ok({}) })
    await api('otp-request/', { method: 'POST', body: {}, auth: false })
    expect(server.calls[0].headers.Authorization).toBeUndefined()
  })
})

describe('api(): errors', () => {
  it('turns the error envelope into an ApiError with status, message and errors', async () => {
    fakeApi({
      'POST x/': () => fail(400, 'Invalid data', { otp_code: ['Wrong code'] }),
    })

    const error = await failure(api('x/', { method: 'POST', auth: false }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('Invalid data')
    expect(error.errors).toEqual({ otp_code: ['Wrong code'] })
  })

  it('survives a body that is not JSON (an HTML error page)', async () => {
    fakeApi({ 'GET x/': () => new Response('<html>Bad gateway</html>', { status: 502 }) })

    const error = await failure(api('x/', { auth: false }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.message).toBe('The server answered 502.')
  })

  it('reports an unreachable server as status 0', async () => {
    fakeApi({ 'GET x/': networkDown })

    const error = await failure(api('x/', { auth: false }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Cannot reach the server/)
  })

  it('describeError prefers the first field message over "Invalid data"', () => {
    expect(describeError(new ApiError(400, 'Invalid data', { otp_code: ['Wrong code'] }))).toBe('Wrong code')
    expect(describeError(new ApiError(400, 'Invalid data', { reason: 'Too long' }))).toBe('Too long')
    expect(describeError(new ApiError(409, 'Already decided', null))).toBe('Already decided')
    expect(describeError('weird')).toBe('Something went wrong.')
  })
})

describe('api(): expired access token', () => {
  it('refreshes once, retries with the new token, and stores BOTH new tokens', async () => {
    signedInWith('OLD', 'R1')
    const server = fakeApi({
      'GET staff/me/': (call) =>
        call.headers.Authorization === 'Bearer NEW'
          ? ok({ id: 1 })
          : fail(401, 'Token expired'),
      'POST token/refresh/': () => ok({ access: 'NEW', refresh: 'R2' }),
    })

    const data = await api('staff/me/')

    expect(data).toEqual({ id: 1 })
    expect(server.to('POST token/refresh/')).toHaveLength(1)
    expect(server.to('POST token/refresh/')[0].body).toEqual({ refresh: 'R1' })
    expect(session.getAccess()).toBe('NEW')
    expect(session.getRefresh()).toBe('R2') // rotated: the old one is single-use
  })

  it('the NEXT refresh uses the rotated refresh token, not the first one', async () => {
    signedInWith('OLD', 'R1')
    let refreshes = 0
    const server = fakeApi({
      'GET staff/me/': (call) =>
        call.headers.Authorization === `Bearer ACCESS-${refreshes}`
          ? ok({})
          : fail(401, 'expired'),
      'POST token/refresh/': () => {
        refreshes += 1
        return ok({ access: `ACCESS-${refreshes}`, refresh: `R${refreshes + 1}` })
      },
    })

    await api('staff/me/')
    // the access token expires again later
    session.setTokens({ access: 'stale', refresh: session.getRefresh()! })
    await api('staff/me/')

    const sent = server.to('POST token/refresh/').map((c) => (c.body as { refresh: string }).refresh)
    expect(sent).toEqual(['R1', 'R2'])
  })

  it('two requests that both get 401 share ONE refresh call', async () => {
    signedInWith('OLD', 'R1')
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const server = fakeApi({
      'GET a/': (call) => (call.headers.Authorization === 'Bearer NEW' ? ok('a') : fail(401, 'expired')),
      'GET b/': (call) => (call.headers.Authorization === 'Bearer NEW' ? ok('b') : fail(401, 'expired')),
      'POST token/refresh/': async () => {
        await gate // hold the refresh open so both requests are waiting on it
        return ok({ access: 'NEW', refresh: 'R2' })
      },
    })

    const both = Promise.all([api('a/'), api('b/')])
    // let both 401s arrive and both start waiting
    await vi.waitFor(() => expect(server.to('POST token/refresh/').length).toBe(1))
    await new Promise((r) => setTimeout(r, 20))
    release()

    expect(await both).toEqual(['a', 'b'])
    expect(server.to('POST token/refresh/')).toHaveLength(1) // not two
    expect(session.getRefresh()).toBe('R2') // not signed out
  })

  it('a late 401 from a request sent BEFORE a refresh just retries, with no second refresh', async () => {
    signedInWith('OLD', 'R1')
    let releaseLate!: () => void
    const lateGate = new Promise<void>((resolve) => (releaseLate = resolve))
    const server = fakeApi({
      'GET fast/': (call) => (call.headers.Authorization === 'Bearer NEW' ? ok('fast') : fail(401, 'expired')),
      'GET slow/': async (call) => {
        if (call.headers.Authorization === 'Bearer NEW') return ok('slow')
        await lateGate // answers 401 only after the refresh already happened
        return fail(401, 'expired')
      },
      'POST token/refresh/': () => ok({ access: 'NEW', refresh: 'R2' }),
    })

    const slow = api('slow/')
    await api('fast/') // gets 401, refreshes, succeeds
    releaseLate()

    expect(await slow).toBe('slow')
    expect(server.to('POST token/refresh/')).toHaveLength(1)
  })

  it('a refresh refused with 401 ends the session and tells the app', async () => {
    signedInWith('OLD', 'R1')
    const ended = vi.fn()
    session.setSessionEndedHandler(ended)
    fakeApi({
      'GET staff/me/': () => fail(401, 'expired'),
      'POST token/refresh/': () => fail(401, 'Token is blacklisted'),
    })

    const error = await failure(api('staff/me/'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(session.getRefresh()).toBeNull()
    expect(session.getAccess()).toBeNull()
  })

  it('a refresh that hits a server error (5xx) keeps the session and says so', async () => {
    signedInWith('OLD', 'R1')
    const ended = vi.fn()
    session.setSessionEndedHandler(ended)
    fakeApi({
      'GET staff/me/': () => fail(401, 'expired'),
      'POST token/refresh/': () => json(503, { status: 'error', message: 'down' }),
    })

    const error = await failure(api('staff/me/'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0) // "could not renew", not "signed out"
    expect(ended).not.toHaveBeenCalled()
    expect(session.getRefresh()).toBe('R1')
  })

  it('a refresh with no network keeps the session', async () => {
    signedInWith('OLD', 'R1')
    const ended = vi.fn()
    session.setSessionEndedHandler(ended)
    fakeApi({
      'GET staff/me/': () => fail(401, 'expired'),
      'POST token/refresh/': networkDown,
    })

    const error = await failure(api('staff/me/'))

    expect(error.status).toBe(0)
    expect(ended).not.toHaveBeenCalled()
    expect(session.getRefresh()).toBe('R1')
  })

  it('auth:false never refreshes (a wrong login code is a 401-like answer, not an expiry)', async () => {
    signedInWith('A', 'R1')
    const server = fakeApi({
      'POST otp-verify/': () => fail(401, 'Invalid code'),
    })

    const error = await failure(api('otp-verify/', { method: 'POST', body: {}, auth: false }))

    expect(error.status).toBe(401)
    expect(server.to('POST token/refresh/')).toHaveLength(0)
  })

  it('does not loop: if the retry is also 401, it gives up after one retry', async () => {
    signedInWith('OLD', 'R1')
    const server = fakeApi({
      'GET staff/me/': () => fail(401, 'still no'),
      'POST token/refresh/': () => ok({ access: 'NEW', refresh: 'R2' }),
    })

    const error = await failure(api('staff/me/'))

    expect(error.status).toBe(401)
    expect(server.to('GET staff/me/')).toHaveLength(2)
    expect(server.to('POST token/refresh/')).toHaveLength(1)
  })

  it('does not try to refresh when there is no refresh token at all', async () => {
    const server = fakeApi({ 'GET staff/me/': () => fail(401, 'no token') })

    const error = await failure(api('staff/me/'))

    expect(error.status).toBe(401)
    expect(server.to('POST token/refresh/')).toHaveLength(0)
  })
})

describe('apiFile()', () => {
  it('returns the file as a Blob, sending the Bearer token', async () => {
    signedInWith('A1', 'R1')
    const server = fakeApi({
      'GET f/': () => new Response('abc', { status: 200, headers: { 'Content-Type': 'image/png' } }),
    })

    const blob = await apiFile('f/')

    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('abc')
    expect(server.calls[0].headers.Authorization).toBe('Bearer A1')
  })

  it('renews an expired token and repeats the request, like api()', async () => {
    signedInWith('OLD', 'R1')
    const server = fakeApi({
      'GET f/': (call) =>
        call.headers.Authorization === 'Bearer NEW'
          ? new Response('ok', { status: 200, headers: { 'Content-Type': 'application/pdf' } })
          : fail(401, 'expired'),
      'POST token/refresh/': () => ok({ access: 'NEW', refresh: 'R2' }),
    })

    const blob = await apiFile('f/')

    expect(await blob.text()).toBe('ok')
    expect(server.to('POST token/refresh/')).toHaveLength(1)
  })

  it('turns an error answer into an ApiError with the server message', async () => {
    signedInWith('A1', 'R1')
    fakeApi({ 'GET f/': () => fail(404, 'The file is missing from storage.') })

    const error = await failure(apiFile('f/'))

    expect(error.status).toBe(404)
    expect(error.message).toBe('The file is missing from storage.')
  })
})
