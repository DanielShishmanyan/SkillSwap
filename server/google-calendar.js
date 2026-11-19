import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { AuthError } from '../functions/src/auth-handlers.js'
import { APP_ORIGIN, sessionUrl } from './booking-policy.js'

const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned'
const CALLBACK = `${APP_ORIGIN}/api/calendar/callback`
const COOKIE = '__Host-skillswap-calendar'

export function tokenCipher(secret) {
  const key = createHash('sha256').update(`calendar-refresh:v1:${secret}`).digest()
  return {
    encrypt(value, uid) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(uid))
      const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      return [iv, cipher.getAuthTag(), content].map(part => part.toString('base64url')).join('.')
    },
    decrypt(value, uid) {
      const [iv, tag, content] = value.split('.').map(part => Buffer.from(part, 'base64url'))
      const cipher = createDecipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(uid))
      cipher.setAuthTag(tag)
      return Buffer.concat([cipher.update(content), cipher.final()]).toString('utf8')
    },
  }
}

export function createGoogleCalendar({ db, secret, clientId, clientSecret, fetcher = fetch }) {
  const cipher = tokenCipher(secret)
  const configured = Boolean(clientId && clientSecret)
  const connection = uid => db.collection('calendarConnections').doc(uid)
  const stateReference = state => db.collection('calendarOAuthStates').doc(createHash('sha256').update(state).digest('hex'))
  const requireConfiguration = () => {
    if (!configured) throw new AuthError('failed-precondition', 'Google Calendar setup is incomplete. Please try again after setup is complete.')
  }
  const cookie = (state, maxAge) => `${COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  async function exchange(parameters) {
    const response = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...parameters }),
    })
    if (!response.ok) throw new AuthError('failed-precondition', 'Reconnect Google Calendar to create meeting links.')
    return response.json()
  }
  async function accessToken(uid) {
    requireConfiguration()
    const linked = (await connection(uid).get()).data()
    if (!linked?.refreshToken) throw new AuthError('failed-precondition', 'Connect Google Calendar before booking a lesson.')
    const result = await exchange({ grant_type: 'refresh_token', refresh_token: cipher.decrypt(linked.refreshToken, uid) })
    return result.access_token
  }
  async function calendarRequest(uid, path, options = {}, access) {
    const token = access || await accessToken(uid)
    return fetcher(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
      ...options, signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
  }
  return {
    async status(uid) {
      const linked = (await connection(uid).get()).data()
      return { configured, connected: configured && Boolean(linked?.refreshToken), email: linked?.email || null }
    },
    async start(uid, email) {
      requireConfiguration()
      const state = randomBytes(32).toString('base64url')
      const verifier = randomBytes(48).toString('base64url')
      await stateReference(state).create({ uid, email, verifier, expiresAt: Date.now() + 10 * 60_000, consumed: false })
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: CALLBACK, response_type: 'code', access_type: 'offline',
        prompt: 'consent', scope: `openid email ${SCOPE}`, state, login_hint: email,
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
      })
      return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookie: cookie(state, 600) }
    },
    async callback(query, cookies) {
      requireConfiguration()
      const { state, code } = query
      if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof code !== 'string'
          || code.length > 4096 || cookies?.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '=')) !== `${COOKIE}=${state}`) {
        throw new AuthError('permission-denied', 'The calendar connection expired. Please start again.')
      }
      const ref = stateReference(state)
      const request = await db.runTransaction(async transaction => {
        const record = (await transaction.get(ref)).data()
        if (!record || record.consumed || record.expiresAt <= Date.now()) throw new AuthError('permission-denied', 'The calendar connection expired.')
        transaction.update(ref, { consumed: true })
        return record
      })
      const tokens = await exchange({ code, code_verifier: request.verifier, grant_type: 'authorization_code', redirect_uri: CALLBACK })
      const userResponse = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(10_000),
      })
      if (!userResponse.ok) throw new AuthError('permission-denied', 'Could not verify the connected Google account.')
      const googleUser = await userResponse.json()
      if (googleUser.email_verified !== true || googleUser.email?.toLowerCase() !== request.email.toLowerCase()) {
        throw new AuthError('permission-denied', 'Connect the Google account with the same email as your SkillSwap account.')
      }
      if (!tokens.scope?.split(' ').includes(SCOPE)) throw new AuthError('permission-denied', 'Calendar permission is required to create meetings.')
      const oldConnection = (await connection(request.uid).get()).data()
      const refreshToken = tokens.refresh_token
        ? cipher.encrypt(tokens.refresh_token, request.uid)
        : oldConnection?.refreshToken
      if (!refreshToken) throw new AuthError('failed-precondition', 'Reconnect Google Calendar and grant offline access.')
      await connection(request.uid).set({ refreshToken, email: googleUser.email, connectedAt: new Date().toISOString() })
      return { cookie: cookie('', 0), url: `${APP_ORIGIN}/session/new?calendar=connected` }
    },
    async createMeeting(booking) {
      const id = `ss${booking.id}r${booking.revision}`
      const body = {
        id, summary: `SkillSwap · ${booking.title}`,
        description: `View your lesson or reschedule: ${sessionUrl(booking.id)}\n\n${booking.note}`,
        start: { dateTime: booking.startsAt, timeZone: booking.timezone },
        end: { dateTime: booking.endsAt, timeZone: booking.timezone },
        attendees: booking.participants.map(person => ({ email: person.email })),
        conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
        guestsCanModify: false, guestsCanInviteOthers: false,
      }
      const access = await accessToken(booking.calendarOwnerId)
      let response = await calendarRequest(booking.calendarOwnerId, '?conferenceDataVersion=1&sendUpdates=all', { method: 'POST', body: JSON.stringify(body) }, access)
      if (response.status === 409) response = await calendarRequest(booking.calendarOwnerId, '/' + id, {}, access)
      if (!response.ok) throw new AuthError('unavailable', 'Google could not create the calendar invitation. We will retry.')
      const event = await response.json()
      return { calendarEventId: id, calendarLink: event.htmlLink || null, calendarUid: event.iCalUID || null, meetingLink: event.hangoutLink || null }
    },
    async cancelMeeting(booking) {
      if (!booking.calendarEventId) return
      const response = await calendarRequest(booking.calendarOwnerId, '/' + encodeURIComponent(booking.calendarEventId) + '?sendUpdates=all', { method: 'DELETE' })
      if (!response.ok && ![404, 410].includes(response.status)) throw new AuthError('unavailable', 'The calendar cancellation is pending. We will retry.')
    },
  }
}
