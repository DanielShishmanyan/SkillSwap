import assert from 'node:assert/strict'
import { after, test } from 'node:test'

// Emulator-only fixtures. Outbound delivery is intercepted; no real email is sent.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Run this test through Firebase emulators:exec.')
process.env.OTP_HMAC_KEY = 'emulator-only-hmac-secret-at-least-32-characters'
process.env.RESEND_API_KEY = 'emulator-only-placeholder'
process.env.FIREBASE_WEB_API_KEY = 'emulator-only-placeholder'
process.env.AUTH_EMAIL_FROM = 'SkillSwap <test@example.com>'
const originalFetch = globalThis.fetch
const emails = []
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.hostname === 'api.resend.com') {
    emails.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ id: 'test-email' }), { status: 200 })
  }
  if (url.hostname === 'identitytoolkit.googleapis.com') {
    return originalFetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com${url.pathname}${url.search}`, init)
  }
  return originalFetch(input, init)
}
const { startEmailAuth, resendEmailAuthCode, verifyEmailAuthCode } = await import('../src/index.js')
const { getFirestore } = await import('firebase-admin/firestore')
const { getAuth } = await import('firebase-admin/auth')
const { getApps, deleteApp } = await import('firebase-admin/app')
const request = data => ({ data, rawRequest: { ip: '127.0.0.2', socket: { remoteAddress: '127.0.0.2' } } })
const latestCode = () => emails.at(-1).text.match(/code is: (\d{6})/)[1]

after(async () => { globalThis.fetch = originalFetch; await Promise.all(getApps().map(deleteApp)) })

test('registration, resend and concurrent verification enforce the full server flow', async () => {
  const email = `flow-${Date.now()}@example.com`
  const challenge = await startEmailAuth.run(request({ purpose: 'register', email, name: 'Test Member', password: 'safe-test-passphrase' }))
  assert.equal(challenge.customToken, undefined)
  assert.equal(emails.at(-1).to[0], email)
  assert.equal((await getAuth().getUserByEmail(email)).emailVerified, false)
  const ref = getFirestore().collection('authChallenges').doc(challenge.challengeId)
  const firstCode = latestCode()
  const stored = (await ref.get()).data()
  assert.equal(stored.code, undefined)
  assert.notEqual(stored.codeHash, firstCode)
  await assert.rejects(resendEmailAuthCode.run(request({ challengeId: challenge.challengeId })))
  await assert.rejects(verifyEmailAuthCode.run(request({ challengeId: challenge.challengeId, code: firstCode === '999999' ? '999998' : '999999' })))
  assert.equal((await ref.get()).data().attempts, 1)
  await ref.update({ resendAfter: Date.now() - 1 })
  await resendEmailAuthCode.run(request({ challengeId: challenge.challengeId }))
  const code = latestCode()
  assert.notEqual(code, firstCode)
  assert.equal((await ref.get()).data().attempts, 1)
  await assert.rejects(verifyEmailAuthCode.run(request({ challengeId: challenge.challengeId, code: firstCode })))
  const results = await Promise.allSettled([
    verifyEmailAuthCode.run(request({ challengeId: challenge.challengeId, code })),
    verifyEmailAuthCode.run(request({ challengeId: challenge.challengeId, code })),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.ok(results.find(result => result.status === 'fulfilled').value.customToken)
  assert.equal((await ref.get()).data().consumed, true)
  const account = await getAuth().getUserByEmail(email)
  assert.equal(account.emailVerified, true)
  assert.equal((await getFirestore().collection('users').doc(account.uid).get()).data().name, 'Test Member')

  await getFirestore().collection('authChallengeOwners').doc(account.uid).update({ resendAfter: 0 })
  await assert.rejects(startEmailAuth.run(request({ purpose: 'login', email, password: 'incorrect-password' })))
  const next = await startEmailAuth.run(request({ purpose: 'login', email, password: 'safe-test-passphrase' }))
  assert.notEqual(next.challengeId, challenge.challengeId)
  assert.equal(next.customToken, undefined)
  assert.ok((await verifyEmailAuthCode.run(request({ challengeId: next.challengeId, code: latestCode() }))).customToken)
})

test('delivery failure cannot create a usable verification challenge', async () => {
  const intercept = globalThis.fetch
  globalThis.fetch = async (input, init) => String(input).startsWith('https://api.resend.com') ? new Response('{}', { status: 503 }) : intercept(input, init)
  try {
    const email = `failed-${Date.now()}@example.com`
    await assert.rejects(startEmailAuth.run(request({ purpose: 'register', email, name: 'Test Member', password: 'safe-test-passphrase' })))
    const account = await getAuth().getUserByEmail(email)
    const pointer = (await getFirestore().collection('authChallengeOwners').doc(account.uid).get()).data()
    assert.equal((await getFirestore().collection('authChallenges').doc(pointer.challengeId).get()).data().emailSent, false)
  } finally { globalThis.fetch = intercept }
})
