import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthHttpHandler } from '../server/auth-http.js'
import { AuthError } from '../functions/src/auth-handlers.js'

test('the deployable Vercel entry point imports with the root production dependencies', async () => {
  const { default: handler } = await import('../api/auth/[action].js')
  assert.equal(typeof handler, 'function')
})

function request(overrides = {}) {
  return {
    method: 'POST', query: { action: 'startEmailAuth' },
    headers: { host: 'skillswap.example', origin: 'https://skillswap.example', 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    body: { purpose: 'login', email: 'member@example.com', password: 'a-test-passphrase' },
    ...overrides,
  }
}

async function invoke(handler, input) {
  const response = {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  await handler(input, response)
  return response
}

test('Vercel accepts same-origin JSON and returns only the server challenge', async () => {
  const challenge = { challengeId: 'opaque-id', expiresAt: 1234, resendAfter: 1000 }
  const handler = createAuthHttpHandler(() => ({ handlers: {
    startEmailAuth: async input => { assert.equal(input.data.password, 'a-test-passphrase'); return challenge },
  } }))
  const response = await invoke(handler, request())
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { data: challenge })
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('cross-origin, non-JSON, malformed and non-POST requests never reach authentication', async () => {
  const handler = createAuthHttpHandler(() => { throw new Error('Authentication must not run') })
  const cases = [
    [request({ headers: { host: 'skillswap.example', origin: 'https://other.example', 'content-type': 'application/json' } }), 403],
    [request({ method: 'GET' }), 405],
    [request({ headers: { host: 'skillswap.example', origin: 'https://skillswap.example' } }), 415],
    [request({ body: [] }), 400],
    [request({ body: { password: 'x'.repeat(4097) } }), 400],
    [request({ query: { action: '__proto__' } }), 404],
  ]
  for (const [input, status] of cases) assert.equal((await invoke(handler, input)).statusCode, status)
})

test('rate-limit errors preserve their code and private server errors are redacted', async () => {
  const limited = createAuthHttpHandler(() => ({ handlers: {
    startEmailAuth: async () => { throw new AuthError('resource-exhausted', 'Too many attempts.') },
  } }))
  const response = await invoke(limited, request())
  assert.equal(response.statusCode, 429)
  assert.equal(response.body.error.code, 'functions/resource-exhausted')
  const failed = createAuthHttpHandler(() => { throw new Error('private credential material') })
  const failure = await invoke(failed, request())
  assert.equal(failure.statusCode, 500)
  assert.ok(!JSON.stringify(failure.body).includes('private credential material'))
})

test('health probes check database access without sending email or creating accounts', async () => {
  let databaseRead = false
  const handler = createAuthHttpHandler(() => ({ db: {
    collection: () => ({ doc: () => ({ get: async () => { databaseRead = true } }) }),
  } }))
  const response = await invoke(handler, request({ method: 'GET', query: { action: 'health' } }))
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.ready, true)
  assert.ok(databaseRead)
  const failed = createAuthHttpHandler(() => { throw new Error('missing private key') })
  assert.deepEqual((await invoke(failed, request({ method: 'GET', query: { action: 'health' } }))).body, { ready: false, stage: 'configuration' })
})
