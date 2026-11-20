import { createHash, timingSafeEqual } from 'node:crypto'
import { AuthError } from '../functions/src/auth-handlers.js'

export const APP_ORIGIN = new URL(process.env.APP_URL || 'https://www.skillswap.vip').origin
export const sessionUrl = id => `${APP_ORIGIN}/session/${id}`
export const bookingId = (uid, requestId) => createHash('sha256').update(`${uid}:${requestId}`).digest('hex').slice(0, 32)

export function validateSchedule(input, now = Date.now()) {
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  const startsAt = typeof input?.startsAt === 'string' ? Date.parse(input.startsAt) : NaN
  const duration = input?.duration
  const timezone = input?.timezone
  if (title.length < 2 || title.length > 100 || !Number.isFinite(startsAt)
      || startsAt < now + 10 * 60_000 || startsAt > now + 365 * 24 * 60 * 60_000
      || ![30, 45, 60, 90, 120].includes(duration) || typeof timezone !== 'string' || timezone.length > 100) {
    throw new AuthError('invalid-argument', 'Choose a lesson title, a time at least 10 minutes from now, and a valid duration.')
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() }
  catch { throw new AuthError('invalid-argument', 'Choose a valid time zone.') }
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > 1000) throw new AuthError('invalid-argument', 'Keep your message under 1,000 characters.')
  return { title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(startsAt + duration * 60_000).toISOString(), duration, timezone, note }
}

export function requireParticipant(booking, uid) {
  if (!booking || !booking.participantIds.includes(uid)) throw new AuthError('permission-denied', 'This session is only available to its participants.')
}

export function requireVerifiedSession(identity, now = Date.now()) {
  const verifiedAt = identity.otp_verified_at
  if (identity.firebase?.sign_in_provider !== 'custom' || identity.email_otp !== true || identity.email_verified !== true
      || !Number.isInteger(verifiedAt) || verifiedAt * 1000 > now || now >= (verifiedAt + 43200) * 1000) {
    throw new AuthError('unauthenticated', 'Sign in and verify your email to continue.')
  }
}

export function reminderDue(booking, now = Date.now()) {
  const startsAt = Date.parse(booking.startsAt)
  return booking.status === 'confirmed' && Boolean(booking.meetingLink) && !booking.syncPending
    && booking.reminderSentRevision !== booking.revision && startsAt > now
    && startsAt - 60 * 60_000 <= now
    && Date.parse(booking.confirmedAt) <= startsAt - 60 * 60_000
}

export function secretMatches(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || expected.length < 32) return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function publicBooking(record) {
  const { lease, calendarEventId, calendarOwnerId, notificationRevision, reminderSentRevision, ...publicData } = record
  void lease; void calendarEventId; void calendarOwnerId; void notificationRevision; void reminderSentRevision
  const currentMeeting = record.calendarEventId === `ss${record.id}r${record.revision}`
  return { ...publicData, meetingLink: record.status === 'confirmed' && currentMeeting ? record.meetingLink : null }
}
