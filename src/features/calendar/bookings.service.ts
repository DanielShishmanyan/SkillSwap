import { useQuery } from '@tanstack/react-query'
import { auth, isDemoAuthEnabled } from '../../firebase/firebase.config'
import { useAuth } from '../auth/AuthProvider'

export interface LessonBooking {
  id: string
  title: string
  startsAt: string
  endsAt: string
  duration: number
  timezone: string
  note: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  revision: number
  lastProposedBy: string
  participantIds: string[]
  participants: { id: string; name: string; email: string }[]
  meetingLink: string | null
  calendarLink: string | null
  calendarUid: string | null
  syncPending: boolean
  syncError: string | null
  completionIds: string[]
  attendanceReports: Record<string, { explanation: string; createdAt: string }>
}
export interface ScheduleInput { title: string; startsAt: string; duration: number; timezone: string; note: string }
export interface CalendarConnection { configured: boolean; connected: boolean; email: string | null }

async function api<T>(area: 'sessions' | 'calendar', action: string, body: object = {}): Promise<T> {
  if (!auth?.currentUser) throw new Error('Sign in to manage your sessions.')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch(`/api/${area}/${action}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result || !('data' in result)) throw new Error(result?.error?.message || 'The session could not be updated. Please try again.')
  return result.data as T
}

export const bookingsService = {
  list: () => api<LessonBooking[]>('sessions', 'list'),
  get: (id: string) => api<LessonBooking>('sessions', 'get', { id }),
  create: (input: ScheduleInput & { requestId: string; partnerEmail: string }) => api<LessonBooking>('sessions', 'create', input),
  update: (input: { id: string; revision: number; action: string } & Partial<ScheduleInput> & { explanation?: string }) => api<LessonBooking>('sessions', 'update', input),
  calendarStatus: () => api<CalendarConnection>('calendar', 'status'),
  connectCalendar: () => api<{ url: string }>('calendar', 'connect'),
}

export function useBookings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['bookings', user?.id], queryFn: bookingsService.list,
    enabled: Boolean(user) && !isDemoAuthEnabled, refetchInterval: 30_000,
  })
}

export function downloadCalendarFile(booking: LessonBooking) {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const date = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SkillSwap//Lessons//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${escape(booking.calendarUid || booking.id + '@skillswap')}`, `SEQUENCE:${booking.revision}`,
    `DTSTAMP:${date(new Date().toISOString())}`, `DTSTART:${date(booking.startsAt)}`, `DTEND:${date(booking.endsAt)}`,
    `SUMMARY:${escape('SkillSwap · ' + booking.title)}`,
    `DESCRIPTION:${escape(window.location.origin + '/session/' + booking.id)}`,
    `URL:${window.location.origin}/session/${booking.id}`,
    'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Your SkillSwap lesson starts soon.',
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'skillswap-lesson.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
