import { describe, expect, it, vi } from 'vitest'
import { session } from './session'

describe('session', () => {
  it('keeps the access token in memory only, and the refresh token in sessionStorage', () => {
    session.setTokens({ access: 'ACCESS-SECRET', refresh: 'REFRESH-1' })

    expect(session.getAccess()).toBe('ACCESS-SECRET')
    expect(session.getRefresh()).toBe('REFRESH-1')

    const everythingStored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage })
    expect(everythingStored).toContain('REFRESH-1')
    expect(everythingStored).not.toContain('ACCESS-SECRET')
    expect(localStorage.length).toBe(0) // never localStorage
  })

  it('clear() forgets both tokens without notifying the app', () => {
    const handler = vi.fn()
    session.setSessionEndedHandler(handler)
    session.setTokens({ access: 'a', refresh: 'r' })

    session.clear()

    expect(session.getAccess()).toBeNull()
    expect(session.getRefresh()).toBeNull()
    expect(handler).not.toHaveBeenCalled()
  })

  it('end() forgets both tokens AND notifies the app', () => {
    const handler = vi.fn()
    session.setSessionEndedHandler(handler)
    session.setTokens({ access: 'a', refresh: 'r' })

    session.end()

    expect(session.getAccess()).toBeNull()
    expect(session.getRefresh()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('end() with no handler registered does not crash', () => {
    session.setTokens({ access: 'a', refresh: 'r' })
    expect(() => session.end()).not.toThrow()
  })

  it('behaves as signed out when storage is blocked, and does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(session.getRefresh()).toBeNull()
    expect(() => session.setTokens({ access: 'a', refresh: 'r' })).not.toThrow()
    expect(session.getAccess()).toBe('a') // still works until the page reloads
  })
})
