import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarDays, Check, Clock, Copy, ExternalLink, RefreshCw, ShieldCheck, Video } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { bookingsService, downloadCalendarFile, type ScheduleInput } from '../features/calendar/bookings.service'
import { useAppStore } from '../app/app-store.context'
import { Button } from '../components/ui/Button'
import { isDemoAuthEnabled } from '../firebase/firebase.config'
import './SessionPage.css'
import { useCurrentTime } from '../features/calendar/use-current-time'

const localDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'

function ScheduleFields({ initial, busy, onSubmit, children }: {
  initial?: Partial<ScheduleInput>; busy: boolean; onSubmit: (input: ScheduleInput) => void; children?: React.ReactNode
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(() => localDateInput(initial?.startsAt ? new Date(initial.startsAt) : new Date(Date.now() + 24 * 60 * 60_000)))
  const now = useCurrentTime()
  const [duration, setDuration] = useState(initial?.duration || 45)
  const [note, setNote] = useState(initial?.note || '')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return <form className="session-form" onSubmit={event => { event.preventDefault(); onSubmit({ title, startsAt: new Date(date).toISOString(), duration, timezone, note }) }}>
    <label><span className="label">What will you work on?</span><input className="field" required minLength={2} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Photography basics" /></label>
    {children}
    <div className="session-form-row"><label><span className="label">Date and time</span><input className="field" type="datetime-local" required min={localDateInput(new Date(now + 10 * 60_000))} value={date} onChange={event => setDate(event.target.value)} /><small>Shown in {timezone.replace(/_/g, ' ')}</small></label><label><span className="label">Duration</span><select className="field" value={duration} onChange={event => setDuration(Number(event.target.value))}>{[30, 45, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label></div>
    <label><span className="label">A note for your partner <span className="font-normal text-muted">(optional)</span></span><textarea className="field session-note" maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="What would you like to cover? Anything to prepare?" /></label>
    <Button type="submit" className="session-primary" loading={busy} disabled={busy}>{initial?.startsAt ? 'Propose a new time' : 'Send lesson proposal'}<ArrowRight size={17} /></Button>
  </form>
}

export function NewSessionPage() {
  const { user } = useAuth()
  const { linkSessionBooking } = useAppStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [partnerEmail, setPartnerEmail] = useState(params.get('email') || '')
  const [requestId] = useState(() => crypto.randomUUID())
  const queryClient = useQueryClient()
  const connection = useQuery({ queryKey: ['calendar-connection', user?.id], queryFn: bookingsService.calendarStatus, enabled: Boolean(user) && !isDemoAuthEnabled })
  const connect = useMutation({ mutationFn: bookingsService.connectCalendar, onSuccess: result => { window.location.href = result.url } })
  const create = useMutation({
    mutationFn: (input: ScheduleInput) => bookingsService.create({ ...input, partnerEmail, requestId }),
    onSuccess: booking => {
      const swapId = params.get('swap')
      const swapSessionId = params.get('slot')
      if (swapId && swapSessionId) linkSessionBooking(swapId, swapSessionId, booking.id)
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      navigate('/session/' + booking.id)
    },
  })
  const connected = connection.data?.connected
  return <main className="session-page page-shell">
    <Link className="session-back" to="/calendar"><ArrowLeft size={16} />Back to calendar</Link>
    <header className="session-heading"><p className="eyebrow">MAKE TIME TO LEARN</p><h1>A lesson worth showing up for.</h1><p>Choose a time together. We’ll create the Google Meet link once you both confirm.</p></header>
    <div className="session-layout"><section className="session-card">
      <div className="session-connection"><span><CalendarCheck size={23} /></span><div><h2>{connected ? 'Google Calendar connected' : 'Connect your calendar'}</h2><p>{connected ? connection.data?.email : 'Create a Meet room and send calendar invitations from your Google account.'}</p></div>{connected && <Check size={18} className="text-brand-700" />}</div>
      {params.get('calendar') === 'failed' && <p className="session-error" role="alert">The calendar connection could not be completed. Use the Google account with your SkillSwap email and allow Calendar access.</p>}
      {params.get('calendar') === 'cancelled' && <p className="session-notice">The calendar connection was cancelled. You can try again when you’re ready.</p>}
      {connection.isPending && !isDemoAuthEnabled && <p className="session-notice">Checking your calendar connection…</p>}
      {connection.error && <p className="session-error" role="alert">{message(connection.error)}</p>}
      {isDemoAuthEnabled && <p className="session-notice">Online bookings require a verified SkillSwap account.</p>}
      {connection.data && !connection.data.configured && <p className="session-notice">Automatic Google Meet booking is being set up. Please check back when the calendar connection is available.</p>}
      {!connected && connection.data?.configured && <Button className="mt-5" loading={connect.isPending} disabled={connect.isPending} onClick={() => connect.mutate()}>Connect Google Calendar<ExternalLink size={16} /></Button>}
      {connect.error && <p className="session-error" role="alert">{message(connect.error)}</p>}
      {connected && <><div className="session-card-divider" /><ScheduleFields busy={create.isPending} initial={{ title: params.get('title') || '', duration: Number(params.get('duration')) || 45 }} onSubmit={input => create.mutate(input)}>
        <label><span className="label">Your lesson partner’s email</span><input className="field" type="email" required maxLength={254} value={partnerEmail} onChange={event => setPartnerEmail(event.target.value)} placeholder="Their registered SkillSwap email" /></label>
      </ScheduleFields></>}
      {create.error && <p className="session-error" role="alert">{message(create.error)}</p>}
    </section><aside className="session-guide"><span className="session-guide-icon"><Video size={25} /></span><h2>One plan. Both of you.</h2><p>Your partner gets a proposal to accept or reschedule. Once confirmed, you both get a calendar invitation and a shared SkillSwap session page.</p><div><Clock size={17} /><p>Times are shown in your local time.</p></div><div><CalendarDays size={17} /><p>Add the invitation to your calendar for notifications.</p></div><div><ShieldCheck size={17} /><p>The session page is available only to the two participants.</p></div></aside></div>
  </main>
}

export function SessionPage() {
  const now = useCurrentTime()
  const { sessionId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [copied, setCopied] = useState(false)
  const booking = useQuery({ queryKey: ['booking', sessionId, user?.id], queryFn: () => bookingsService.get(sessionId), enabled: Boolean(user), refetchInterval: 15_000 })
  const update = useMutation({
    mutationFn: (input: { action: string; explanation?: string } & Partial<ScheduleInput>) => {
      if (!booking.data) throw new Error('The session is still loading.')
      return bookingsService.update({ id: sessionId, revision: booking.data.revision, ...input })
    },
    onSuccess: result => { queryClient.setQueryData(['booking', sessionId, user?.id], result); void queryClient.invalidateQueries({ queryKey: ['bookings'] }); setEditing(false); setReporting(false) },
    onError: () => { void booking.refetch() },
  })
  if (booking.isPending) return <main className="session-page page-shell"><p className="session-notice">Opening your session…</p></main>
  if (!booking.data || booking.error) return <main className="session-page page-shell"><Link className="session-back" to="/calendar"><ArrowLeft size={16} />Back to calendar</Link><h1 className="text-2xl font-bold">We couldn’t open this session.</h1><p className="session-error" role="alert">{message(booking.error)}</p><Button onClick={() => void booking.refetch()} variant="secondary">Try again</Button></main>
  const item = booking.data
  const partner = item.participants.find(person => person.id !== user?.id)
  const start = new Date(item.startsAt)
  const ended = now >= Date.parse(item.endsAt)
  const canRespond = item.status === 'pending' && item.lastProposedBy !== user?.id && now < start.getTime()
  const canChange = ['pending', 'confirmed'].includes(item.status) && !ended
  const completedByMe = item.completionIds.includes(user?.id || '')
  return <main className="session-page page-shell">
    <Link className="session-back" to="/calendar"><ArrowLeft size={16} />Back to calendar</Link>
    <header className="session-heading"><p className="eyebrow">YOUR TIME TO CONNECT</p><h1>{item.title}</h1><p>With {partner?.name} · {partner?.email}</p></header>
    <div className="session-layout"><section className="session-card">
      <span className={`session-status session-status-${item.status}`}>{item.status === 'pending' ? 'Waiting for confirmation' : item.status}</span>
      <h2 className="session-date">{start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <p className="session-time"><Clock size={17} />{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(item.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.duration} min</p>
      <p className="session-timezone">{Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}</p>
      {item.note && <p className="session-message">{item.note}</p>}
      {item.status === 'pending' && <p className="session-notice">{canRespond ? 'Does this time work for you? Confirm it to create your meeting.' : 'Your partner needs to confirm this time before the meeting is created.'}</p>}
      {item.syncError && <p className="session-error" role="alert">{item.syncError}</p>}
      {item.status === 'confirmed' && !item.meetingLink && !item.syncError && <p className="session-notice">Preparing your Google Meet link and calendar invitation…</p>}
      <div className="session-actions">
        {canRespond && <Button loading={update.isPending} disabled={update.isPending} onClick={() => update.mutate({ action: 'accept' })}><Check size={17} />Confirm this time</Button>}
        {item.status === 'confirmed' && item.meetingLink && !ended && <a className="session-join" href={item.meetingLink} target="_blank" rel="noreferrer"><Video size={19} />Join lesson<ExternalLink size={15} /></a>}
        {canChange && <Button variant="secondary" disabled={update.isPending} onClick={() => { setEditing(!editing); setReporting(false) }}><RefreshCw size={15} />{editing ? 'Keep this time' : 'Propose another time'}</Button>}
        {item.syncPending && item.syncError && <Button variant="secondary" disabled={update.isPending} onClick={() => update.mutate({ action: 'retry' })}>Retry calendar and email update</Button>}
      </div>
      {item.status === 'confirmed' && <div className="session-calendar-links">{item.calendarLink && <a href={item.calendarLink} target="_blank" rel="noreferrer">Open in Google Calendar<ExternalLink size={13} /></a>}<button type="button" onClick={() => downloadCalendarFile(item)}>Download calendar invitation</button></div>}
      {editing && <div className="session-card-divider"><ScheduleFields initial={item} busy={update.isPending} onSubmit={input => update.mutate({ action: 'reschedule', ...input })} /></div>}
      {ended && item.status === 'confirmed' && <div className="session-card-divider"><h3>How did your lesson go?</h3><p className="session-notice">{completedByMe ? 'You confirmed completion. Waiting for your partner.' : 'Both participants confirm when the lesson is complete.'}</p><Button disabled={update.isPending || completedByMe} onClick={() => update.mutate({ action: 'complete' })}><Check size={16} />{completedByMe ? 'Completion confirmed' : 'Confirm lesson completed'}</Button><button type="button" className="session-text-button" onClick={() => setReporting(!reporting)}>Report a missed lesson</button></div>}
      {reporting && <form className="session-form" onSubmit={event => { event.preventDefault(); update.mutate({ action: 'report', explanation }) }}><label><span className="label">What happened?</span><textarea required minLength={10} maxLength={1000} className="field session-note" value={explanation} onChange={event => setExplanation(event.target.value)} /></label><p className="session-notice">Your partner can read and respond to this report. Reports do not automatically change ratings.</p><Button disabled={update.isPending} type="submit">Save report</Button></form>}
      {Object.entries(item.attendanceReports).map(([uid, report]) => <div className="session-message" key={uid}><strong>{item.participants.find(person => person.id === uid)?.name}</strong><p>{report.explanation}</p></div>)}
      {update.error && <p className="session-error" role="alert">{message(update.error)}</p>}
      {canChange && <button type="button" className="session-cancel" disabled={update.isPending} onClick={() => { if (window.confirm('Cancel this lesson for both participants?')) update.mutate({ action: 'cancel' }) }}>Cancel lesson</button>}
    </section><aside className="session-guide"><span className="session-guide-icon"><CalendarCheck size={25} /></span><h2>Your lesson, in one place.</h2><p>Use this page to check the latest time, join the meeting, or suggest a change. A new time needs confirmation from your partner.</p><button className="session-copy" type="button" onClick={() => { void navigator.clipboard.writeText(window.location.origin + '/session/' + item.id).then(() => setCopied(true)).catch(() => setCopied(false)) }}><Copy size={15} />{copied ? 'Session link copied' : 'Copy session link'}</button><p className="session-small">Only the two participants can open this session page. Calendar alerts follow each person’s notification settings.</p></aside></div>
  </main>
}
