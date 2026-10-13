import type { Achievement } from '../../types/domain'

export const achievementsFor = (swaps: number, lessons: number, rating: number): Achievement[] => [
  { id: 'first-swap', name: 'First Swap', description: 'Complete your first exchange', icon: '⇄', unlocked: swaps >= 1 },
  { id: 'ten-swaps', name: '10 Swaps', description: 'Complete ten exchanges', icon: '10', unlocked: swaps >= 10 },
  { id: 'mentor', name: 'Skill Mentor', description: 'Complete five lessons', icon: '☆', unlocked: lessons >= 5 },
  { id: 'helper', name: 'Community Helper', description: 'Share knowledge consistently', icon: '✓', unlocked: swaps + lessons >= 15 },
  { id: 'five-star', name: '5-Star Teacher', description: 'Maintain a 4.9 rating', icon: '★', unlocked: rating >= 4.9 },
  { id: 'paid', name: 'First Paid Lesson', description: 'Complete a paid lesson', icon: '€', unlocked: lessons >= 1 },
]

export const levelProgress = (xp: number) => ({ current: xp % 500, required: 500, percent: (xp % 500) / 5 })
