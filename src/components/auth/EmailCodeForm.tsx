import { ArrowLeft, Clock3, Mail, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    dialog.querySelector('input')?.focus()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const wait = Math.max(0, Math.ceil((challenge.resendAfter - now) / 1000))
  const expired = now >= challenge.expiresAt
  const remaining = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
  const remainingTime = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
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
  return <dialog ref={dialogRef} className="auth-card auth-verification-dialog" aria-labelledby="auth-code-title" aria-describedby="auth-code-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <button type="button" className="auth-dialog-close" aria-label="Close verification" disabled={Boolean(busy)} onClick={onCancel}><X size={19} /></button>
    <div className="auth-code-heading">
      <span className="auth-code-icon"><Mail size={27} strokeWidth={1.5} /></span>
      <p className="auth-card-eyebrow">Verify your email</p>
      <h2 id="auth-code-title">Check your inbox.</h2>
      <p id="auth-code-description">Enter the six-digit code we sent to</p>
      <p className="auth-code-email">{email}</p>
    </div>
    <form className="mt-7" onSubmit={event => { event.preventDefault(); void verify() }}>
      <label className="label" htmlFor="email-code">Verification code</label>
      <div className="auth-code-entry" data-invalid={Boolean(error)} data-disabled={Boolean(busy) || expired}>
        <div className="auth-code-slots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} data-filled={Boolean(code[index])} data-active={index === code.length}>{code[index] || '·'}</span>)}</div>
        <input id="email-code" className="auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} onPaste={event => { event.preventDefault(); setCode(event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)); setError('') }} aria-describedby="code-help" aria-invalid={Boolean(error)} disabled={Boolean(busy) || expired} />
      </div>
      <p id="code-help" className="auth-code-expiry"><Clock3 size={13} aria-hidden="true" />{expired ? 'Code expired. Start again to get a new one.' : `Code expires in ${remainingTime}`}</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-brand-700">{notice}</p>}
      <Button type="submit" className="auth-submit mt-6 w-full" loading={busy === 'verify'} disabled={Boolean(busy) || expired || code.length !== 6}>Verify and sign in<ShieldCheck size={17} /></Button>
    </form>
    <button type="button" className="auth-code-resend" onClick={() => void resend()} disabled={Boolean(busy) || wait > 0 || expired}>{busy === 'resend' ? 'Sending…' : wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
    <button type="button" className="auth-code-back" onClick={onCancel} disabled={Boolean(busy)}><ArrowLeft size={14} />Back to sign in</button>
  </dialog>
}
