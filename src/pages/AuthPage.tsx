import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ArrowRightLeft, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../components/ui/Button'
import { EmailCodeForm } from '../components/auth/EmailCodeForm'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'
import { useAuth } from '../features/auth/AuthProvider'
import { isDemoAuthEnabled, isFirebaseConfigured } from '../firebase/firebase.config'
import { authErrorMessage } from '../features/auth/auth-errors'
import type { AuthChallenge } from '../features/auth/auth.service'

const loginSchema = z.object({
  name: z.string(),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128, 'Password is too long.'),
  confirmPassword: z.string(),
})
const registrationSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter your full name.').max(80),
  password: z.string().min(12, 'Use at least 12 characters. A passphrase works well.').max(128),
  confirmPassword: z.string().min(12, 'Please repeat the complete password.').max(128),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
type FormValues = z.infer<typeof loginSchema>

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, loading, login, loginWithGoogle, register: createAccount } = useAuth()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null)
  const [challengeEmail, setChallengeEmail] = useState('')
  const canSubmitEmail = isFirebaseConfigured || (isDemoAuthEnabled && !register)
  const schema = register ? registrationSchema : loginSchema
  const { register: field, handleSubmit, resetField, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onChange', reValidateMode: 'onChange', defaultValues: { name: '', email: '', password: '', confirmPassword: '' } })
  const from = (location.state as { from?: unknown } | null)?.from
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') && !['/login', '/register'].includes(from) ? from : '/'
  if (user) return <Navigate to={destination} replace />

  const submit = async (values: FormValues) => {
    if (loading || googleLoading || !canSubmitEmail) return
    setGoogleError('')
    setServerError('')
    try {
      const next = register ? await createAccount(values.name, values.email, values.password) : await login(values.email, values.password)
      setChallengeEmail(values.email.trim().toLowerCase())
      setChallenge(next)
      resetField('password'); resetField('confirmPassword'); setShowPassword(false)
    } catch (error) {
      setServerError(authErrorMessage(error))
    }
  }

  const continueWithGoogle = async () => {
    if (loading || isSubmitting || googleLoading) return
    setServerError('')
    setGoogleError('')
    setGoogleLoading(true)
    try {
      const next = await loginWithGoogle()
      setChallengeEmail(next.email)
      setChallenge(next)
    } catch (error) {
      setGoogleError(authErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  return <main className="auth-page">
    <div className="auth-atmosphere" aria-hidden="true">
      <div className="auth-glow auth-glow-sage" />
      <div className="auth-glow auth-glow-lilac" />
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <span className="auth-spark auth-spark-one" />
      <span className="auth-spark auth-spark-two" />
      <span className="auth-spark auth-spark-three" />
    </div>
    <header className="auth-header">
      <Link to="/login" className="flex w-fit items-center gap-2.5 text-xl font-extrabold text-ink"><span className="auth-logo grid size-10 place-items-center text-white"><ArrowRightLeft size={21}/></span><span>Skill<span className="text-brand-700">Swap</span></span></Link>
      <span className="hidden text-sm text-muted sm:block">A little knowledge. A new connection.</span>
    </header>
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="auth-kicker"><Sparkles size={14}/> GOOD THINGS GROW TOGETHER</span>
        <h2>Share what you know.<br/><span>Learn something new.</span></h2>
        <p>Share a little of your world. Discover a little of someone else’s. Your next skill starts with a connection.</p>
        <div className="auth-exchange" aria-hidden="true">
          <span className="auth-skill">Design</span>
          <span className="auth-exchange-line"><ArrowRightLeft size={18}/></span>
          <span className="auth-skill auth-skill-lilac">Photography</span>
        </div>
        <div className="auth-note"><span className="auth-note-dot"/>Learn together. Grow at your own pace.</div>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-card-eyebrow">{register ? 'Make yourself at home' : 'Welcome back'}</p>
        <h1 id="auth-title" className="mt-2 text-3xl font-bold tracking-tight text-ink">{register ? 'Create your account' : 'Your next chapter awaits.'}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{register ? 'A place to share what you know and discover something new.' : 'Sign in to pick up where you left off.'}</p>
        {isFirebaseConfigured && <div className="auth-google-section"><GoogleSignInButton loading={googleLoading} disabled={loading || isSubmitting || googleLoading} onClick={() => void continueWithGoogle()} /><p className="auth-google-note">A quick Google sign-in, then a code to your inbox.</p><div className="auth-method-divider"><span>or use your email</span></div></div>}
        {googleError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{googleError}</div>}
        <form className={isFirebaseConfigured ? 'mt-6' : 'mt-8'} onSubmit={handleSubmit(submit)} noValidate>
          {register && <Field label="Full name" error={errors.name?.message}><input className="field" autoComplete="name" placeholder="Your full name" {...field('name')} /></Field>}
          <Field label="Email address" error={errors.email?.message} className={register ? 'mt-5' : ''}><input className="field" type="email" autoComplete="email" placeholder="you@example.com" {...field('email')} /></Field>
          <Field label="Password" error={errors.password?.message} className="mt-5"><div className="relative"><input className="field pr-11" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 12 characters' : 'Your password'} maxLength={128} {...field('password')} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-muted hover:bg-slate-100" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></Field>
          {register && <Field label="Confirm password" error={errors.confirmPassword?.message} className="mt-5"><input className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" {...field('confirmPassword', { deps: ['password'] })} /></Field>}
          {serverError && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{serverError}</div>}
          <Button className="auth-submit mt-6 w-full" type="submit" loading={isSubmitting} disabled={loading || isSubmitting || googleLoading || !canSubmitEmail}>{isDemoAuthEnabled ? 'Sign in to demo' : 'Continue with email code'}<ArrowRight size={17}/></Button>
          {isFirebaseConfigured && <p className="mt-3 text-center text-xs leading-5 text-muted">We’ll email you a code to complete {register ? 'registration' : 'sign-in'}.</p>}
          {!canSubmitEmail && <p role="status" className="mt-4 text-sm leading-6 text-muted">Email sign-in is not available yet. Please try again after setup is complete.</p>}
        </form>
        {isDemoAuthEnabled && !register && <div className="auth-demo mt-5 rounded-xl p-4 text-sm"><p className="font-bold text-brand-700">Local demo · no email verification</p><p className="mt-1 text-muted"><span className="font-semibold">mila@skillswap.dev</span> · password: <span className="font-semibold">skillswap</span></p></div>}
        <p className="mt-7 text-center text-sm text-muted">{register ? 'Already have an account?' : 'New to SkillSwap?'} <Link className="font-bold text-brand-700 hover:text-brand-600" to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </section>
      {challenge && <EmailCodeForm key={challenge.challengeId} challenge={challenge} email={challengeEmail} onChallenge={setChallenge} onCancel={() => { setChallenge(null); setServerError(''); setGoogleError('') }} />}
    </div>
    <footer className="auth-footer">© 2026 SkillSwap <span>·</span> Made for curious minds.</footer>
  </main>
}

function Field({ label, error, className = '', children }: { label: string; error?: string; className?: string; children: React.ReactNode }) { return <label className={`block ${className}`}><span className="label">{label}</span>{children}{error && <span className="mt-1.5 block text-xs font-semibold text-red-600">{error}</span>}</label> }
