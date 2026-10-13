import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const CODE_LIFETIME_MS = 10 * 60 * 1000
export const RESEND_DELAY_MS = 60 * 1000
export const MAX_ATTEMPTS = 5
export const MAX_RESENDS = 3
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60

export function digest(secret, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('OTP secret must contain at least 32 characters.')
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function createCode(secret, challengeId) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  return { code, codeHash: digest(secret, `code:${challengeId}:${code}`) }
}

export const createChallengeId = () => randomBytes(32).toString('base64url')

export function verifyChallenge(record, id, code, secret, now) {
  if (!record || record.consumed || !record.emailSent || record.expiresAt <= now || record.attempts >= MAX_ATTEMPTS) {
    return { accepted: false, updates: null }
  }
  const actual = Buffer.from(digest(secret, `code:${id}:${code}`), 'hex')
  const expected = Buffer.from(record.codeHash, 'hex')
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected)
  return { accepted: matches, updates: { attempts: record.attempts + 1, consumed: matches } }
}

export function canResend(record, now) {
  return Boolean(record && !record.consumed && record.expiresAt > now && record.resendAfter <= now
    && record.attempts < MAX_ATTEMPTS && record.resends < MAX_RESENDS)
}

export function nextRateLimit(record, limit, now, windowMs = 15 * 60 * 1000) {
  const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + windowMs }
  return current.count >= limit ? null : { count: current.count + 1, resetAt: current.resetAt }
}

export function validateStart(data) {
  if (!data || !['login', 'register'].includes(data.purpose)) return null
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  const password = typeof data.password === 'string' ? data.password : ''
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128 || !password.length) return null
  if (data.purpose === 'register' && (password.length < 12 || name.length < 2 || name.length > 80)) return null
  return { purpose: data.purpose, email, password, name }
}
