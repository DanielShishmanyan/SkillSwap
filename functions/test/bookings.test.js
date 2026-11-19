import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createBookings } from '../../server/bookings.js'
import { createGoogleCalendar } from '../../server/google-calendar.js'
import { createBookingMailer } from '../../server/booking-mail.js'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run booking integration tests in the Firestore emulator.')
const app = initializeApp({ projectId: 'demo-skillswap-auth' }, 'booking-integration')
const db = getFirestore(app)
after(() => deleteApp(app))

function fixture(options = {}) {
  let clock = Date.now()
  const alice = { uid: 'alice-' + randomUUID(), email: 'alice@example.com', emailVerified: true, displayName: 'Alice' }
  const bob = { uid: 'bob-' + randomUUID(), email: 'bob@example.com', emailVerified: true, displayName: 'Bob' }
  const identities = [alice, bob]
  const emails = []
  const meetings = []
  const cancellations = []
  const google = {
    status: async () => ({ connected: true }),
    createMeeting: async booking => {
      meetings.push(booking.id + ':' + booking.revision)
      return { calendarEventId: `ss${booking.id}r${booking.revision}`, meetingLink: 'https://meet.google.com/abc-defg-hij', calendarLink: 'https://calendar.google.com/event', calendarUid: booking.id + '@google.com' }
    },
    cancelMeeting: async booking => { cancellations.push(booking.calendarEventId) },
  }
  const adminAuth = {
    getUser: async uid => identities.find(person => person.uid === uid),
    getUserByEmail: async email => { const person = identities.find(person => person.email === email); if (!person) throw new Error('No such account'); return person },
  }
  const mailer = async (booking, type) => { emails.push({ id: booking.id, revision: booking.revision, type }) }
  const service = createBookings({ db, google, adminAuth, mailer, now: () => clock, ...options })
  const schedule = { requestId: randomUUID(), partnerEmail: bob.email, title: 'Photography basics', startsAt: new Date(clock + 3 * 60 * 60_000).toISOString(), duration: 45, timezone: 'Europe/Sofia', note: 'Bring a camera.' }
  return { service, alice: { uid: alice.uid, email: alice.email }, bob: { uid: bob.uid, email: bob.email }, schedule, emails, meetings, cancellations, advance: value => { clock += value } }
}

test('a booking is shared only with its participants and a duplicate submit creates one proposal', async () => {
  const f = fixture()
  const proposal = await f.service.create(f.alice, f.schedule)
  assert.equal(proposal.status, 'pending')
  assert.equal(proposal.meetingLink, null)
  assert.equal(f.meetings.length, 0)
  const retry = await f.service.create(f.alice, f.schedule)
  assert.equal(retry.id, proposal.id)
  assert.equal(f.emails.length, 1)
  assert.equal((await f.service.list(f.bob)).find(item => item.id === proposal.id)?.title, f.schedule.title)
  await assert.rejects(f.service.get({ uid: 'outsider' }, { id: proposal.id }))
  await assert.rejects(f.service.create(f.alice, { ...f.schedule, title: 'Changed after submit' }))
  await assert.rejects(f.service.update(f.alice, { id: proposal.id, revision: 1, action: 'accept' }))
})

test('concurrent acceptance creates one meeting, and rescheduling invalidates old reminders and requires new consent', async () => {
  const f = fixture()
  const proposal = await f.service.create(f.alice, f.schedule)
  const accepted = await Promise.allSettled([
    f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'accept' }),
    f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'accept' }),
  ])
  assert.equal(accepted.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.meetings.length, 1)
  assert.equal((await f.service.get(f.bob, { id: proposal.id })).meetingLink, 'https://meet.google.com/abc-defg-hij')
  f.advance(2 * 60 * 60_000 + 1000)
  await f.service.processJobs()
  assert.equal(f.emails.filter(email => email.type === 'reminder').length, 1)
  await f.service.processJobs()
  assert.equal(f.emails.filter(email => email.type === 'reminder').length, 1)
  const changed = await f.service.update(f.alice, { id: proposal.id, revision: 1, action: 'reschedule', ...f.schedule, startsAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString() })
  assert.equal(changed.status, 'pending')
  assert.equal(changed.revision, 2)
  assert.equal(changed.meetingLink, null)
  assert.equal(f.cancellations.length, 1)
  assert.equal((await db.collection('sessionJobs').doc('reminder_' + proposal.id).get()).exists, false)
  await assert.rejects(f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'accept' }))
  const confirmed = await f.service.update(f.bob, { id: proposal.id, revision: 2, action: 'accept' })
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(f.meetings.length, 2)
  const cancelled = await f.service.update(f.bob, { id: proposal.id, revision: 2, action: 'cancel' })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.meetingLink, null)
  assert.equal(f.cancellations.length, 2)
})

