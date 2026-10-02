import { api } from './client'
import { session } from '../auth/session'
import type { TokenPair } from '../auth/session'

export type StaffMe = {
  id: number
  phone_number: string
  full_name: string
  roles: string[]
  permissions: string[]
}

export type OtpRequestResult = {
  message: string
  /** Only present when the server runs with OTP_MOCK_ENABLED (development). */
  otp_code?: string
}

/** Ask the server to send a login code to this phone number. */
export function requestOtp(phoneNumber: string): Promise<OtpRequestResult> {
  return api<OtpRequestResult>('otp-request/', {
    method: 'POST',
    body: { phone_number: phoneNumber },
    auth: false,
  })
}

/** Trade the phone number and the code for a pair of tokens. */
export function verifyOtp(phoneNumber: string, otpCode: string): Promise<TokenPair> {
  return api<TokenPair>('otp-verify/', {
    method: 'POST',
    body: { phone_number: phoneNumber, otp_code: otpCode },
    auth: false,
  })
}

/** Who is signed in and what they may do. 403 if the account is not staff. */
export function fetchMe(): Promise<StaffMe> {
  return api<StaffMe>('staff/me/')
}

/**
 * Tell the server to retire the refresh token. Best effort: whatever happens,
 * the caller still clears the tokens locally, so the end state is the same.
 */
export async function logout(): Promise<void> {
  const refresh = session.getRefresh()
  if (refresh === null) return
  try {
    await api('logout/', { method: 'POST', body: { refresh }, auth: false })
  } catch {
    // Already invalid, or the server is unreachable. Nothing more to do.
  }
}
