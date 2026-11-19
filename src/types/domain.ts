export type DeliveryMode = 'online' | 'in_person' | 'both'
export type SkillCategory = 'Programming' | 'Design' | 'Languages' | 'Music' | 'Business' | 'Marketing' | 'Photography' | 'Fitness' | 'Lifestyle' | 'Creative'

export interface Skill { id: string; name: string; category: SkillCategory }
export interface TeachableSkill extends Skill { proficiency: 1 | 2 | 3 | 4 | 5; hourlyPrice?: number; deliveryMode: DeliveryMode; yearsExperience?: number; description?: string }
export interface LearningSkill extends Skill { desiredLevel?: 1 | 2 | 3 | 4 | 5 }
export interface Availability { days: string[]; time: string; timezone: string }
export interface Achievement { id: string; name: string; description: string; icon: string; unlocked: boolean }
export interface UserProfile {
  id: string; name: string; email: string; avatar: string; bio: string; location: string; availability: Availability;
  ratingAverage: number; ratingCount: number; completedSwaps: number; completedLessons: number; xp: number; level: number;
  teaches: TeachableSkill[]; learns: LearningSkill[]; achievements: Achievement[]; availableNow?: boolean;
}
export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'active' | 'completed' | 'cancelled'
export interface SwapOffer { skillId: string; skillName: string; sessionsCount: number; minutesPerSession: 30 | 45 | 60 | 90 | 120 }
export type SwapSessionStatus = 'unscheduled' | 'scheduled' | 'completed' | 'cancelled'
export interface SwapSession { id: string; swapId: string; teacherId: string; learnerId: string; skillId: string; skillName: string; sessionNumber: number; scheduledAt?: string; durationMinutes: number; deliveryMode: DeliveryMode; meetingLink?: string; location?: string; bookingId?: string; status: SwapSessionStatus; completedAt?: string; createdAt: string }
export interface SwapActivity { id: string; actorId: string; type: 'proposed' | 'countered' | 'accepted' | 'scheduled' | 'session_completed' | 'completed' | 'declined'; message: string; createdAt: string }
export interface Swap {
  id: string; requesterId: string; receiverId: string; requesterOffer: SwapOffer; receiverOffer: SwapOffer;
  deliveryMode: DeliveryMode; preferredStartDate?: string; preferredEndDate?: string; requesterMessage?: string;
  status: SwapStatus; lastProposedBy: string; proposalVersion: number; createdAt: string; updatedAt: string;
  acceptedAt?: string; completedAt?: string; sessions: SwapSession[]; activity: SwapActivity[];
}
export type LessonStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded'
export interface Lesson { id: string; teacherId: string; studentId: string; skillId: string; skillName: string; date: string; duration: number; hourlyRate: number; totalPrice: number; deliveryMode: DeliveryMode; paymentStatus: PaymentStatus; lessonStatus: LessonStatus }
export interface Message { id: string; senderId: string; text: string; createdAt: string; read: boolean }
export interface Conversation { id: string; participantIds: string[]; context: string; messages: Message[] }
export interface MatchResult { user: UserProfile; score: number; kind: 'mutual' | 'lesson'; reasons: string[]; offeredSkill?: string; receivedSkill: string }
