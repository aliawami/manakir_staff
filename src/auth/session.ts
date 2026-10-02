/**
 * Where the sign-in tokens live.
 *
 * - The ACCESS token (valid 60 minutes) is kept only in a variable, so it is
 *   gone when the page is reloaded and never written to disk.
 * - The REFRESH token is kept in sessionStorage: it survives a reload of the
 *   tab (so you stay signed in), and is wiped when the tab is closed. It is
 *   deliberately NOT in localStorage, which would keep personal-data access
 *   alive after the browser is closed.
 * - Each browser tab therefore signs in on its own.
 *
 * Nothing here knows about React or the network.
 */

export type TokenPair = { access: string; refresh: string }

const REFRESH_KEY = 'manakir_staff_refresh_token'

let accessToken: string | null = null
let onSessionEnded: (() => void) | null = null

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY)
  } catch {
    return null // storage blocked (private mode, policy): behave as signed out
  }
}

function writeStorage(value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(REFRESH_KEY)
    else sessionStorage.setItem(REFRESH_KEY, value)
  } catch {
    // Without storage the session lasts until the page is reloaded.
  }
}

export const session = {
  getAccess(): string | null {
    return accessToken
  },

  getRefresh(): string | null {
    return readStorage()
  },

  setTokens(tokens: TokenPair) {
    accessToken = tokens.access
    writeStorage(tokens.refresh)
  },

  /** Forget the tokens (sign-out). Does not notify anyone. */
  clear() {
    accessToken = null
    writeStorage(null)
  },

  /**
   * The server says this session is over (the refresh token was refused):
   * forget the tokens AND tell the app, so it goes back to the sign-in screen.
   */
  end() {
    session.clear()
    onSessionEnded?.()
  },

  /** The app registers what should happen when `end()` is called. */
  setSessionEndedHandler(handler: (() => void) | null) {
    onSessionEnded = handler
  },
}
