import { ArrowRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useBookings } from '../../features/calendar/bookings.service'
import { useCurrentTime } from '../../features/calendar/use-current-time'

export function UpcomingSession() {
  const { data = [] } = useBookings()
  const now = useCurrentTime()
  const next = data.find(booking => ['pending', 'confirmed'].includes(booking.status) && Date.parse(booking.endsAt) > now)
  if (!next) return null
  return <div className="page-shell"><Link to={`/session/${next.id}`} className="session-next">
    <CalendarDays size={22} /><span><small>{next.status === 'pending' ? 'A lesson is waiting for confirmation' : 'Your next lesson'}</small><strong>{next.title}</strong><span>{new Date(next.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></span><ArrowRight size={19} />
  </Link></div>
}
