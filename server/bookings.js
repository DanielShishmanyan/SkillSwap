import { randomUUID } from 'node:crypto'
import { AuthError } from '../functions/src/auth-handlers.js'
import { nextRateLimit } from '../functions/src/otp.js'
import { bookingId, publicBooking, reminderDue, requireParticipant, validateSchedule } from './booking-policy.js'

const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)

export function createBookings({ db, adminAuth, google, mailer, now = Date.now }) {
  const reference = id => {
    if (!validId(id)) throw new AuthError('invalid-argument', 'Invalid session link.')
    return db.collection('sessionBookings').doc(id)
  }
  const job = (kind, id) => db.collection('sessionJobs').doc(`${kind}_${id}`)
  const queueSync = (transaction, booking) => transaction.set(job('sync', booking.id), { kind: 'sync', bookingId: booking.id, dueAt: now() })
  function queueReminder(transaction, booking) {
    const dueAt = Date.parse(booking.startsAt) - 60 * 60_000
    if (booking.status === 'confirmed' && Date.parse(booking.confirmedAt) <= dueAt && Date.parse(booking.startsAt) > now()) {
      transaction.set(job('reminder', booking.id), { kind: 'reminder', bookingId: booking.id, revision: booking.revision, dueAt: Math.max(dueAt, now()) })
    } else transaction.delete(job('reminder', booking.id))
  }
  async function read(id, uid) {
    const record = (await reference(id).get()).data()
    requireParticipant(record, uid)
    return record
  }
  async function acquire(id) {
    const lease = { id: randomUUID(), until: now() + 90_000 }
    return db.runTransaction(async transaction => {
      const ref = reference(id)
      const booking = (await transaction.get(ref)).data()
      if (!booking || booking.lease?.until > now()) return null
      transaction.update(ref, { lease })
      return { ...booking, lease }
    })
  }
  async function sync(id, kind = 'sync') {
    let booking = await acquire(id)
    if (!booking) return
    let syncError = null
    let pending = false
    try {
      if (kind === 'reminder') {
        if (reminderDue(booking, now())) {
          await mailer(booking, 'reminder')
          booking.reminderSentRevision = booking.revision
        } else if (booking.status === 'confirmed' && booking.syncPending && Date.parse(booking.startsAt) > now()) {
          pending = true
        }
      } else if (booking.syncPending && ['pending', 'confirmed', 'cancelled'].includes(booking.status)) {
        const expectedId = `ss${booking.id}r${booking.revision}`
        if (booking.calendarEventId && (booking.status !== 'confirmed' || booking.calendarEventId !== expectedId)) {
          await google.cancelMeeting(booking)
          booking = { ...booking, calendarEventId: null, meetingLink: null, calendarLink: null, calendarUid: null }
          await reference(id).update({ calendarEventId: null, meetingLink: null, calendarLink: null, calendarUid: null })
        }
        if (booking.status === 'confirmed') {
          const meeting = await google.createMeeting(booking)
          booking = { ...booking, ...meeting }
          await reference(id).update(meeting)
          pending = !booking.meetingLink
        }
        if (!pending && booking.notificationRevision !== booking.revision) {
          await mailer(booking, booking.status)
          booking.notificationRevision = booking.revision
        }
      }
    } catch (error) {
      pending = true
      syncError = error instanceof AuthError ? error.message : 'The calendar or email update is pending. Please try again.'
    }
    await db.runTransaction(async transaction => {
      const ref = reference(id)
      const current = (await transaction.get(ref)).data()
      if (!current || current.lease?.id !== booking.lease.id || current.revision !== booking.revision) return
      const update = { lease: null }
      if (kind === 'sync') Object.assign(update, { syncPending: pending, syncError, notificationRevision: booking.notificationRevision || 0 })
      else update.reminderSentRevision = booking.reminderSentRevision || 0
      transaction.update(ref, update)
      if (pending) transaction.set(job(kind, id), { kind, bookingId: id, revision: booking.revision, dueAt: now() + 5 * 60_000 })
      else transaction.delete(job(kind, id))
    })
  }
  return {
    google,
    async create(identity, input) {
      const schedule = validateSchedule(input, now())
      if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId)
          || typeof input.partnerEmail !== 'string' || input.partnerEmail.length > 254) {
        throw new AuthError('invalid-argument', 'Enter your lesson partner’s registered email address.')
      }
      const id = bookingId(identity.uid, input.requestId)
      const ref = reference(id)
      const existing = (await ref.get()).data()
      if (existing) {
        requireParticipant(existing, identity.uid)
        if (Object.entries(schedule).some(([key, value]) => existing[key] !== value)
            || !existing.participants.some(person => person.email.toLowerCase() === input.partnerEmail.trim().toLowerCase())) {
          throw new AuthError('failed-precondition', 'This proposal was already saved. Open it or start a new booking.')
        }
        return publicBooking(existing)
      }
      if (!(await google.status(identity.uid)).connected) throw new AuthError('failed-precondition', 'Connect Google Calendar before booking a lesson.')
      let partner
      try { partner = await adminAuth.getUserByEmail(input.partnerEmail.trim().toLowerCase()) }
      catch { throw new AuthError('invalid-argument', 'Ask your lesson partner to register with SkillSwap first, then use their registered email.') }
      if (partner.uid === identity.uid || partner.disabled || !partner.emailVerified) throw new AuthError('invalid-argument', 'Choose another registered member with a verified email.')
      const organizer = await adminAuth.getUser(identity.uid)
      if (!organizer.emailVerified || organizer.email !== identity.email) throw new AuthError('unauthenticated', 'Sign in again before creating a lesson.')
      const booking = {
        id, ...schedule, participantIds: [organizer.uid, partner.uid],
        participants: [organizer, partner].map(person => ({ id: person.uid, name: person.displayName || 'SkillSwap member', email: person.email })),
        calendarOwnerId: organizer.uid, status: 'pending', lastProposedBy: organizer.uid, revision: 1,
        calendarEventId: null, meetingLink: null, calendarLink: null, calendarUid: null,
        syncPending: true, syncError: null, notificationRevision: 0, reminderSentRevision: 0, lease: null,
        completionIds: [], attendanceReports: {}, createdAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString(),
      }
      await db.runTransaction(async transaction => {
        const budget = db.collection('sessionLimits').doc(identity.uid)
        const [previous, usage] = await transaction.getAll(ref, budget)
        if (previous.exists) return
        const next = nextRateLimit(usage.data(), 10, now(), 24 * 60 * 60_000)
        if (!next) throw new AuthError('resource-exhausted', 'You can propose up to 10 new lessons per day.')
        transaction.set(budget, next)
        transaction.create(ref, booking)
        queueSync(transaction, booking)
      })
      await sync(id)
      return publicBooking(await read(id, identity.uid))
    },
    async list(identity) {
      const snapshot = await db.collection('sessionBookings').where('participantIds', 'array-contains', identity.uid).get()
      return snapshot.docs.map(doc => publicBooking(doc.data())).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    },
    async get(identity, input) { return publicBooking(await read(input.id, identity.uid)) },
    async update(identity, input) {
      const ref = reference(input.id)
      await db.runTransaction(async transaction => {
        const booking = (await transaction.get(ref)).data()
        requireParticipant(booking, identity.uid)
        if (booking.lease?.until > now()) throw new AuthError('failed-precondition', 'A calendar update is in progress. Please try again in a moment.')
        if (input.revision !== booking.revision) throw new AuthError('failed-precondition', 'This session changed. Refresh it before continuing.')
        const changes = { updatedAt: new Date(now()).toISOString() }
        if (input.action === 'accept') {
          if (booking.status !== 'pending' || booking.lastProposedBy === identity.uid || Date.parse(booking.startsAt) <= now()) throw new AuthError('failed-precondition', 'This proposal is no longer waiting for your confirmation.')
          Object.assign(changes, { status: 'confirmed', confirmedAt: changes.updatedAt, syncPending: true, notificationRevision: 0 })
        } else if (input.action === 'reschedule') {
          if (!['pending', 'confirmed'].includes(booking.status) || Date.parse(booking.endsAt) <= now()) throw new AuthError('failed-precondition', 'This lesson can no longer be rescheduled.')
          Object.assign(changes, validateSchedule(input, now()), {
            status: 'pending', revision: booking.revision + 1, lastProposedBy: identity.uid,
            syncPending: true, syncError: null, reminderSentRevision: 0, completionIds: [], attendanceReports: {},
          })
        } else if (input.action === 'cancel') {
          if (!['pending', 'confirmed'].includes(booking.status)) throw new AuthError('failed-precondition', 'This lesson is already closed.')
          Object.assign(changes, { status: 'cancelled', revision: booking.revision + 1, syncPending: true, syncError: null })
        } else if (input.action === 'complete') {
          if (booking.status !== 'confirmed' || Date.parse(booking.endsAt) > now()) throw new AuthError('failed-precondition', 'Confirm completion after the lesson ends.')
          const completionIds = [...new Set([...booking.completionIds, identity.uid])]
          Object.assign(changes, { completionIds, status: completionIds.length === 2 ? 'completed' : 'confirmed' })
        } else if (input.action === 'report') {
          const explanation = typeof input.explanation === 'string' ? input.explanation.trim() : ''
          if (!['confirmed', 'completed'].includes(booking.status) || Date.parse(booking.endsAt) > now() || explanation.length < 10 || explanation.length > 1000) {
            throw new AuthError('invalid-argument', 'After the lesson ends, explain what happened in 10–1,000 characters.')
          }
          changes.attendanceReports = { ...booking.attendanceReports, [identity.uid]: { explanation, createdAt: changes.updatedAt } }
        } else if (input.action === 'retry') {
          if (!booking.syncPending) return
        } else throw new AuthError('invalid-argument', 'Unknown session action.')
        const next = { ...booking, ...changes }
        transaction.update(ref, changes)
        if (['accept', 'reschedule', 'cancel', 'retry'].includes(input.action)) {
          queueSync(transaction, next)
          queueReminder(transaction, next)
        }
      })
      if (['accept', 'reschedule', 'cancel', 'retry'].includes(input.action)) await sync(input.id)
      return publicBooking(await read(input.id, identity.uid))
    },
    async processJobs() {
      const due = await db.collection('sessionJobs').where('dueAt', '<=', now()).limit(3).get()
      await Promise.all(due.docs.map(async record => {
        const { bookingId: id, kind } = record.data()
        await sync(id, kind)
      }))
      return { processed: due.size }
    },
  }
}
