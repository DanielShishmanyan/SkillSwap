import { createHmac } from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { AuthError, createAuthHandlers } from '../functions/src/auth-handlers.js'

let runtime

export function getAuthRuntime() {
  if (runtime) return runtime
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID
  const firebaseWebKey = process.env.VITE_FIREBASE_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.AUTH_EMAIL_FROM
  if (!credentials.private_key || !credentials.client_email || credentials.project_id !== projectId
      || !firebaseWebKey || !resendKey || !emailFrom) {
    throw new AuthError('unavailable', 'Email sign-in setup is incomplete.')
  }
  // A separate purpose-derived key keeps OTP hashes stable across Vercel instances.
  const otpSecret = process.env.OTP_HMAC_KEY
    || createHmac('sha256', credentials.private_key).update('skillswap:email-auth:v1').digest('hex')
  if (otpSecret.length < 32) throw new AuthError('unavailable', 'Email sign-in setup is incomplete.')
  const app = getApps().find(app => app.name === 'vercel-auth')
    || initializeApp({ credential: cert(credentials), projectId }, 'vercel-auth')
  const db = getFirestore(app)
  const adminAuth = getAuth(app)
  runtime = {
    db,
    adminAuth,
    encryptionSecret: otpSecret,
    handlers: createAuthHandlers({ db, adminAuth, otpSecret, resendKey, firebaseWebKey, emailFrom }),
  }
  return runtime
}
