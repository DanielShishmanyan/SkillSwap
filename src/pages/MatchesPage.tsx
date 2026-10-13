import { ArrowRight, ArrowRightLeft, MapPin, MessageCircle, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { SwapModal } from '../components/transactions/SwapModal'
import { Avatar } from '../components/ui/Avatar'
import { rankMatches } from '../features/matches/matching.algorithm'
import type { UserProfile } from '../types/domain'
import './MatchesPage.css'

export function MatchesPage() {
  const { currentUser, users, openConversation } = useAppStore()
  const navigate = useNavigate()
  const matches = useMemo(() => rankMatches(currentUser, users), [currentUser, users])
  const [selected, setSelected] = useState<UserProfile>()
  const [visibleCount, setVisibleCount] = useState(8)
  const mutualCount = matches.filter(match => match.kind === 'mutual').length

  return (
    <>
      <main className="matches-page">
        <div className="matches-backdrop" aria-hidden="true" />
        <div className="page-shell matches-content">
          <header className="matches-heading">
            <p className="matches-eyebrow">A LITTLE IN COMMON. A LOT TO DISCOVER.</p>
            <h1>Your know-how. <em>Their next chapter.</em></h1>
            <p>People who share your curiosity, with something new to teach you.</p>
          </header>

          {matches.length > 0 ? <>
            <div className="matches-summary">
              <p><Sparkles size={15} /><strong>{matches.length}</strong> {matches.length === 1 ? 'connection' : 'connections'} for you <span>· {mutualCount} mutual {mutualCount === 1 ? 'swap' : 'swaps'}</span></p>
              <span>Best matches first</span>
            </div>
            <div className="matches-grid">
              {matches.slice(0, visibleCount).map(match => {
                const mutual = match.kind === 'mutual'
                return (
                  <article className="match-person" key={match.user.id}>
                    <div className="match-person-heading">
                      <Avatar src={match.user.avatar} name={match.user.name} />
                      <div className="match-person-identity">
                        <h2><Link to={`/users/${match.user.id}`}>{match.user.name}</Link></h2>
                        <p><span><MapPin size={12} />{match.user.location}</span><span><Star size={12} />{match.user.ratingCount > 0 ? match.user.ratingAverage.toFixed(1) : 'New here'}</span></p>
                      </div>
                      <button type="button" className="match-message" aria-label={`Message ${match.user.name}`} title="Send a message" onClick={() => navigate(`/messages?conversation=${openConversation(match.user.id)}`)}><MessageCircle size={18} /></button>
                    </div>

                    <div className="match-type-row"><span className={mutual ? 'match-kind' : 'match-kind match-kind-lesson'}>{mutual ? 'Learn from each other' : 'A lesson for you'}</span><span className="match-score">{match.score}% match</span></div>
                    {mutual ? <div className="match-exchange">
                      <div className="match-skill"><span>You share</span><strong>{match.offeredSkill}</strong></div>
                      <ArrowRightLeft size={19} className="match-exchange-arrow" aria-hidden="true" />
                      <div className="match-skill match-skill-learn"><span>You learn</span><strong>{match.receivedSkill}</strong></div>
                    </div> : <div className="match-lesson"><span>Explore a paid lesson in</span><strong>{match.receivedSkill}</strong></div>}

                    <details className="match-reasons">
                      <summary>Why this match?</summary>
                      <ul>{match.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                    </details>

                    <div className="match-actions">
                      {mutual ? <>
                        <button type="button" className="match-primary" onClick={() => setSelected(match.user)}>Propose a swap<ArrowRightLeft size={15} /></button>
                        <Link to={`/users/${match.user.id}`} className="match-profile">View profile<ArrowRight size={15} /></Link>
                      </> : <>
                        <Link to={`/users/${match.user.id}`} className="match-primary">Explore lessons<ArrowRight size={15} /></Link>
                        <span className="match-lesson-note">Learn at your own pace</span>
                      </>}
                    </div>
                  </article>
                )
              })}
            </div>
            {matches.length > visibleCount && <div className="matches-more"><button type="button" onClick={() => setVisibleCount(count => count + 8)}>Discover more matches<ArrowRight size={16} /></button><p>Showing {Math.min(visibleCount, matches.length)} of {matches.length}</p></div>}
          </> : <section className="matches-empty">
            <span><Sparkles size={25} /></span>
            <h2>Your next connection starts with a skill.</h2>
            <p>Add what you can teach and what you’d love to learn. We’ll look for people who complement you.</p>
            <Link to="/" className="match-primary">Choose your skills<ArrowRight size={16} /></Link>
            <Link to="/discover" className="match-profile">Explore the community</Link>
          </section>}
        </div>
      </main>
      <SwapModal user={selected} open={Boolean(selected)} onClose={() => setSelected(undefined)} />
    </>
  )
}
