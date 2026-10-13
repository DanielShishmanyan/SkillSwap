import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ArrowRight, ArrowRightLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { Avatar } from '../components/ui/Avatar'
import { getCalendarEvents, getUnscheduledSwaps, type CalendarEvent } from '../features/calendar/calendar-events'
import type { UserProfile } from '../types/domain'
import './CalendarPage.css'

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const { lessons, swaps, currentUser, users } = useAppStore()
  const events = useMemo(() => getCalendarEvents(lessons, swaps, currentUser.id), [lessons, swaps, currentUser.id])
  const unscheduled = useMemo(() => getUnscheduledSwaps(swaps, currentUser.id), [swaps, currentUser.id])
  const firstUpcoming = events.find(event => event.status !== 'completed' && event.startsAt >= new Date())
  const [month, setMonth] = useState(() => startOfMonth(firstUpcoming?.startsAt ?? new Date()))
  const [selectedDate, setSelectedDate] = useState(() => firstUpcoming?.startsAt ?? new Date())
  const monthDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const eventsByDay = useMemo(() => {
    const days = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = format(event.startsAt, 'yyyy-MM-dd')
      days.set(key, [...(days.get(key) ?? []), event])
    }
    return days
  }, [events])
  const selectedEvents = eventsByDay.get(format(selectedDate, 'yyyy-MM-dd')) ?? []
  const monthEvents = events.filter(event => isSameMonth(event.startsAt, month))
  const goToMonth = (next: Date) => { setMonth(startOfMonth(next)); setSelectedDate(startOfMonth(next)) }
  const selectDay = (day: Date) => { setSelectedDate(day); if (!isSameMonth(day, month)) setMonth(startOfMonth(day)) }
  const today = () => { const date = new Date(); setMonth(startOfMonth(date)); setSelectedDate(date) }

  return (
    <main className="calendar-page">
      <div className="calendar-backdrop" aria-hidden="true" />
      <div className="page-shell calendar-content">
        <header className="calendar-heading">
          <div><p className="calendar-eyebrow">MAKE A LITTLE TIME TO GROW</p><h1>A moment to share. <em>A moment to learn.</em></h1><p>Your swaps and lessons, together in one little plan.</p></div>
          <button type="button" className="calendar-today-button" onClick={today}>Back to today<CalendarDays size={16} /></button>
        </header>

        <div className="calendar-layout">
          <section className="calendar-month" aria-label="Monthly swaps and lessons calendar">
            <header className="calendar-month-heading">
              <div><h2 aria-live="polite">{format(month, 'MMMM yyyy')}</h2><p>{monthEvents.length} {monthEvents.length === 1 ? 'session' : 'sessions'} this month</p></div>
              <div><button type="button" onClick={() => goToMonth(subMonths(month, 1))} aria-label="Previous month"><ChevronLeft size={19} /></button><button type="button" onClick={() => goToMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={19} /></button></div>
            </header>
            <div className="calendar-weekdays">{weekDays.map(day => <span key={day}>{day}</span>)}</div>
            <div className="calendar-days">{monthDays.map(day => {
              const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? []
              const selected = isSameDay(day, selectedDate)
              const swapCount = dayEvents.filter(event => event.kind === 'swap').length
              const lessonCount = dayEvents.length - swapCount
              return <button key={format(day, 'yyyy-MM-dd')} type="button" onClick={() => selectDay(day)}
                className={`calendar-day${!isSameMonth(day, month) ? ' is-outside' : ''}${selected ? ' is-selected' : ''}`}
                aria-pressed={selected} aria-current={isToday(day) ? 'date' : undefined}
                aria-label={`${format(day, 'EEEE, MMMM d, yyyy')}, ${swapCount} swap sessions, ${lessonCount} lessons`}>
                <span className={`calendar-date${isToday(day) ? ' is-today' : ''}`}>{format(day, 'd')}</span>
                <div className="calendar-day-events">{dayEvents.slice(0, 2).map(event => <span key={event.id} className={`calendar-event calendar-event-${event.kind}`}>{format(event.startsAt, 'HH:mm')} {event.skillName}</span>)}{dayEvents.length > 2 && <small>+{dayEvents.length - 2} more</small>}</div>
                <span className="calendar-mobile-dots" aria-hidden="true">{swapCount > 0 && <i className="calendar-swap-dot" />}{lessonCount > 0 && <i className="calendar-lesson-dot" />}{dayEvents.length > 1 && <small>{dayEvents.length}</small>}</span>
              </button>
            })}</div>
            <div className="calendar-legend"><span><i className="calendar-swap-dot" />Skill swap</span><span><i className="calendar-lesson-dot" />Lesson</span><span>Times shown in your local time</span></div>
          </section>

          <aside className="calendar-agenda" aria-label="Selected day schedule">
            <div className="calendar-agenda-heading"><p>YOUR DAY, AT A GLANCE</p><h2>{format(selectedDate, 'EEEE, MMMM d')}</h2></div>
            {selectedEvents.length ? <div className="calendar-agenda-items">{selectedEvents.map(event => <AgendaItem key={event.id} event={event} partner={users.find(user => user.id === event.partnerId)} />)}</div>
              : <div className="calendar-free-day"><span><CalendarDays size={24} /></span><h3>A little room to grow.</h3><p>No swaps or lessons on this day. Choose a marked date to see what’s planned.</p><Link to="/matches">Find a connection<ArrowRight size={15} /></Link></div>}
          </aside>
        </div>

        {unscheduled.length > 0 && <section className="calendar-unscheduled" aria-labelledby="calendar-unscheduled-title">
          <div><h2 id="calendar-unscheduled-title">Ready to schedule</h2><p>Pick a time for these swaps and their sessions will appear in your calendar.</p></div>
          <div className="calendar-unscheduled-list">{unscheduled.map(swap => {
            const partner = users.find(user => user.id === (swap.requesterId === currentUser.id ? swap.receiverId : swap.requesterId))
            return <Link key={swap.id} to={`/swaps/${swap.id}`}><span className="calendar-unscheduled-icon"><ArrowRightLeft size={18} /></span><span><strong>{swap.requesterOffer.skillName} ↔ {swap.receiverOffer.skillName}</strong><small>With {partner?.name ?? 'your swap partner'}</small></span><span className="calendar-schedule-label">Schedule<ArrowRight size={15} /></span></Link>
          })}</div>
        </section>}
      </div>
    </main>
  )
}

