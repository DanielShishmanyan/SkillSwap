import { browserSessionPersistence, setPersistence, signInWithCustomToken, signOut } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, firebaseApp, isAppCheckConfigured } from '../../firebase/firebase.config'

export interface AuthChallenge { challengeId: string; expiresAt: number; resendAfter: number }
const requireAuth = () => {
  if (!auth || !firebaseApp) throw new Error('Secure sign-in is not configured yet.')
  return auth
}
const call = async <T>(name: string, data: unknown): Promise<T> => {
  requireAuth()
  if (!isAppCheckConfigured) throw new Error('Email sign-in setup is incomplete. Please try again after setup is complete.')
  const functions = getFunctions(firebaseApp!, 'europe-west1')
  const result = await httpsCallable<unknown, T>(functions, name)(data)
  return result.data
}
export const authService = {
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
