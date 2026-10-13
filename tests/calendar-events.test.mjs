import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/calendar/calendar-events.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { getCalendarEvents, getUnscheduledSwaps } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const lesson = { id: 'same-id', teacherId: 'partner', studentId: 'me', date: '2026-10-15T12:00:00Z', skillName: 'Piano', duration: 60, lessonStatus: 'confirmed', deliveryMode: 'online', totalPrice: 30 }
const session = { id: 'same-id', teacherId: 'me', learnerId: 'partner', scheduledAt: '2026-10-15T09:00:00Z', skillName: 'React', durationMinutes: 45, deliveryMode: 'online', status: 'scheduled' }
const swap = { id: 'swap-1', requesterId: 'me', receiverId: 'partner', status: 'active', sessions: [session] }

test('combines lessons and swap sessions chronologically with distinct IDs and correct roles', () => {
  const events = getCalendarEvents([lesson], [swap], 'me')
  assert.deepEqual(events.map(event => event.kind), ['swap', 'lesson'])
  assert.equal(new Set(events.map(event => event.id)).size, 2)
  assert.equal(events[0].teaching, true)
  assert.equal(events[0].duration, 45)
  assert.equal(events[0].partnerId, 'partner')
  assert.equal(events[0].swapId, 'swap-1')
  assert.equal(events[1].teaching, false)
  assert.equal(events[1].price, 30)
  assert.equal(getCalendarEvents([], [swap], 'partner')[0].teaching, false)
})

test('excludes unrelated people, cancelled lessons and inactive parent swaps', () => {
  assert.deepEqual(getCalendarEvents([lesson], [swap], 'stranger'), [])
  assert.deepEqual(getCalendarEvents([{ ...lesson, lessonStatus: 'cancelled' }], [], 'me'), [])
  for (const status of ['cancelled', 'declined', 'pending']) {
    assert.deepEqual(getCalendarEvents([], [{ ...swap, status }], 'me'), [])
  }
  assert.deepEqual(getCalendarEvents([], [{ ...swap, sessions: [{ ...session, teacherId: 'a', learnerId: 'b' }] }], 'me'), [])
})

test('ignores cancelled, unscheduled, missing-date and invalid-date sessions', () => {
  for (const update of [{ status: 'cancelled' }, { status: 'unscheduled' }, { scheduledAt: undefined }, { scheduledAt: 'invalid' }]) {
    assert.deepEqual(getCalendarEvents([], [{ ...swap, sessions: [{ ...session, ...update }] }], 'me'), [])
  }
  assert.deepEqual(getCalendarEvents([{ ...lesson, date: 'invalid' }], [], 'me'), [])
})

test('preserves completed sessions in calendar history', () => {
  const events = getCalendarEvents([{ ...lesson, lessonStatus: 'completed' }], [{ ...swap, status: 'completed', sessions: [{ ...session, status: 'completed' }] }], 'me')
  assert.equal(events.length, 2)
  assert.ok(events.every(event => event.status === 'completed'))
})

test('rescheduling replaces the displayed date, including timezone offsets', () => {
  const moved = { ...swap, sessions: [{ ...session, scheduledAt: '2026-11-01T00:30:00+02:00' }] }
  const events = getCalendarEvents([], [moved], 'me')
  assert.equal(events.length, 1)
  assert.equal(events[0].startsAt.toISOString(), '2026-10-31T22:30:00.000Z')
  assert.equal(swap.sessions[0].scheduledAt, '2026-10-15T09:00:00Z')
})

test('only accepted or active unscheduled exchanges appear in scheduling reminders', () => {
  const waiting = { ...swap, sessions: [{ ...session, status: 'unscheduled', scheduledAt: undefined }] }
  assert.equal(getUnscheduledSwaps([waiting], 'me').length, 1)
  assert.equal(getUnscheduledSwaps([{ ...waiting, status: 'accepted' }], 'partner').length, 1)
  assert.deepEqual(getUnscheduledSwaps([waiting], 'stranger'), [])
  assert.deepEqual(getUnscheduledSwaps([swap], 'me'), [])
  assert.deepEqual(getUnscheduledSwaps([{ ...waiting, status: 'cancelled' }], 'me'), [])
  assert.deepEqual(getUnscheduledSwaps([{ ...waiting, status: 'completed' }], 'me'), [])
})