function AgendaItem({ event, partner }: { event: CalendarEvent; partner?: UserProfile }) {
  const Icon = event.kind === 'swap' ? ArrowRightLeft : BookOpen
  return <article className={`calendar-agenda-item calendar-agenda-${event.kind}`}>
    <div className="calendar-agenda-type"><span><Icon size={13} />{event.kind === 'swap' ? 'Skill swap' : 'Lesson'}</span><span>{event.status}</span></div>
    <h3>{event.skillName}</h3>
    <p className="calendar-agenda-time"><Clock size={14} />{format(event.startsAt, 'HH:mm')} · {event.duration} min</p>
    <div className="calendar-agenda-partner">{partner && <Avatar src={partner.avatar} name={partner.name} size="sm" />}<p>{event.teaching ? 'Teaching' : 'Learning'} with<strong>{partner?.name ?? 'SkillSwap member'}</strong></p></div>
    <p className="calendar-agenda-location">{event.deliveryMode === 'online' ? <Video size={14} /> : <MapPin size={14} />}{event.kind === 'swap' && event.location ? event.location : event.deliveryMode === 'online' ? 'Online' : event.deliveryMode === 'in_person' ? 'In person' : 'Online or in person'}</p>
    <div className="calendar-agenda-footer">{event.kind === 'swap' ? <><span>Free exchange</span><Link to={`/swaps/${event.swapId}`}>Open swap<ArrowRight size={14} /></Link></> : <><span>{event.teaching ? 'You’re teaching' : 'You’re learning'}</span><strong>€{event.price.toFixed(2)}</strong></>}</div>
  </article>
}
