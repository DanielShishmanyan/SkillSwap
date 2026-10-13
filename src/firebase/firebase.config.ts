import { getApp, getApps, initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId)
export const firebaseApp = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const appCheckKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
export const isAppCheckConfigured = Boolean(firebaseApp && appCheckKey)
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
  // Firebase prints a local debug token to register in the App Check console.
  const debugGlobal = self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
  debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}
if (firebaseApp && appCheckKey) initializeAppCheck(firebaseApp, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true })
export const isDemoAuthEnabled = import.meta.env.DEV && !isFirebaseConfigured && import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true'
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null
export const storage = firebaseApp ? getStorage(firebaseApp) : null
