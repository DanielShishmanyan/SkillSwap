import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { AuthError, createAuthHandlers } from './auth-handlers.js'

initializeApp()
const resendKey = defineSecret('RESEND_API_KEY')
const otpSecret = defineSecret('OTP_HMAC_KEY')
const firebaseWebKey = defineString('FIREBASE_WEB_API_KEY')
const emailFrom = defineString('AUTH_EMAIL_FROM')
const options = { region: 'europe-west1', enforceAppCheck: true, secrets: [resendKey, otpSecret], maxInstances: 10, timeoutSeconds: 60 }

function callable(action) {
  return onCall(options, async request => {
    const handlers = createAuthHandlers({
      db: getFirestore(), adminAuth: getAuth(), otpSecret: otpSecret.value(),
      resendKey: resendKey.value(), firebaseWebKey: firebaseWebKey.value(), emailFrom: emailFrom.value(),
    })
    try {
      return await handlers[action](request)
    } catch (error) {
      if (error instanceof AuthError) throw new HttpsError(error.code, error.message)
      throw error
    }
  })
}

export const startEmailAuth = callable('startEmailAuth')
export const resendEmailAuthCode = callable('resendEmailAuthCode')
export const verifyEmailAuthCode = callable('verifyEmailAuthCode')
