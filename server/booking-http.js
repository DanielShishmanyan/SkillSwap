import { AuthError } from '../functions/src/auth-handlers.js'
import { APP_ORIGIN, requireVerifiedSession, secretMatches } from './booking-policy.js'

const statuses = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'failed-precondition': 409, 'resource-exhausted': 429, unavailable: 503 }

export function createBookingHttp(getRuntime, area) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const action = request.query.action
    try {
      if (area === 'calendar' && action === 'callback' && request.method === 'GET') {
        if (request.query.error) return response.redirect(303, APP_ORIGIN + '/session/new?calendar=cancelled')
        const result = await getRuntime().google.callback(request.query, request.headers.cookie)
        response.setHeader('Set-Cookie', result.cookie)
        return response.redirect(303, result.url)
      }
      if (area === 'sessions' && action === 'reminders' && request.method === 'GET') {
        const secret = process.env.SESSION_CRON_SECRET
        if (!secret || secret.length < 32 || !secretMatches(request.headers.authorization, 'Bearer ' + secret)) {
          return response.status(401).json({ error: { message: 'Unauthorized scheduler.' } })
        }
        return response.status(200).json({ data: await getRuntime().bookings.processJobs() })
      }
      const allowed = area === 'calendar' ? ['status', 'connect'] : ['create', 'list', 'get', 'update']
      if (!allowed.includes(action)) return response.status(404).json({ error: { message: 'Unknown session action.' } })
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST')
        return response.status(405).json({ error: { message: 'Use POST.' } })
      }
      const expected = `https://${request.headers.host}`
      const local = process.env.VERCEL !== '1' && `http://${request.headers.host}`
      if (request.headers.origin !== expected && request.headers.origin !== local) throw new AuthError('permission-denied', 'Open SkillSwap to continue.')
      if (!request.headers['content-type']?.startsWith('application/json') || !request.body
          || typeof request.body !== 'object' || Array.isArray(request.body) || Buffer.byteLength(JSON.stringify(request.body)) > 8192) {
        throw new AuthError('invalid-argument', 'Invalid session request.')
      }
      const bearer = request.headers.authorization
      if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ') || bearer.length > 10_000) throw new AuthError('unauthenticated', 'Sign in to continue.')
      const runtime = getRuntime()
      let identity
      try { identity = await runtime.adminAuth.verifyIdToken(bearer.slice(7), true) }
      catch { throw new AuthError('unauthenticated', 'Sign in to continue.') }
      requireVerifiedSession(identity)
      if (area === 'calendar') {
        if (action === 'status') return response.status(200).json({ data: await runtime.google.status(identity.uid) })
        const result = await runtime.google.start(identity.uid, identity.email)
        response.setHeader('Set-Cookie', result.cookie)
        return response.status(200).json({ data: { url: result.url } })
      }
      return response.status(200).json({ data: await runtime.bookings[action](identity, request.body) })
    } catch (error) {
      if (area === 'calendar' && action === 'callback') return response.redirect(303, APP_ORIGIN + '/session/new?calendar=failed')
      const known = error instanceof AuthError
      if (!known) console.error('Session request failed', { code: String(error.code || 'internal') })
      return response.status(known ? statuses[error.code] || 500 : 500).json({ error: {
        message: known ? error.message : 'The session could not be updated. Please try again.',
      } })
    }
  }
}
