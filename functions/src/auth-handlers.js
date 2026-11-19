import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { canResend, CODE_LIFETIME_MS, createChallengeId, createCode, digest, nextRateLimit, RESEND_DELAY_MS, validateStart, verifyChallenge } from './otp.js'

export class AuthError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function createAuthHandlers({ db, adminAuth, otpSecret, resendKey, firebaseWebKey, emailFrom }) {
  const invalidCode = () => new AuthError('invalid-argument', 'The code is invalid, expired, or already used. Start again if needed.')
  const challengeRef = id => db.collection('authChallenges').doc(id)

  function getChallengeId(data) {
    if (typeof data?.challengeId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.challengeId)) throw invalidCode()
    return data.challengeId
  }

  async function rateLimit(request, action, extra = []) {
    const secret = otpSecret
    const ip = request.rawRequest.ip || request.rawRequest.socket.remoteAddress || 'unknown'
    const buckets = [[`ip:${action}:${ip}`, action === 'verify' ? 60 : 20], ...extra]
    await db.runTransaction(async transaction => {
      const refs = buckets.map(([key]) => db.collection('authRateLimits').doc(digest(secret, key)))
      const snapshots = await transaction.getAll(...refs)
      const now = Date.now()
      const updates = snapshots.map((snapshot, index) => nextRateLimit(snapshot.data(), buckets[index][1], now))
      if (updates.some(update => !update)) throw new AuthError('resource-exhausted', 'Too many attempts. Please try again in 15 minutes.')
      updates.forEach((update, index) => transaction.set(refs[index], { ...update, deleteAfter: Timestamp.fromMillis(update.resetAt) }))
    })
  }

  async function sendEmail(email, code, id, generation) {
    await db.runTransaction(async transaction => {
      const ref = db.collection('authRateLimits').doc(digest(otpSecret, 'email:daily-budget'))
      const record = (await transaction.get(ref)).data()
      const update = nextRateLimit(record, 100, Date.now(), 24 * 60 * 60 * 1000)
      if (!update) throw new AuthError('resource-exhausted', 'The daily email limit has been reached. Please try again tomorrow.')
      transaction.set(ref, { ...update, deleteAfter: Timestamp.fromMillis(update.resetAt) })
    })
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `auth-${id}-${generation}` },
      body: JSON.stringify({ from: emailFrom, to: [email], subject: 'Your SkillSwap verification code',
        text: `Your SkillSwap code is: ${code}\n\nIt expires 10 minutes after your initial request and can be used only once. Never share this code.\n\nIf you did not request this email, you can ignore it.` }),
    })
    if (response.status === 403 && emailFrom.includes('@resend.dev')) {
      throw new AuthError('failed-precondition', 'The test sender can only email the address registered with Resend. Use that address or configure a verified sending domain.')
    }
    if (!response.ok) throw new AuthError('unavailable', 'We could not send the email. Please try again later.')
  }

  async function confirmDelivery(id, generation) {
    const ref = challengeRef(id)
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data()
      if (!current || current.consumed || current.resends !== generation) return
      transaction.update(ref, { emailSent: true })
    })
  }

  function publicChallenge(id, record) {
    return { challengeId: id, expiresAt: record.expiresAt, resendAfter: record.resendAfter }
  }

  async function passwordLogin(email, password) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseWebKey)}`, {
      method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
    if (!response.ok) throw new AuthError('unauthenticated', 'Unable to sign in. Check your email and password.')
    const result = await response.json()
    if (!result.localId || result.mfaPendingCredential) throw new AuthError('unauthenticated', 'Unable to sign in with this method.')
    // Password-only credentials never reach the browser. Only the verified-code endpoint issues a session.
    return adminAuth.getUser(result.localId)
  }

  const startEmailAuth = async request => {
    const input = validateStart(request.data)
    if (!input) throw new AuthError('invalid-argument', 'Check your details. New passwords need 12–128 characters and names need 2–80 characters.')
    await rateLimit(request, 'start', [[`email:start:${input.email}`, 6]])
    let account
    if (input.purpose === 'register') {
      try {
        account = await adminAuth.createUser({ email: input.email, password: input.password, displayName: input.name, emailVerified: false })
      } catch {
        throw new AuthError('failed-precondition', 'Unable to create this account. Try signing in, or try again later.')
      }
    } else account = await passwordLogin(input.email, input.password)
    if (account.disabled) throw new AuthError('unauthenticated', 'Unable to sign in.')

    const id = createChallengeId()
    const { code, codeHash } = createCode(otpSecret, id)
    const now = Date.now()
    const record = { uid: account.uid, email: account.email, codeHash, attempts: 0, resends: 0, consumed: false, emailSent: false,
      credentialsValidAfter: account.tokensValidAfterTime ?? '', createdAt: now, expiresAt: now + CODE_LIFETIME_MS,
      resendAfter: now + RESEND_DELAY_MS, deleteAfter: Timestamp.fromMillis(now + CODE_LIFETIME_MS) }
    const pointer = db.collection('authChallengeOwners').doc(account.uid)
    await db.runTransaction(async transaction => {
      const old = (await transaction.get(pointer)).data()
      if (old?.resendAfter > now) throw new AuthError('resource-exhausted', 'Please wait one minute before requesting another code.')
      if (old?.challengeId) transaction.set(challengeRef(old.challengeId), { consumed: true }, { merge: true })
      transaction.create(challengeRef(id), record)
      transaction.set(pointer, { challengeId: id, resendAfter: record.resendAfter, deleteAfter: record.deleteAfter })
    })
    try { await sendEmail(record.email, code, id, 0) }
    catch (error) {
      if (error instanceof AuthError && error.code === 'resource-exhausted') throw error
      const deliveryMessage = error instanceof AuthError ? error.message : 'The email could not be sent.'
      throw new AuthError('failed-precondition', input.purpose === 'register'
        ? `Your account was created. ${deliveryMessage} Wait one minute, then sign in to request a new code.`
        : `${deliveryMessage} Wait one minute and try signing in again.`)
    }
    await confirmDelivery(id, 0)
    return publicChallenge(id, record)
  }

  const resendEmailAuthCode = async request => {
    const id = getChallengeId(request.data)
    await rateLimit(request, 'resend')
    let { code, codeHash } = createCode(otpSecret, id)
    const record = await db.runTransaction(async transaction => {
      const ref = challengeRef(id)
      const current = (await transaction.get(ref)).data()
      const now = Date.now()
      if (!canResend(current, now)) throw new AuthError('failed-precondition', 'Wait before resending, or restart sign-in if your code expired.')
      while (codeHash === current.codeHash) ({ code, codeHash } = createCode(otpSecret, id))
      const updated = { ...current, codeHash, resends: current.resends + 1, resendAfter: now + RESEND_DELAY_MS, emailSent: false }
      transaction.update(ref, { codeHash, resends: updated.resends, resendAfter: updated.resendAfter, emailSent: false })
      return updated
    })
    await sendEmail(record.email, code, id, record.resends)
    await confirmDelivery(id, record.resends)
    return publicChallenge(id, record)
  }

  const verifyEmailAuthCode = async request => {
    const id = getChallengeId(request.data)
    if (typeof request.data.code !== 'string' || !/^\d{6}$/.test(request.data.code)) throw invalidCode()
    await rateLimit(request, 'verify')
    const ref = challengeRef(id)
    const initial = (await ref.get()).data()
    if (!initial) throw invalidCode()
    await rateLimit(request, 'verify-account', [[`uid:verify:${initial.uid}`, 10]])
    const record = await db.runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data()
      const decision = verifyChallenge(current, id, request.data.code, otpSecret, Date.now())
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
  }

  return { startEmailAuth, resendEmailAuthCode, verifyEmailAuthCode }
}
