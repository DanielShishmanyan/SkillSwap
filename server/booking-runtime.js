import { getAuthRuntime } from './auth-runtime.js'
import { createGoogleCalendar } from './google-calendar.js'
import { createBookingMailer } from './booking-mail.js'
import { createBookings } from './bookings.js'

let runtime
export function getBookingRuntime() {
  if (runtime) return runtime
  const { db, adminAuth, encryptionSecret } = getAuthRuntime()
  const google = createGoogleCalendar({
    db, secret: encryptionSecret,
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID, clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  })
  const mailer = createBookingMailer({ db, secret: encryptionSecret, apiKey: process.env.RESEND_API_KEY, from: process.env.AUTH_EMAIL_FROM })
  runtime = { adminAuth, google, bookings: createBookings({ db, adminAuth, google, mailer }) }
  return runtime
}
