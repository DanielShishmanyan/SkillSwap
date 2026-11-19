import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'

let environment
const now = Math.floor(Date.now() / 1000)
const verified = { email_verified: true, email_otp: true, otp_verified_at: now, firebase: { sign_in_provider: 'custom' } }

before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-skillswap-auth',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
    storage: { rules: await readFile(new URL('../../storage.rules', import.meta.url), 'utf8') },
  })
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice'), { id: 'alice', name: 'Alice', email: 'alice@example.com', ratingAverage: 0, xp: 0 })
    await setDoc(doc(context.firestore(), 'authChallenges/secret'), { codeHash: 'private' })
  })
})
after(async () => { await environment?.cleanup() })

test('anonymous, password-only and unverified sessions cannot read application data', async () => {
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'users/alice')))
  for (const claims of [{ email_verified: true }, { ...verified, email_verified: false }, { ...verified, email_otp: false }]) {
    await assertFails(getDoc(doc(environment.authenticatedContext('alice', claims).firestore(), 'users/alice')))
  }
})

test('fresh code-verified sessions can read profiles, expired and future sessions cannot', async () => {
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('alice', verified).firestore(), 'users/alice')))
  for (const issued of [now - 43201, now + 3600, 'not-a-timestamp']) {
    await assertFails(getDoc(doc(environment.authenticatedContext('alice', { ...verified, otp_verified_at: issued }).firestore(), 'users/alice')))
  }
})

test('clients cannot read or write challenges or rate limits even after verification', async () => {
  const db = environment.authenticatedContext('alice', verified).firestore()
  for (const collection of ['authChallenges', 'authRateLimits', 'authChallengeOwners']) {
    await assertFails(getDoc(doc(db, collection, 'secret')))
    await assertFails(setDoc(doc(db, collection, 'secret'), { consumed: false }))
  }
})

test('Google sign-ins cannot access Firebase resources until a code-verified session is issued', async () => {
  const google = { email_verified: true, auth_time: now, firebase: { sign_in_provider: 'google.com' } }
  const invalidSessions = [
    { ...google, email_verified: false },
    { ...google, auth_time: now - 43201 },
    { ...google, auth_time: now + 3600 },
    { ...google, firebase: { sign_in_provider: 'password', identities: { 'google.com': ['linked-account'] } } },
  ]
  const readProfile = claims => getDoc(doc(environment.authenticatedContext('alice', claims).firestore(), 'users/alice'))
  const uploadAvatar = claims => uploadBytes(
    ref(environment.authenticatedContext('alice', claims).storage(), 'avatars/alice/google.png'),
    new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' },
  )
  await assertFails(readProfile(google))
  await assertFails(uploadAvatar(google))
  await assertSucceeds(readProfile(verified))
  await assertSucceeds(uploadAvatar(verified))
  for (const claims of invalidSessions) {
    await assertFails(readProfile(claims))
    await assertFails(uploadAvatar(claims))
  }
})

test('avatar writes require a verified session belonging to the avatar owner', async () => {
  const image = new Uint8Array([137, 80, 78, 71])
  const metadata = { contentType: 'image/png' }
  const upload = (claims, owner = 'alice') => uploadBytes(ref(environment.authenticatedContext('alice', claims).storage(), `avatars/${owner}/test.png`), image, metadata)
  await assertFails(upload({ email_verified: true }))
  await assertFails(upload(verified, 'bob'))
  await assertFails(upload({ ...verified, otp_verified_at: now - 43201 }))
  await assertSucceeds(upload(verified))
})

test('custom-token verification claims survive refresh but do not leak to password-only sign-ins', async () => {
  const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = await import('firebase-admin/app')
  const { getAuth: adminAuth } = await import('firebase-admin/auth')
  const { initializeApp, deleteApp } = await import('firebase/app')
  const { getAuth, connectAuthEmulator, signInWithCustomToken, signOut, signInWithEmailAndPassword } = await import('firebase/auth')
  const admin = initializeAdminApp({ projectId: 'demo-skillswap-auth' }, 'auth-test')
  const app = initializeApp({ projectId: 'demo-skillswap-auth', apiKey: 'fake-api-key' }, 'auth-test')
  try {
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const email = `test-${Date.now()}@example.com`
    const account = await adminAuth(admin).createUser({ email, password: 'safe-test-passphrase', emailVerified: true })
    const token = await adminAuth(admin).createCustomToken(account.uid, { email_otp: true, otp_verified_at: now })
    const result = await signInWithCustomToken(auth, token)
    assert.equal((await result.user.getIdTokenResult(true)).claims.email_otp, true)
    await signOut(auth)
    const passwordOnly = await signInWithEmailAndPassword(auth, email, 'safe-test-passphrase')
    assert.equal((await passwordOnly.user.getIdTokenResult()).claims.email_otp, undefined)
  } finally { await deleteApp(app); await deleteAdminApp(admin) }
})
