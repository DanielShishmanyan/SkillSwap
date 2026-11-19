import { createHash } from 'node:crypto'
import { AuthError } from '../functions/src/auth-handlers.js'
import { digest, nextRateLimit } from '../functions/src/otp.js'
import { sessionUrl } from './booking-policy.js'

export function createBookingMailer({ db, secret, apiKey, from, fetcher = fetch }) {
  return async (booking, type) => {
    const headings = { pending: 'Confirm your SkillSwap lesson', confirmed: 'Your SkillSwap lesson is booked', cancelled: 'Your SkillSwap lesson was cancelled', reminder: 'Your SkillSwap lesson is coming up' }
    for (const person of booking.participants) {
      const key = `session-${booking.id}-${booking.revision}-${type}-${person.id}`
      const ref = db.collection('sessionEmails').doc(createHash('sha256').update(key).digest('hex'))
      const send = await db.runTransaction(async transaction => {
        const budgetRef = db.collection('authRateLimits').doc(digest(secret, 'email:daily-budget'))
        const [delivery, budget] = await transaction.getAll(ref, budgetRef)
        const previous = delivery.data()
        if (previous?.sent) return false
        // Resend deduplicates for 24 hours. Never retry an uncertain delivery beyond that window.
        if (previous && (Date.now() - previous.firstAttemptAt > 23 * 60 * 60_000 || previous.attempts >= 6)) {
          throw new AuthError('unavailable', 'An email could not be delivered. Check the session page for the latest details.')
        }
        const next = nextRateLimit(budget.data(), 100, Date.now(), 24 * 60 * 60_000)
        if (!next) throw new AuthError('resource-exhausted', 'The daily email limit has been reached.')
        transaction.set(budgetRef, { ...next, deleteAfter: new Date(next.resetAt) })
        transaction.set(ref, { sent: false, firstAttemptAt: previous?.firstAttemptAt || Date.now(), attempts: (previous?.attempts || 0) + 1 })
        return true
      })
      if (!send) continue
      const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: booking.timezone }).format(new Date(booking.startsAt))
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({
          from, to: [person.email], subject: headings[type],
          text: `${headings[type]}\n\n${booking.title}\n${date} (${booking.timezone})\n${booking.duration} minutes\n\n${type === 'pending' ? 'Both participants must confirm this time before the meeting is created.\n\n' : ''}View the session, join, or reschedule:\n${sessionUrl(booking.id)}\n\n${booking.note || ''}`,
        }),
      })
      if (!response.ok) throw new AuthError('unavailable', 'The session was saved, but an email could not be delivered.')
      await ref.update({ sent: true, sentAt: new Date().toISOString() })
    }
  }
}
