import { ArrowRight, ArrowRightLeft, CheckCircle2, Clock3, Inbox, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { Avatar } from '../components/ui/Avatar'
import { calculateSwapBalance, swapProgress } from '../features/swaps/swaps.utils'
import type { Swap, SwapStatus, UserProfile } from '../types/domain'
import './SwapsPage.css'

const tabs: { label: string; statuses: SwapStatus[]; empty: string }[] = [
  { label: 'Requests', statuses: ['pending', 'accepted'], empty: 'New proposals and counter offers will appear here.' },
  { label: 'Active', statuses: ['active'], empty: 'Once an exchange gets going, you can follow its progress here.' },
  { label: 'Completed', statuses: ['completed'], empty: 'Your finished exchanges will have a home here.' },
  { label: 'Cancelled', statuses: ['cancelled', 'declined'], empty: 'Cancelled and declined exchanges will appear here.' },
]

export function SwapsPage() {
  const { swaps, users, currentUser, openConversation } = useAppStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Requests')
  const current = tabs.find(item => item.label === tab)!
  const ownSwaps = swaps.filter(swap => swap.requesterId === currentUser.id || swap.receiverId === currentUser.id)
  const visible = ownSwaps.filter(swap => current.statuses.includes(swap.status))

  return (
    <main className="swaps-page">
      <div className="swaps-backdrop" aria-hidden="true" />
      <div className="page-shell swaps-content">
        <header className="swaps-heading">
          <p className="swaps-eyebrow">A LITTLE GIVE. A LITTLE GROW.</p>
          <h1>Your skills, shared. <em>Your progress, together.</em></h1>
          <p>Keep your exchanges moving, from the first hello to the last lesson.</p>
        </header>
        <div className="swaps-toolbar">
          <div className="swaps-tabs" role="group" aria-label="Filter swaps by status">
            {tabs.map(item => <button key={item.label} type="button" aria-pressed={tab === item.label} onClick={() => setTab(item.label)}>
              {item.label}<span>{ownSwaps.filter(swap => item.statuses.includes(swap.status)).length}</span>
            </button>)}
          </div>
          <Link to="/matches" className="swaps-find">Find a new swap<ArrowRight size={15} /></Link>
        </div>
        <p className="swaps-result-count" role="status">{visible.length} {visible.length === 1 ? 'exchange' : 'exchanges'} · {tab}</p>
        {visible.length ? <div className="swaps-grid">
          {visible.map(swap => {
            const partnerId = swap.requesterId === currentUser.id ? swap.receiverId : swap.requesterId
            return <SwapOverviewCard key={swap.id} swap={swap} currentUserId={currentUser.id}
              partner={users.find(user => user.id === partnerId)}
              onMessage={() => navigate(`/messages?conversation=${openConversation(partnerId)}`)} />
          })}
        </div> : <section className="swaps-empty">
          <span>{tab === 'Requests' ? <Inbox size={25} /> : <ArrowRightLeft size={25} />}</span>
          <h2>No {tab.toLowerCase()} swaps yet</h2>
          <p>{current.empty}</p>
          <Link to="/matches" className="swap-primary">Explore your matches<ArrowRight size={16} /></Link>
        </section>}
      </div>
    </main>
  )
}

function SwapOverviewCard({ swap, currentUserId, partner, onMessage }: {
  swap: Swap
  currentUserId: string
  partner?: UserProfile
  onMessage: () => void
}) {
  const requester = swap.requesterId === currentUserId
  const needsResponse = swap.lastProposedBy !== currentUserId && swap.status === 'pending'
  const balance = calculateSwapBalance(swap.requesterOffer, swap.receiverOffer)
  const progress = swapProgress(swap)
  const ownOffer = requester ? swap.requesterOffer : swap.receiverOffer
  const receivedOffer = requester ? swap.receiverOffer : swap.requesterOffer
  const ownProgress = requester ? progress.requester : progress.receiver
  const learnProgress = requester ? progress.receiver : progress.requester
  const isOngoing = ['accepted', 'active', 'completed'].includes(swap.status)
  const next = isOngoing && swap.status !== 'completed' ? swap.sessions
    .filter(session => session.status === 'scheduled' && session.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0] : undefined
  const statusLabel = swap.status === 'pending' ? needsResponse ? 'Your turn to respond' : 'Awaiting reply'
    : swap.status === 'accepted' ? 'Ready to schedule' : swap.status.charAt(0).toUpperCase() + swap.status.slice(1)

  return (
    <article className="swap-card">
      <div className="swap-card-heading">
        {partner ? <Avatar src={partner.avatar} name={partner.name} /> : <span className="swap-avatar-fallback"><ArrowRightLeft size={20} /></span>}
        <div className="swap-partner"><h2>{partner ? <Link to={`/users/${partner.id}`}>{partner.name}</Link> : 'SkillSwap member'}</h2><p>Mutual skill exchange · Free</p></div>
        <button type="button" className="swap-message" onClick={onMessage} aria-label={`Message ${partner?.name ?? 'your swap partner'}`} title="Send a message"><MessageCircle size={18} /></button>
      </div>
      <div className="swap-status-row"><span className={`swap-status swap-status-${needsResponse ? 'respond' : swap.status}`}>{statusLabel}</span>{swap.proposalVersion > 1 && <span>Counter offer · v{swap.proposalVersion}</span>}</div>
      <div className="swap-exchange">
        <div className="swap-skill"><span>You share</span><h3>{ownOffer.skillName}</h3><p>{ownOffer.sessionsCount} × {ownOffer.minutesPerSession} min</p>{isOngoing && <small>{ownProgress.completed} / {ownProgress.total} completed</small>}</div>
        <ArrowRightLeft size={19} className="swap-exchange-arrow" aria-hidden="true" />
        <div className="swap-skill swap-skill-learn"><span>You learn</span><h3>{receivedOffer.skillName}</h3><p>{receivedOffer.sessionsCount} × {receivedOffer.minutesPerSession} min</p>{isOngoing && <small>{learnProgress.completed} / {learnProgress.total} completed</small>}</div>
      </div>

      <div className="swap-update">
        {swap.status === 'pending' ? <p className={balance.balanced ? 'swap-balanced' : 'swap-uneven'}>{balance.balanced ? <><CheckCircle2 size={14} />Equal time, shared learning</> : <><Clock3 size={14} />{balance.difference} min difference in commitments</>}</p>
          : isOngoing ? <>
            <div className="swap-progress-label"><span>{swap.status === 'completed' ? 'Exchange complete' : 'Your progress together'}</span><strong>{progress.completed} / {progress.total} sessions</strong></div>
            <progress className="swap-progress" max={progress.total || 1} value={progress.completed} aria-label={`Completed sessions with ${partner?.name ?? 'your partner'}`} />
            {next && <p className="swap-scheduled"><Clock3 size={13} /><span>{next.skillName} · {new Date(next.scheduledAt!).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>}
          </> : <p>This exchange has ended. You can still view its details.</p>}
      </div>
      <div className="swap-card-footer">
        <Link to={`/swaps/${swap.id}`} className="swap-primary">{swap.status === 'pending' ? needsResponse ? 'Review proposal' : 'View proposal' : isOngoing && swap.status !== 'completed' ? 'Open swap' : 'View exchange'}<ArrowRight size={15} /></Link>
        <span>{needsResponse ? 'A connection is waiting' : swap.status === 'completed' ? 'Something learned, together' : 'One exchange at a time'}</span>
      </div>
    </article>
  )
}