test('failed external updates stay queued and do not lose a confirmed session', async () => {
  let fail = true
  const f = fixture({ mailer: async () => { if (fail) throw new Error('Email transport unavailable') } })
  const proposal = await f.service.create(f.alice, f.schedule)
  assert.equal(proposal.syncPending, true)
  assert.ok(proposal.syncError)
  fail = false
  const retried = await f.service.update(f.alice, { id: proposal.id, revision: 1, action: 'retry' })
  assert.equal(retried.syncPending, false)
  assert.equal(retried.syncError, null)
})

test('both participants confirm completion and attendance reports do not automatically penalize anyone', async () => {
  const f = fixture()
  const proposal = await f.service.create(f.alice, f.schedule)
  await f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'accept' })
  await assert.rejects(f.service.update(f.alice, { id: proposal.id, revision: 1, action: 'complete' }))
  f.advance(4 * 60 * 60_000)
  const first = await f.service.update(f.alice, { id: proposal.id, revision: 1, action: 'complete' })
  assert.equal(first.status, 'confirmed')
  const reported = await f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'report', explanation: 'My partner did not join the meeting.' })
  assert.equal(reported.status, 'confirmed')
  assert.ok(reported.attendanceReports[f.bob.uid])
  const completed = await f.service.update(f.bob, { id: proposal.id, revision: 1, action: 'complete' })
  assert.equal(completed.status, 'completed')
})

test('Google OAuth binds one-time state to the browser and encrypts refresh credentials', async () => {
  const uid = 'oauth-' + randomUUID()
  const clientId = 'client-id'
  const requests = []
  const fetcher = async (url, options) => {
    requests.push({ url, options })
    if (url.includes('/token')) return new Response(JSON.stringify({ access_token: 'access-fixture', refresh_token: 'private-refresh-fixture', scope: 'openid email https://www.googleapis.com/auth/calendar.events.owned' }), { status: 200 })
    if (url.includes('/userinfo')) return new Response(JSON.stringify({ email: 'alice@example.com', email_verified: true }), { status: 200 })
    return new Response(JSON.stringify({ id: 'event', hangoutLink: 'https://meet.google.com/abc-defg-hij', htmlLink: 'https://calendar.google.com/event' }), { status: 200 })
  }
  const google = createGoogleCalendar({ db, clientId, clientSecret: 'private-client-secret', secret: 'a-private-encryption-secret-long-enough', fetcher })
  const start = await google.start(uid, 'alice@example.com')
  const state = new URL(start.url).searchParams.get('state')
  assert.equal(new URL(start.url).searchParams.get('code_challenge_method'), 'S256')
  await assert.rejects(google.callback({ state, code: 'fixture-code' }, 'wrong-cookie'))
  const result = await google.callback({ state, code: 'fixture-code' }, start.cookie)
  assert.ok(result.url.endsWith('/session/new?calendar=connected'))
  assert.equal((await google.status(uid)).connected, true)
  const stored = (await db.collection('calendarConnections').doc(uid).get()).data()
  assert.ok(!JSON.stringify(stored).includes('private-refresh-fixture'))
  await assert.rejects(google.callback({ state, code: 'fixture-code' }, start.cookie))
  const booking = { id: 'a'.repeat(32), revision: 2, calendarOwnerId: uid, participants: [{ email: 'alice@example.com' }, { email: 'bob@example.com' }], title: 'Photography', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 60_000).toISOString(), timezone: 'Europe/Sofia', note: '' }
  await google.createMeeting(booking)
  const sent = requests.find(item => item.url.includes('conferenceDataVersion'))
  const event = JSON.parse(sent.options.body)
  assert.equal(event.id, 'ss' + booking.id + 'r2')
  assert.ok(sent.url.includes('sendUpdates=all'))
  assert.equal(event.attendees.length, 2)
})

test('notification retries skip recipients already sent and use stable Resend idempotency keys', async () => {
  let calls = 0
  const mailer = createBookingMailer({
    db, secret: 'mail-budget-secret-longer-than-thirty-two-characters', apiKey: 'private-fixture', from: 'SkillSwap <test@example.com>',
    fetcher: async () => { calls++; return new Response('{}', { status: 200 }) },
  })
  const booking = { id: randomUUID().replaceAll('-', ''), revision: 1, title: 'Photography', startsAt: new Date(Date.now() + 3600_000).toISOString(), timezone: 'Europe/Sofia', duration: 45, note: '', participants: [{ id: 'alice', email: 'alice@example.com' }, { id: 'bob', email: 'bob@example.com' }] }
  await mailer(booking, 'confirmed')
  await mailer(booking, 'confirmed')
  assert.equal(calls, 2)
})
