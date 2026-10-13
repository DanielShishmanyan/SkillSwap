import type { MatchResult, UserProfile } from '../../types/domain'

const overlap = (a: string[], b: string[]) => a.filter((value) => b.includes(value))

export function calculateMatch(current: UserProfile, candidate: UserProfile): MatchResult | null {
  const currentWants = current.learns.map((skill) => skill.id)
  const candidateTeaches = candidate.teaches.map((skill) => skill.id)
  const candidateWants = candidate.learns.map((skill) => skill.id)
  const currentTeaches = current.teaches.map((skill) => skill.id)
  const received = overlap(currentWants, candidateTeaches)
  if (!received.length) return null
  const offered = overlap(candidateWants, currentTeaches)
  const mutual = offered.length > 0
  const skillScore = mutual ? 50 : 25
  const locationScore = current.location === candidate.location || candidate.location === 'Online' ? 15 : 6
  const availabilityOverlap = overlap(current.availability.days, candidate.availability.days).length
  const availabilityScore = Math.min(15, availabilityOverlap * 5)
  const ratingScore = Math.round((candidate.ratingAverage / 5) * 10)
  const relevantSkill = candidate.teaches.find((skill) => skill.id === received[0])
  const proficiencyScore = relevantSkill ? relevantSkill.proficiency * 2 : 0
  const score = Math.min(100, skillScore + locationScore + availabilityScore + ratingScore + proficiencyScore)
  const reasons = [mutual ? 'You can teach each other' : `Teaches ${relevantSkill?.name}`, locationScore === 15 ? 'Location compatible' : 'Online friendly', `${availabilityOverlap} days overlap`]
  return { user: candidate, score, kind: mutual ? 'mutual' : 'lesson', reasons, offeredSkill: current.teaches.find((s) => s.id === offered[0])?.name, receivedSkill: relevantSkill?.name ?? '' }
}

export const rankMatches = (current: UserProfile, users: UserProfile[]) => users.filter((user) => user.id !== current.id).map((user) => calculateMatch(current, user)).filter((match): match is MatchResult => Boolean(match)).sort((a, b) => b.score - a.score)
