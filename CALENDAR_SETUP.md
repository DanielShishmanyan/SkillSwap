# Shared lessons and Google Meet

Authenticated members can propose a lesson from Calendar → Schedule a lesson, using another verified member's email. The invited member confirms the time; only then does SkillSwap create the organizer's Google Calendar event, invite both participants, and request a Google Meet room. Both participants can view the private `/session/{id}` page, propose another time, cancel, or confirm completion after the lesson. A changed time needs fresh confirmation. Attendance reports do not automatically change ratings.

Shared bookings are stored server-side in `sessionBookings`. The rest of the marketplace still uses the existing demo store; local swap slots can link to a shared booking, but completing a booking does not yet update demo swap statistics.

## Google configuration

1. Enable Google Calendar API in project `skillswap-ba92b`.
2. Create an OAuth **Web application** client with redirect URI `https://skill-swap-eight-delta.vercel.app/api/calendar/callback`.
3. Save `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` in Vercel **Production**. Store the secret as **Secret**; neither setting uses a `VITE_` prefix. Redeploy after saving.
4. If Google Auth Platform → Audience is in Testing, add the Google accounts used for testing. Public access to sensitive Calendar scopes can require Google's verification. Testing-mode Calendar grants can expire after seven days; reconnect when prompted.
5. Sign in to SkillSwap, open `/session/new`, and choose **Connect Google Calendar**. Use the Google account matching the SkillSwap email and grant Calendar access. Only the organizer needs this connection.

The server requests `calendar.events.owned` plus OpenID/email. Browser-bound, short-lived PKCE state protects the callback. Refresh tokens are encrypted with AES-GCM using a purpose-derived server key and denied to Firestore clients. Rotating the server encryption secret requires reconnecting calendars.

The existing Firebase service account and Resend settings from `AUTH_SETUP.md` are also required. A verified Resend sending domain is needed to email arbitrary lesson partners; the `onboarding@resend.dev` test sender is restricted to the Resend account owner's address.

## Background retries and one-hour reminders

**Reminders are not active until a scheduler is connected.** Immediate proposal/confirmation/cancellation updates run during the request. Failed updates and pending Meet creation are retained for retry.

Set a random `SESSION_CRON_SECRET` of at least 32 characters as a Vercel Production Secret, redeploy, and configure a private external scheduler to call every five minutes:

```text
GET https://skill-swap-eight-delta.vercel.app/api/sessions/reminders
Authorization: Bearer <SESSION_CRON_SECRET>
```

Use an authenticated HTTP header, never a secret in the URL. This avoids Vercel Hobby's daily-only cron restriction. Execution is best-effort: scheduler delays can delay delivery. Confirmation made less than an hour before a lesson does not send a redundant one-hour reminder. Rescheduling and cancellation invalidate the prior reminder. Google Calendar's organizer popup reminder is ten minutes; invitee alerts follow each person's Calendar settings.

Notifications use per-recipient idempotency, bounded retries, and the shared 100-attempt daily email budget. Session pages remain the source for current details if email delivery fails. Each worker run processes up to three due jobs with per-booking leases.

## Validation

```text
npm run lint
npm run build
node --no-experimental-require-module --test tests/auth-http.test.js tests/booking-policy.test.js functions/test/otp.test.js
firebase emulators:exec --project demo-skillswap-auth --only auth,firestore,storage "npm --prefix functions run test:rules"
```

The integration tests mock Google and Resend; a real Calendar consent and two verified users are still required for a live booking test.
