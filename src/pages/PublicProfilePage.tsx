import { ArrowLeft, ArrowRightLeft, MessageCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { BookingModal } from '../components/transactions/BookingModal'
import { SwapModal } from '../components/transactions/SwapModal'
import { ProfileAchievements, ProfileAvailability, ProfileHero, ProfileSkills } from '../components/users/ProfileSections'
import { findCompatibleSkillPairs } from '../features/swaps/swaps.utils'
import type { TeachableSkill } from '../types/domain'

export function PublicProfilePage() {
  const { id } = useParams()
  const { users, currentUser, openConversation } = useAppStore()
  const navigate = useNavigate()
  const user = users.find(profile => profile.id === id)
  const [swap, setSwap] = useState(false)
  const [book, setBook] = useState<TeachableSkill>()
  if (id === currentUser.id) return <Navigate to="/profile" replace />
  if (!user) return <main className="profile-page"><div className="page-shell profile-content"><section className="profile-section"><h1 className="text-2xl font-semibold">This profile isn’t available.</h1><Link to="/discover" className="profile-text-link">Back to discover</Link></section></div></main>
  const pairs = findCompatibleSkillPairs(currentUser, user)
  return <>
    <main className="profile-page"><div className="profile-backdrop" aria-hidden="true" /><div className="page-shell profile-content">
      <Link to="/discover" className="profile-back"><ArrowLeft size={15} />Back to discover</Link>
      <ProfileHero user={user} actions={<>{pairs.length > 0 && <button type="button" className="profile-primary" onClick={() => setSwap(true)}><ArrowRightLeft size={16} />Propose a swap</button>}<button type="button" className="profile-secondary" onClick={() => navigate(`/messages?conversation=${openConversation(user.id)}`)}><MessageCircle size={16} />Say hello</button></>} />
      <div className="profile-layout">
        <div className="profile-main">
          <section className="profile-section profile-about"><p className="profile-eyebrow">MEET YOUR NEXT CONNECTION</p><h2>A little about {user.name.split(' ')[0]}</h2><p className="profile-bio">{user.bio || 'A new member with something to share. Start a conversation to get to know them.'}</p></section>
          <ProfileSkills user={user} canBook={skill => skill.hourlyPrice !== undefined && currentUser.learns.some(wanted => wanted.id === skill.id)} onBook={setBook} />
        </div>
        <aside className="profile-sidebar">
          {pairs.length > 0 && <section className="profile-section profile-connection"><h2><Sparkles size={17} />You can teach each other</h2><p>Something you know, for something you’d love to learn.</p><div className="profile-pair"><div><span>You share</span><strong>{pairs[0].requesterSkill.name}</strong></div><ArrowRightLeft size={17} /><div><span>You learn</span><strong>{pairs[0].receiverSkill.name}</strong></div></div>{pairs.length > 1 && <details><summary>{pairs.length - 1} more ways to swap</summary><ul>{pairs.slice(1).map(pair => <li key={`${pair.requesterSkill.id}-${pair.receiverSkill.id}`}>{pair.requesterSkill.name} ↔ {pair.receiverSkill.name}</li>)}</ul></details>}<p className="profile-connection-note">Free mutual exchange. Choose your skills and session details when you propose a swap.</p></section>}
          <ProfileAvailability user={user} />
          <ProfileAchievements user={user} />
        </aside>
      </div>
    </div></main>
    <SwapModal user={user} open={swap} onClose={() => setSwap(false)} />
    <BookingModal user={user} skill={book} open={Boolean(book)} onClose={() => setBook(undefined)} />
  </>
}
