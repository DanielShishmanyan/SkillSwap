import { createContext, useContext } from 'react'
import type { Conversation, LearningSkill, Lesson, Swap, SwapOffer, SwapSession, TeachableSkill, UserProfile } from '../types/domain'

export interface AppStoreValue {
  currentUser: UserProfile
  users: UserProfile[]
  swaps: Swap[]
  lessons: Lesson[]
  conversations: Conversation[]
  updateProfile: (update: Partial<UserProfile>) => void
  updateSkills: (teaches: TeachableSkill[], learns: LearningSkill[]) => void
  createSwap: (swap: { receiverId: string; requesterOffer: SwapOffer; receiverOffer: SwapOffer; deliveryMode: Swap['deliveryMode']; preferredStartDate?: string; preferredEndDate?: string; requesterMessage?: string }) => void
  counterSwap: (id: string, update: Partial<Pick<Swap, 'requesterOffer' | 'receiverOffer' | 'deliveryMode' | 'preferredStartDate' | 'preferredEndDate' | 'requesterMessage'>>) => void
  acceptSwap: (id: string) => void
  updateSwap: (id: string, status: Swap['status']) => void
  scheduleSession: (swapId: string, sessionId: string, update: Pick<SwapSession, 'scheduledAt' | 'deliveryMode' | 'meetingLink' | 'location'>) => void
  completeSession: (swapId: string, sessionId: string) => void
  linkSessionBooking: (swapId: string, sessionId: string, bookingId: string) => void
  createLesson: (lesson: Omit<Lesson, 'id'>) => void
  openConversation: (participantId: string, context?: string) => string
  sendMessage: (conversationId: string, text: string) => void
}

export const AppStoreContext = createContext<AppStoreValue | null>(null)

export function useAppStore() {
  const value = useContext(AppStoreContext)
  if (!value) throw new Error('useAppStore must be used within AppStoreProvider')
  return value
}
