import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { canResend, CODE_LIFETIME_MS, createChallengeId, createCode, digest, nextRateLimit, RESEND_DELAY_MS, validateStart, verifyChallenge } from './otp.js'

initializeApp()
const db = getFirestore()
const adminAuth = getAuth()
const resendKey = defineSecret('RESEND_API_KEY')
const otpSecret = defineSecret('OTP_HMAC_KEY')
const firebaseWebKey = defineString('FIREBASE_WEB_API_KEY')
const emailFrom = defineString('AUTH_EMAIL_FROM')
const options = { region: 'europe-west1', enforceAppCheck: true, secrets: [resendKey, otpSecret], maxInstances: 10, timeoutSeconds: 60 }
const invalidCode = () => new HttpsError('invalid-argument', 'The code is invalid, expired, or already used. Start again if needed.')
const challengeRef = id => db.collection('authChallenges').doc(id)

function getChallengeId(data) {
  if (typeof data?.challengeId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.challengeId)) throw invalidCode()
  return data.challengeId
}

async function rateLimit(request, action, extra = []) {
  const secret = otpSecret.value()
  const ip = request.rawRequest.ip || request.rawRequest.socket.remoteAddress || 'unknown'
  const buckets = [[`ip:${action}:${ip}`, action === 'verify' ? 60 : 20], ...extra]
  await db.runTransaction(async transaction => {
    const refs = buckets.map(([key]) => db.collection('authRateLimits').doc(digest(secret, key)))
    const snapshots = await transaction.getAll(...refs)
    const now = Date.now()
    const updates = snapshots.map((snapshot, index) => nextRateLimit(snapshot.data(), buckets[index][1], now))
    if (updates.some(update => !update)) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again in 15 minutes.')
    updates.forEach((update, index) => transaction.set(refs[index], { ...update, deleteAfter: Timestamp.fromMillis(update.resetAt) }))
  })
}

async function sendEmail(email, code, id, generation) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${resendKey.value()}`, 'Content-Type': 'application/json', 'Idempotency-Key': `auth-${id}-${generation}` },
    body: JSON.stringify({ from: emailFrom.value(), to: [email], subject: 'Your SkillSwap verification code',
      text: `Your SkillSwap code is: ${code}\n\nIt expires 10 minutes after your initial request and can be used only once. Never share this code.\n\nIf you did not request this email, you can ignore it.` }),
  })
  if (!response.ok) throw new HttpsError('unavailable', 'We could not send the email. Please try again later.')
}

function publicChallenge(id, record) {
  return { challengeId: id, expiresAt: record.expiresAt, resendAfter: record.resendAfter }
}

async function passwordLogin(email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseWebKey.value())}`, {
    method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  if (!response.ok) throw new HttpsError('unauthenticated', 'Unable to sign in. Check your email and password.')
  const result = await response.json()
  if (!result.localId || result.mfaPendingCredential) throw new HttpsError('unauthenticated', 'Unable to sign in with this method.')
  // Password-only credentials never reach the browser. Only the verified-code endpoint issues a session.
  return adminAuth.getUser(result.localId)
}

