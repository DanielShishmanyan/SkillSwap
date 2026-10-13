import type { Swap, SwapOffer, SwapSession, UserProfile } from '../../types/domain'

export interface CompatibleSkillPair { requesterSkill: UserProfile['teaches'][number]; receiverSkill: UserProfile['teaches'][number] }

export function findCompatibleSkillPairs(requester: UserProfile, receiver: UserProfile): CompatibleSkillPair[] {
  const requesterSkills = requester.teaches.filter((skill) => receiver.learns.some((wanted) => wanted.id === skill.id))
  const receiverSkills = receiver.teaches.filter((skill) => requester.learns.some((wanted) => wanted.id === skill.id))
  return requesterSkills.flatMap((requesterSkill) => receiverSkills.map((receiverSkill) => ({ requesterSkill, receiverSkill })))
}

export function calculateSwapBalance(requesterOffer: SwapOffer, receiverOffer: SwapOffer) {
  const requesterMinutes = requesterOffer.sessionsCount * requesterOffer.minutesPerSession
  const receiverMinutes = receiverOffer.sessionsCount * receiverOffer.minutesPerSession
  const difference = Math.abs(requesterMinutes - receiverMinutes)
  return { requesterMinutes, receiverMinutes, difference, balanced: difference <= 30 }
}

export function createSwapSessions(swap: Pick<Swap, 'id' | 'requesterId' | 'receiverId' | 'requesterOffer' | 'receiverOffer' | 'deliveryMode'>): SwapSession[] {
  const createdAt = new Date().toISOString()
  const generate = (offer: SwapOffer, teacherId: string, learnerId: string) => Array.from({ length: offer.sessionsCount }, (_, index): SwapSession => ({ id: crypto.randomUUID(), swapId: swap.id, teacherId, learnerId, skillId: offer.skillId, skillName: offer.skillName, sessionNumber: index + 1, durationMinutes: offer.minutesPerSession, deliveryMode: swap.deliveryMode, status: 'unscheduled', createdAt }))
  return [...generate(swap.requesterOffer, swap.requesterId, swap.receiverId), ...generate(swap.receiverOffer, swap.receiverId, swap.requesterId)]
}

export function swapProgress(swap: Swap) {
  const requesterSessions = swap.sessions.filter((session) => session.teacherId === swap.requesterId)
  const receiverSessions = swap.sessions.filter((session) => session.teacherId === swap.receiverId)
  return { total: swap.sessions.length, completed: swap.sessions.filter((session) => session.status === 'completed').length, requester: { total: requesterSessions.length, completed: requesterSessions.filter((session) => session.status === 'completed').length }, receiver: { total: receiverSessions.length, completed: receiverSessions.filter((session) => session.status === 'completed').length } }
}
