import { browserSessionPersistence, GoogleAuthProvider, setPersistence, signInWithCustomToken, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseApp } from '../../firebase/firebase.config'

export interface AuthChallenge { challengeId: string; expiresAt: number; resendAfter: number }
const requireAuth = () => {
  if (!auth || !firebaseApp) throw new Error('Secure sign-in is not configured yet.')
  return auth
}
const call = async <T>(name: string, data: unknown): Promise<T> => {
  requireAuth()
  const response = await fetch(`/api/auth/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result || !('data' in result)) {
    const error = new Error(result?.error?.message || 'Email sign-in is temporarily unavailable.')
    Object.assign(error, { code: result?.error?.code || 'functions/unavailable' })
    throw error
  }
  return result.data as T
}
export const authService = {
  async loginWithGoogle() {
    const firebaseAuth = requireAuth()
    await setPersistence(firebaseAuth, browserSessionPersistence)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(firebaseAuth, provider)
  },
  login(email: string, password: string) { return call<AuthChallenge>('startEmailAuth', { purpose: 'login', email, password }) },
  register(name: string, email: string, password: string) { return call<AuthChallenge>('startEmailAuth', { purpose: 'register', name, email, password }) },
  resend(challengeId: string) { return call<AuthChallenge>('resendEmailAuthCode', { challengeId }) },
  async verify(challengeId: string, code: string) {
    const { customToken } = await call<{ customToken: string }>('verifyEmailAuthCode', { challengeId, code })
    const firebaseAuth = requireAuth()
    await setPersistence(firebaseAuth, browserSessionPersistence)
    return signInWithCustomToken(firebaseAuth, customToken)
  },
  logout() { return signOut(requireAuth()) },
}
