/* eslint-disable react-refresh/only-export-components */
import { onIdTokenChanged, signOut } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, isDemoAuthEnabled } from '../../firebase/firebase.config'
import { authService, type AuthChallenge } from './auth.service'

interface AuthIdentity { id: string; name: string; email: string }
interface AuthContextValue {
  user: AuthIdentity | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthChallenge | null>
  register: (name: string, email: string, password: string) => Promise<AuthChallenge>
  verifyCode: (challengeId: string, code: string) => Promise<void>
  resendCode: (challengeId: string) => Promise<AuthChallenge>
  logout: () => Promise<void>
}
const DEMO_SESSION_KEY = 'skillswap.demo-session'
const demoIdentity = { id: 'me', name: 'Mila Petrova', email: 'mila@skillswap.dev' }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthIdentity | null>(() => {
    if (!isDemoAuthEnabled) return null
    try { return sessionStorage.getItem(DEMO_SESSION_KEY) === 'active' ? demoIdentity : null } catch { return null }
  })
  const [loading, setLoading] = useState(Boolean(auth))
  useEffect(() => {
    // Remove credentials from the retired browser-only account implementation.
    localStorage.removeItem('skillswap.accounts')
    localStorage.removeItem('skillswap.session')
    if (!auth) return
    const firebaseAuth = auth
    let generation = 0
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = onIdTokenChanged(firebaseAuth, async firebaseUser => {
      const current = ++generation
      clearTimeout(expiryTimer)
      if (!firebaseUser) { setUser(null); setLoading(false); return }
      try {
        const token = await firebaseUser.getIdTokenResult()
        if (current !== generation) return
        const verifiedAt = Number(token.claims.otp_verified_at)
        const expiresIn = (verifiedAt + 12 * 60 * 60) * 1000 - Date.now()
        if (token.claims.email_otp !== true || token.claims.email_verified !== true || !Number.isFinite(verifiedAt) || expiresIn <= 0) {
          setUser(null); setLoading(false)
          await signOut(firebaseAuth).catch(() => undefined)
          return
        }
        setUser({ id: firebaseUser.uid, name: firebaseUser.displayName ?? 'SkillSwap member', email: firebaseUser.email ?? '' })
        setLoading(false)
        expiryTimer = setTimeout(() => { setUser(null); void signOut(firebaseAuth).catch(() => undefined) }, expiresIn)
      } catch {
        if (current === generation) { setUser(null); setLoading(false); await signOut(firebaseAuth).catch(() => undefined) }
      }
    })
    return () => { generation++; unsubscribe(); clearTimeout(expiryTimer) }
  }, [])

  const login = async (email: string, password: string) => {
    if (isDemoAuthEnabled) {
      if (email.trim().toLowerCase() !== demoIdentity.email || password !== 'skillswap') throw new Error('Incorrect email or password.')
      sessionStorage.setItem(DEMO_SESSION_KEY, 'active')
      setUser(demoIdentity)
      return null
    }
    return authService.login(email.trim().toLowerCase(), password)
  }
  const register = async (name: string, email: string, password: string) => {
    if (isDemoAuthEnabled) throw new Error('Email registration requires the configured authentication server. Local demo mode supports only the sample account.')
    return authService.register(name.trim(), email.trim().toLowerCase(), password)
  }
  const verifyCode = async (challengeId: string, code: string) => { await authService.verify(challengeId, code) }
  const logout = async () => {
    if (auth) await authService.logout()
    sessionStorage.removeItem(DEMO_SESSION_KEY)
    setUser(null)
  }
  return <AuthContext.Provider value={{ user, loading, login, register, verifyCode, resendCode: authService.resend, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
