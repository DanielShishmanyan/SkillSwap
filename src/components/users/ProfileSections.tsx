import { Award, CalendarDays, Lock, MapPin, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { TeachableSkill, UserProfile } from '../../types/domain'
import { Avatar } from '../ui/Avatar'
import './ProfileSections.css'

export function ProfileHero({ user, own = false, actions }: { user: UserProfile; own?: boolean; actions: ReactNode }) {
  return <section className="profile-hero">
    <div className="profile-cover" aria-hidden="true"><span /><span /></div>
    <div className="profile-hero-body">
      <div className="profile-identity-row"><Avatar src={user.avatar} name={user.name} size="xl" className="profile-avatar" /><div className="profile-identity"><p className="profile-eyebrow">{own ? 'YOUR LITTLE CORNER OF SKILLSWAP' : 'SOMETHING TO SHARE. SOMETHING TO LEARN.'}</p><h1>{user.name}</h1><div className="profile-meta">{user.location && <span><MapPin size={14} />{user.location}</span>}<span><Star size={14} />{user.ratingCount ? `${user.ratingAverage.toFixed(1)} · ${user.ratingCount} reviews` : 'New to the community'}</span></div></div><div className="profile-hero-actions">{actions}</div></div>
      <div className="profile-stats"><span><strong>{user.completedSwaps}</strong> skill swaps</span><span><strong>{user.completedLessons}</strong> lessons</span><span className="profile-level">Level {user.level}</span></div>
    </div>
  </section>
}

export function ProfileSkills({ user, own = false, canBook, onBook }: { user: UserProfile; own?: boolean; canBook?: (skill: TeachableSkill) => boolean; onBook?: (skill: TeachableSkill) => void }) {
  return <section className="profile-section profile-skills">
    <div className="profile-section-heading"><div><p className="profile-eyebrow">KNOWLEDGE WORTH SHARING</p><h2>{own ? 'What I can teach' : 'What you can learn here'}</h2></div>{own && <Link to="/" className="profile-text-link">Edit skills</Link>}</div>
    <div className="profile-teaching-list">{user.teaches.map(skill => <article key={skill.id} className="profile-teaching-skill"><div><span className="profile-skill-category">{skill.category}</span><h3>{skill.name}</h3><p>Proficiency {skill.proficiency}/5 · {skill.deliveryMode === 'both' ? 'Online or in person' : skill.deliveryMode === 'online' ? 'Online' : 'In person'}{skill.yearsExperience ? ` · ${skill.yearsExperience} years` : ''}</p>{skill.description && <p className="profile-skill-description">{skill.description}</p>}</div><div className="profile-skill-action"><span>{skill.hourlyPrice !== undefined ? `€${skill.hourlyPrice}/hr` : 'Swap only'}</span>{onBook && canBook?.(skill) && <button type="button" className="profile-secondary" onClick={() => onBook(skill)}>Book lesson</button>}</div></article>)}{!user.teaches.length && <p className="profile-placeholder">{own ? 'Add a skill you’d enjoy sharing with someone.' : 'This member is still adding their teaching skills.'}</p>}</div>
    <div className="profile-learning"><h2>{own ? 'What I’d love to learn' : 'A little curiosity about…'}</h2><div>{user.learns.map(skill => <span key={skill.id}>{skill.name}</span>)}{!user.learns.length && <p className="profile-placeholder">{own ? 'Choose a new interest to start finding your people.' : 'New interests are on the way.'}</p>}</div></div>
  </section>
}

export function ProfileAvailability({ user }: { user: UserProfile }) {
  return <section className="profile-section profile-availability"><h2><CalendarDays size={17} />Time to connect</h2><div className="profile-days">{user.availability.days.map(day => <span key={day}>{day}</span>)}</div><p>{user.availability.time || 'Ask about a time that works for both of you.'}</p>{user.availability.timezone && <small>{user.availability.timezone.replaceAll('_', ' ')}</small>}<div className="profile-delivery">{user.teaches.some(skill => skill.deliveryMode !== 'in_person') ? 'Online sessions available' : user.teaches.length ? 'Meet in person' : 'Session format to be arranged'}</div></section>
}

export function ProfileAchievements({ user, own = false }: { user: UserProfile; own?: boolean }) {
  const unlocked = user.achievements.filter(achievement => achievement.unlocked)
  const locked = user.achievements.filter(achievement => !achievement.unlocked)
  return <section className="profile-section profile-achievements"><h2><Award size={18} />Little milestones</h2><div className="profile-achievement-list">{unlocked.map(achievement => <div key={achievement.id}><span className="profile-achievement-icon">{achievement.icon}</span><div><h3>{achievement.name}</h3><p>{achievement.description}</p></div></div>)}</div>{!unlocked.length && <p className="profile-placeholder">Every connection is a start. The first milestone is still ahead.</p>}{own && locked.length > 0 && <details><summary>Milestones to work toward · {locked.length}</summary><div className="profile-achievement-list">{locked.map(achievement => <div key={achievement.id}><Lock size={15} /><div><h3>{achievement.name}</h3><p>{achievement.description}</p></div></div>)}</div></details>}</section>
}
