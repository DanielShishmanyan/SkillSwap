import { ArrowRight, ArrowRightLeft, BookOpen, MapPin, MessageCircle, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MatchResult, UserProfile } from '../../types/domain'
import { Avatar } from '../ui/Avatar'
import './UserCard.css'

export function UserCard({ user, match, onSwap, onBook, onMessage }: {
  user: UserProfile
  match?: MatchResult
  onSwap?: () => void
  onBook?: () => void
  onMessage?: () => void
}) {
  const prices = user.teaches.flatMap(skill => skill.hourlyPrice !== undefined ? [skill.hourlyPrice] : [])
  const minPrice = prices.length ? Math.min(...prices) : undefined
  const mutual = match?.kind === 'mutual'
  const profileUrl = `/users/${user.id}`
  return (
    <article className="discovery-person">
      <div className="discovery-person-heading">
        <Avatar src={user.avatar} name={user.name} size="md" />
        <div className="discovery-person-identity">
          <h2><Link to={profileUrl}>{user.name}</Link></h2>
          <p><MapPin size={12} />{user.location}</p>
        </div>
        {onMessage && <button type="button" className="discovery-message" onClick={onMessage} aria-label={`Message ${user.name}`} title="Send a message"><MessageCircle size={18} /></button>}
      </div>

      <div className="discovery-person-meta">
        <span className="discovery-rating"><Star size={13} />{user.ratingCount > 0 ? <>{user.ratingAverage.toFixed(1)} <span>({user.ratingCount})</span></> : 'New here'}</span>
        {match ? <span className={`discovery-match ${mutual ? 'discovery-match-mutual' : ''}`}>{match.score}% match</span> : user.availableNow && <span className="discovery-available">Available now</span>}
      </div>

      <div className="discovery-teaches">
        <p>Can share</p>
        <div>{user.teaches.slice(0, 3).map(skill => <span key={skill.id}>{skill.name}</span>)}
          {user.teaches.length > 3 && <Link to={profileUrl} aria-label={`View ${user.teaches.length - 3} more skills from ${user.name}`}>+{user.teaches.length - 3}</Link>}
          {!user.teaches.length && <span>Still exploring</span>}
        </div>
      </div>
      <p className="discovery-learns"><span>Curious about </span>{user.learns.length ? user.learns.slice(0, 2).map(skill => skill.name).join(' & ') : 'something new'}{user.learns.length > 2 ? ` +${user.learns.length - 2} more` : ''}</p>

      <div className="discovery-person-footer">
        <p className={mutual ? 'discovery-exchange' : 'discovery-price'}>{mutual
          ? <><ArrowRightLeft size={14} /><span>{match.offeredSkill} ↔ {match.receivedSkill}</span></>
          : minPrice !== undefined ? <>Lessons from <strong>€{minPrice}/hr</strong></> : 'A new perspective awaits.'}</p>
        <div className="discovery-person-actions">
          <Link to={profileUrl} className="discovery-profile-link">View profile<ArrowRight size={15} /></Link>
          {(mutual ? onSwap : onBook) && <button type="button" onClick={mutual ? onSwap : onBook}>{mutual ? <><ArrowRightLeft size={14} />Swap skills</> : <><BookOpen size={14} />Book lesson</>}</button>}
        </div>
      </div>
    </article>
  )
}
