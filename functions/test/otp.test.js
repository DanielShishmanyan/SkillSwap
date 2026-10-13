import assert from 'node:assert/strict'
import test from 'node:test'
import { canResend, CODE_LIFETIME_MS, createChallengeId, createCode, digest, MAX_ATTEMPTS, nextRateLimit, RESEND_DELAY_MS, validateStart, verifyChallenge } from '../src/otp.js'

const secret = 'test-only-secret-with-at-least-32-characters'
const now = 1_800_000_000_000
const record = (id, code = '012345') => ({ codeHash: digest(secret, `code:${id}:${code}`), attempts: 0, consumed: false,
  emailSent: true, expiresAt: now + CODE_LIFETIME_MS, resendAfter: now + RESEND_DELAY_MS, resends: 0 })

test('codes are six digits, challenge IDs are unpredictable, and only HMACs are stored', () => {
  const ids = new Set(Array.from({ length: 100 }, createChallengeId))
  assert.equal(ids.size, 100)
  for (const id of ids) {
    assert.match(id, /^[A-Za-z0-9_-]{43}$/)
    const { code, codeHash } = createCode(secret, id)
    assert.match(code, /^\d{6}$/)
    assert.match(codeHash, /^[a-f0-9]{64}$/)
    assert.notEqual(codeHash, code)
    assert.notEqual(codeHash, digest('a-different-secret-at-least-32-characters', `code:${id}:${code}`))
  }
})

test('successful verification consumes the code and prevents replay', () => {
  const id = createChallengeId()
  const current = record(id)
  const decision = verifyChallenge(current, id, '012345', secret, now)
  assert.equal(decision.accepted, true)
  assert.deepEqual(decision.updates, { attempts: 1, consumed: true })
  assert.equal(verifyChallenge({ ...current, ...decision.updates }, id, '012345', secret, now).accepted, false)
})

test('five failed guesses exhaust the challenge, even if the next code is correct', () => {
  const id = createChallengeId()
  let current = record(id)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const decision = verifyChallenge(current, id, '999999', secret, now)
    assert.equal(decision.accepted, false)
    current = { ...current, ...decision.updates }
  }
  assert.equal(current.attempts, MAX_ATTEMPTS)
  assert.equal(verifyChallenge(current, id, '012345', secret, now).accepted, false)
  assert.equal(canResend(current, now + RESEND_DELAY_MS), false)
})

test('expired, undelivered and missing codes cannot authenticate', () => {
  const id = createChallengeId()
  for (const current of [null, { ...record(id), expiresAt: now }, { ...record(id), emailSent: false }]) {
    assert.equal(verifyChallenge(current, id, '012345', secret, now).accepted, false)
  }
  assert.equal(verifyChallenge(record(id), 'another-challenge', '012345', secret, now).accepted, false)
})

test('resends have a cooldown and a limit, and never extend expired codes', () => {
  const current = record(createChallengeId())
  assert.equal(canResend(current, now), false)
  assert.equal(canResend(current, now + RESEND_DELAY_MS), true)
  assert.equal(canResend(current, now + CODE_LIFETIME_MS), false)
  assert.equal(canResend({ ...current, resends: 3 }, now + RESEND_DELAY_MS), false)
  assert.equal(canResend({ ...current, consumed: true }, now + RESEND_DELAY_MS), false)
})

test('replacing a code invalidates its predecessor without resetting attempts', () => {
  const id = createChallengeId()
  const current = { ...record(id), attempts: 3, codeHash: digest(secret, `code:${id}:654321`) }
  assert.equal(verifyChallenge(current, id, '012345', secret, now).accepted, false)
  const result = verifyChallenge(current, id, '654321', secret, now)
  assert.equal(result.accepted, true)
  assert.equal(result.updates.attempts, 4)
})

test('rate limits cannot reset before the window ends', () => {
  let bucket
  for (let i = 0; i < 6; i++) bucket = nextRateLimit(bucket, 6, now + i)
  assert.equal(nextRateLimit(bucket, 6, now + 7), null)
  assert.equal(nextRateLimit(bucket, 6, now + 15 * 60 * 1000).count, 1)
})

test('registration validates password and identity boundaries, login supports existing passwords', () => {
  const valid = { purpose: 'register', email: ' Person@example.com ', name: ' Person ', password: 'long safe passphrase' }
  assert.equal(validateStart(valid).email, 'person@example.com')
  for (const update of [{ password: 'short' }, { password: 'x'.repeat(129) }, { email: 'not-an-email' }, { name: 'x' }, { name: 'x'.repeat(81) }, { purpose: 'admin' }]) {
    assert.equal(validateStart({ ...valid, ...update }), null)
  }
  assert.ok(validateStart({ purpose: 'login', email: 'person@example.com', password: 'old-password' }))
  assert.equal(validateStart({ purpose: 'login', email: 'person@example.com', password: '' }), null)
  assert.throws(() => digest('short', 'input'))
})
