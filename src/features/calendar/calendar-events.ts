import type { DeliveryMode, Lesson, Swap } from '../../types/domain'
import type { LessonBooking } from './bookings.service'

interface CalendarEventBase {
  id: string
  startsAt: Date
  skillName: string
  duration: number
  partnerId: string
  teaching: boolean
  status: string
  deliveryMode: DeliveryMode
  partnerName?: string
}

export type CalendarEvent = CalendarEventBase & (
  | { kind: 'lesson'; price: number }
  | { kind: 'swap'; swapId: string; location?: string }
  | { kind: 'booking'; bookingId: string }
)

export function getCalendarEvents(lessons: Lesson[], swaps: Swap[], userId: string, bookings: LessonBooking[] = []): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const lesson of lessons) {
    if (lesson.lessonStatus === 'cancelled' || (lesson.teacherId !== userId && lesson.studentId !== userId)) continue
    const startsAt = new Date(lesson.date)
    if (!Number.isFinite(startsAt.getTime())) continue
    const teaching = lesson.teacherId === userId
    events.push({ id: `lesson:${lesson.id}`, kind: 'lesson', startsAt, skillName: lesson.skillName,
      duration: lesson.duration, partnerId: teaching ? lesson.studentId : lesson.teacherId, teaching,
      status: lesson.lessonStatus, deliveryMode: lesson.deliveryMode, price: lesson.totalPrice })
  }
  for (const swap of swaps) {
    if (!['accepted', 'active', 'completed'].includes(swap.status) || (swap.requesterId !== userId && swap.receiverId !== userId)) continue
    for (const session of swap.sessions) {
      if (session.bookingId) continue
      if (!['scheduled', 'completed'].includes(session.status) || !session.scheduledAt || (session.teacherId !== userId && session.learnerId !== userId)) continue
      const startsAt = new Date(session.scheduledAt)
      if (!Number.isFinite(startsAt.getTime())) continue
      const teaching = session.teacherId === userId
      events.push({ id: `swap:${swap.id}:${session.id}`, kind: 'swap', swapId: swap.id, startsAt,
        skillName: session.skillName, duration: session.durationMinutes,
        partnerId: teaching ? session.learnerId : session.teacherId, teaching, status: session.status,
        deliveryMode: session.deliveryMode, location: session.location })
    }
  }
  for (const booking of bookings) {
    if (booking.status === 'cancelled' || !booking.participantIds.includes(userId)) continue
    const startsAt = new Date(booking.startsAt)
    if (!Number.isFinite(startsAt.getTime())) continue
    const partner = booking.participants.find(person => person.id !== userId)
    events.push({
      id: 'booking:' + booking.id, kind: 'booking', bookingId: booking.id, startsAt,
      skillName: booking.title, duration: booking.duration, partnerId: partner?.id || '',
      partnerName: partner?.name, teaching: false, status: booking.status, deliveryMode: 'online',
    })
  }
  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export function getUnscheduledSwaps(swaps: Swap[], userId: string) {
  return swaps.filter(swap => ['accepted', 'active'].includes(swap.status)
    && (swap.requesterId === userId || swap.receiverId === userId)
    && swap.sessions.some(session => session.status === 'unscheduled' && !session.bookingId
      && (session.teacherId === userId || session.learnerId === userId)))
}
