import { AuthError } from '../functions/src/auth-handlers.js'

const actions = new Set(['startEmailAuth', 'resendEmailAuthCode', 'verifyEmailAuthCode'])
const statusCodes = {
  'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403,
  'failed-precondition': 409, 'resource-exhausted': 429, unavailable: 503,
}

export function createAuthHttpHandler(getRuntime) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const action = request.query.action
    if (action === 'health' && request.method === 'GET') {
      let stage = 'configuration'
      try {
        const { db } = getRuntime()
        stage = 'firestore'
        await db.collection('authChallenges').doc('__health').get()
        return response.status(200).json({ ready: true })
      } catch {
        return response.status(503).json({ ready: false, stage })
      }
    }
    if (!actions.has(action)) return response.status(404).json({ error: { message: 'Unknown sign-in action.' } })
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return response.status(405).json({ error: { message: 'Use POST.' } })
    }
    // Browser requests must originate from this deployment. No cross-origin CORS is enabled.
    const expectedOrigin = `https://${request.headers.host}`
    const localOrigin = process.env.VERCEL !== '1' && `http://${request.headers.host}`
    if (request.headers.origin !== expectedOrigin && request.headers.origin !== localOrigin) {
      return response.status(403).json({ error: { message: 'Open SkillSwap to continue signing in.' } })
    }
    const contentType = request.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
      return response.status(415).json({ error: { message: 'Use JSON.' } })
    }
    const body = request.body
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 4096) {
      return response.status(400).json({ error: { message: 'Invalid sign-in request.' } })
    }
    try {
      const { handlers } = getRuntime()
      const forwarded = process.env.VERCEL === '1' ? request.headers['x-forwarded-for'] : null
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.socket?.remoteAddress
      const result = await handlers[action]({ data: body, rawRequest: { ip: ip || 'unknown', socket: {} } })
      return response.status(200).json({ data: result })
    } catch (error) {
      const known = error instanceof AuthError
      const code = known ? error.code : 'internal'
      const message = known ? error.message : 'Sign-in is temporarily unavailable. Please try again later.'
      // Never log passwords, verification codes, tokens, or provider response bodies.
      if (!known) console.error('Email authentication failed', { code: String(error.code || 'internal') })
      return response.status(statusCodes[code] || 500).json({ error: { code: `functions/${code}`, message } })
    }
  }
}