export const startEmailAuth = onCall(options, async request => {
  const input = validateStart(request.data)
  if (!input) throw new HttpsError('invalid-argument', 'Check your details. New passwords need 12–128 characters and names need 2–80 characters.')
  await rateLimit(request, 'start', [[`email:start:${input.email}`, 6]])
  let account
  if (input.purpose === 'register') {
    try {
      account = await adminAuth.createUser({ email: input.email, password: input.password, displayName: input.name, emailVerified: false })
    } catch {
      throw new HttpsError('failed-precondition', 'Unable to create this account. Try signing in, or try again later.')
    }
  } else account = await passwordLogin(input.email, input.password)
  if (account.disabled) throw new HttpsError('unauthenticated', 'Unable to sign in.')

  const id = createChallengeId()
  const { code, codeHash } = createCode(otpSecret.value(), id)
  const now = Date.now()
  const record = { uid: account.uid, email: account.email, codeHash, attempts: 0, resends: 0, consumed: false, emailSent: false,
    credentialsValidAfter: account.tokensValidAfterTime ?? '', createdAt: now, expiresAt: now + CODE_LIFETIME_MS,
    resendAfter: now + RESEND_DELAY_MS, deleteAfter: Timestamp.fromMillis(now + CODE_LIFETIME_MS) }
  const pointer = db.collection('authChallengeOwners').doc(account.uid)
  await db.runTransaction(async transaction => {
    const old = (await transaction.get(pointer)).data()
    if (old?.resendAfter > now) throw new HttpsError('resource-exhausted', 'Please wait one minute before requesting another code.')
    if (old?.challengeId) transaction.set(challengeRef(old.challengeId), { consumed: true }, { merge: true })
    transaction.create(challengeRef(id), record)
    transaction.set(pointer, { challengeId: id, resendAfter: record.resendAfter, deleteAfter: record.deleteAfter })
  })
  try { await sendEmail(record.email, code, id, 0) }
  catch {
    throw new HttpsError('failed-precondition', input.purpose === 'register'
      ? 'Your account was created, but the email could not be sent. Wait one minute, then sign in to request a new code.'
      : 'The email could not be sent. Wait one minute and try signing in again.')
  }
  await challengeRef(id).update({ emailSent: true })
  return publicChallenge(id, record)
})

export const resendEmailAuthCode = onCall(options, async request => {
  const id = getChallengeId(request.data)
  await rateLimit(request, 'resend')
  let { code, codeHash } = createCode(otpSecret.value(), id)
  const record = await db.runTransaction(async transaction => {
    const ref = challengeRef(id)
    const current = (await transaction.get(ref)).data()
    const now = Date.now()
    if (!canResend(current, now)) throw new HttpsError('failed-precondition', 'Wait before resending, or restart sign-in if your code expired.')
    while (codeHash === current.codeHash) ({ code, codeHash } = createCode(otpSecret.value(), id))
    const updated = { ...current, codeHash, resends: current.resends + 1, resendAfter: now + RESEND_DELAY_MS, emailSent: false }
    transaction.update(ref, { codeHash, resends: updated.resends, resendAfter: updated.resendAfter, emailSent: false })
    return updated
  })
  await sendEmail(record.email, code, id, record.resends)
  await challengeRef(id).update({ emailSent: true })
  return publicChallenge(id, record)
})

export const verifyEmailAuthCode = onCall(options, async request => {
  const id = getChallengeId(request.data)
  if (typeof request.data.code !== 'string' || !/^\d{6}$/.test(request.data.code)) throw invalidCode()
  await rateLimit(request, 'verify')
  const ref = challengeRef(id)
  const initial = (await ref.get()).data()
  if (!initial) throw invalidCode()
  await rateLimit(request, 'verify-account', [[`uid:verify:${initial.uid}`, 10]])
  const record = await db.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data()
    const decision = verifyChallenge(current, id, request.data.code, otpSecret.value(), Date.now())
    // Commit failed attempts too; throwing inside the transaction would roll them back.
    if (decision.updates) transaction.update(ref, decision.updates)
    return decision.accepted ? current : null
  })
  if (!record) throw invalidCode()
  const account = await adminAuth.getUser(record.uid)
  if (account.disabled || account.email !== record.email || (account.tokensValidAfterTime ?? '') !== record.credentialsValidAfter) throw invalidCode()
  if (!account.emailVerified) await adminAuth.updateUser(account.uid, { emailVerified: true })
  const profile = db.collection('users').doc(account.uid)
  await db.runTransaction(async transaction => {
    if ((await transaction.get(profile)).exists) return
    transaction.create(profile, { id: account.uid, name: account.displayName ?? 'SkillSwap member', email: account.email, avatar: '', bio: '', location: '',
      availability: { days: [], time: '', timezone: 'Europe/Sofia' }, ratingAverage: 0, ratingCount: 0, completedSwaps: 0,
      completedLessons: 0, xp: 0, level: 1, teaches: [], learns: [], achievements: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  })
  // These claims belong to this custom-token session, never to all password sign-ins for the user.
  const customToken = await adminAuth.createCustomToken(account.uid, { email_otp: true, otp_verified_at: Math.floor(Date.now() / 1000) })
  return { customToken }
})
