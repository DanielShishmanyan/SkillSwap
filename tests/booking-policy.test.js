import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingId, publicBooking, reminderDue, requireVerifiedSession, secretMatches, validateSchedule } from '../server/booking-policy.js'
import { tokenCipher } from '../server/google-calendar.js'
import { createBookingHttp } from '../server/booking-http.js'

const now = Date.now()
const schedule = { title: 'Photography', startsAt: new Date(now + 3 * 60 * 60_000).toISOString(), duration: 45, timezone: 'Europe/Sofia', note: 'Bring your camera.' }

test('scheduling validates real future dates, supported durations, and time zones', () => {
  const valid = validateSchedule(schedule, now)
  assert.equal(Date.parse(valid.endsAt) - Date.parse(valid.startsAt), 45 * 60_000)
  for (const change of [{ startsAt: 'invalid' }, { startsAt: new Date(now - 1000).toISOString() }, { duration: 1 }, { timezone: 'Not/AZone' }, { title: '' }]) {
    assert.throws(() => validateSchedule({ ...schedule, ...change }, now))
  }
  assert.equal(bookingId('alice', 'a-request'), bookingId('alice', 'a-request'))
  assert.notEqual(bookingId('bob', 'a-request'), bookingId('alice', 'a-request'))
})

test('only code-verified unexpired custom sessions can manage bookings', () => {
  const identity = { firebase: { sign_in_provider: 'custom' }, email_otp: true, email_verified: true, otp_verified_at: Math.floor(now / 1000) }
  assert.doesNotThrow(() => requireVerifiedSession(identity, now))
  for (const change of [{ firebase: { sign_in_provider: 'google.com' } }, { email_otp: false }, { otp_verified_at: Math.floor(now / 1000) - 43201 }]) {
    assert.throws(() => requireVerifiedSession({ ...identity, ...change }, now))
  }
})

test('rescheduled, cancelled, completed, already reminded, and last-minute bookings do not send stale reminders', () => {
  const booking = { status: 'confirmed', meetingLink: 'https://meet.google.com/test', startsAt: new Date(now + 30 * 60_000).toISOString(), confirmedAt: new Date(now - 2 * 60 * 60_000).toISOString(), syncPending: false, revision: 2, reminderSentRevision: 1 }
  assert.ok(reminderDue(booking, now))
  for (const change of [{ status: 'pending' }, { status: 'cancelled' }, { status: 'completed' }, { syncPending: true }, { reminderSentRevision: 2 }, { confirmedAt: new Date(now).toISOString() }]) {
    assert.equal(reminderDue({ ...booking, ...change }, now), false)
  }
  assert.equal(publicBooking({ ...booking, status: 'pending' }).meetingLink, null)
})

test('calendar refresh credentials are encrypted and bound to their owner', () => {
  const cipher = tokenCipher('a-private-server-secret-with-more-than-32-characters')
  const encrypted = cipher.encrypt('private-google-refresh-token', 'alice')
  assert.ok(!encrypted.includes('private-google-refresh-token'))
  assert.equal(cipher.decrypt(encrypted, 'alice'), 'private-google-refresh-token')
  assert.throws(() => cipher.decrypt(encrypted, 'bob'))
  assert.throws(() => cipher.decrypt(encrypted.slice(0, -1) + '!', 'alice'))
})

test('a scheduler cannot run without its configured secret', async () => {
  assert.equal(secretMatches(undefined, undefined), false)
  assert.equal(secretMatches('Bearer wrong', 'Bearer ' + 'x'.repeat(40)), false)
  assert.equal(secretMatches('Bearer ' + 'x'.repeat(40), 'Bearer ' + 'x'.repeat(40)), true)
  const previous = process.env.SESSION_CRON_SECRET
  delete process.env.SESSION_CRON_SECRET
  try {
    const handler = createBookingHttp(() => { throw new Error('The worker must not execute') }, 'sessions')
    const response = { setHeader() {}, status(code) { this.code = code; return this }, json(value) { this.value = value } }
    await handler({ method: 'GET', query: { action: 'reminders' }, headers: {} }, response)
    assert.equal(response.code, 401)
  } finally {
    if (previous === undefined) delete process.env.SESSION_CRON_SECRET
    else process.env.SESSION_CRON_SECRET = previous
  }
})
