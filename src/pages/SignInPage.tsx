import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { requestOtp } from '../api/auth'
import { describeError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { safeLocalPath } from '../lib/safePath'

/** Sign in with the phone number and the code sent to it (two steps). */
export function SignInPage() {
  const { state, signIn } = useAuth()
  const location = useLocation()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Where the person was going before being sent here (the filters included).
  // Set only by our own redirect; safeLocalPath is the safety net.
  const cameFrom = safeLocalPath((location.state as { from?: unknown } | null)?.from)

  // Once the server has said who this is (staff, not staff, or unreachable), leave
  // this screen: the guarded screen shows the right thing, and for a signed-in
  // person it is the place they were going. Only a signed-out visitor stays here.
  if (state.status !== 'signedOut' && state.status !== 'loading') {
    return <Navigate to={cameFrom} replace />
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await requestOtp(phone.trim())
      // The server only includes the code when OTP_MOCK_ENABLED is on, and
      // production refuses to start with it on. `import.meta.env.DEV` is false
      // in a production build, so this line cannot show anything there.
      setDevCode(import.meta.env.DEV ? (result.otp_code ?? null) : null)
      setStep('code')
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(phone.trim(), code.trim())
      // Nothing more to do: once the server has answered, the redirect above takes over.
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
    }
  }

  function changeNumber() {
    setStep('phone')
    setCode('')
    setDevCode(null)
    setError(null)
  }

  return (
    <div className="sign-in">
      <h1>Manakir Staff</h1>

      {step === 'phone' ? (
        <form onSubmit={submitPhone}>
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05XXXXXXXX"
            required
          />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode}>
          <p>
            A code was sent to <strong dir="ltr">{phone}</strong>.
          </p>
          {devCode && <p className="dev-hint">Development only: the code is {devCode}</p>}
          <label htmlFor="code">Code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>{' '}
          <button type="button" className="secondary" onClick={changeNumber}>
            Change number
          </button>
        </form>
      )}
    </div>
  )
}
