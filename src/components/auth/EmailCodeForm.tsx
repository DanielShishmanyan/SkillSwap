import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { authErrorMessage } from '../../features/auth/auth-errors'
import type { AuthChallenge } from '../../features/auth/auth.service'
import { Button } from '../ui/Button'

export function EmailCodeForm({ challenge, email, onChallenge, onCancel }: {
  challenge: AuthChallenge; email: string; onChallenge: (challenge: AuthChallenge) => void; onCancel: () => void
}) {
  const { verifyCode, resendCode } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const wait = Math.max(0, Math.ceil((challenge.resendAfter - now) / 1000))
  const expired = now >= challenge.expiresAt
  const verify = async () => {
    if (busy || !/^\d{6}$/.test(code) || expired) return
    setBusy('verify'); setError(''); setNotice('')
    try { await verifyCode(challenge.challengeId, code) }
    catch (failure) { setError(authErrorMessage(failure)) }
    finally { setBusy(null) }
  }
  const resend = async () => {
    if (busy || wait || expired) return
    setBusy('resend'); setError(''); setNotice('')
    try {
      onChallenge(await resendCode(challenge.challengeId)); setCode(''); setNow(Date.now())
      setNotice('A new code has been sent. Only the latest code works.')
    } catch (failure) { setError(authErrorMessage(failure)) }
    finally { setBusy(null) }
  }
  return <>
    <span className="auth-code-icon"><Mail size={23} /></span>
    <p className="auth-card-eyebrow mt-5">One more step</p>
    <h1 id="auth-title" className="mt-2 text-3xl font-bold tracking-tight text-ink">Check your inbox.</h1>
    <p className="mt-3 text-sm leading-6 text-muted">Enter the 6-digit code sent to <strong className="break-all text-ink">{email}</strong>.</p>
    <form className="mt-7" onSubmit={event => { event.preventDefault(); void verify() }}>
      <label className="label" htmlFor="email-code">Verification code</label>
      <input id="email-code" className="field auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus aria-describedby="code-help" aria-invalid={Boolean(error)} disabled={Boolean(busy) || expired} />
      <p id="code-help" className="mt-3 text-xs leading-5 text-muted">{expired ? 'This code has expired. Go back and request a new sign-in code.' : 'Valid for 10 minutes from the first request. Never share your code.'}</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-brand-700">{notice}</p>}
      <Button type="submit" className="auth-submit mt-6 w-full" loading={busy === 'verify'} disabled={Boolean(busy) || expired || code.length !== 6}>Verify and continue<ShieldCheck size={17} /></Button>
    </form>
    <button type="button" className="auth-code-resend" onClick={() => void resend()} disabled={Boolean(busy) || wait > 0 || expired}>{busy === 'resend' ? 'Sending…' : wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
    <button type="button" className="auth-code-back" onClick={onCancel} disabled={Boolean(busy)}><ArrowLeft size={14} />Use a different email or start again</button>
  </>
}
