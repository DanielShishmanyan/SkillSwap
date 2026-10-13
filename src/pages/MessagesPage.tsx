import { ArrowLeft, ArrowUpRight, MessageCircle, Search, Send, UserRound } from 'lucide-react'
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { Avatar } from '../components/ui/Avatar'
import type { Conversation, UserProfile } from '../types/domain'
import './MessagesPage.css'

const messageTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const dayKey = (date: string) => new Date(date).toDateString()
const dayLabel = (date: string) => {
  const value = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (value.toDateString() === today.toDateString()) return 'Today'
  if (value.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return value.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MessagesPage() {
  const { conversations, users, currentUser, sendMessage } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const ordered = useMemo(() => [...conversations].sort((a, b) =>
    (Date.parse(b.messages.at(-1)?.createdAt ?? '') || 0) - (Date.parse(a.messages.at(-1)?.createdAt ?? '') || 0)), [conversations])
  const requested = ordered.find(conversation => conversation.id === searchParams.get('conversation'))
  const active = requested ?? ordered[0]
  const partnerFor = (conversation: Conversation) => users.find(user => user.id !== currentUser.id && conversation.participantIds.includes(user.id))
  const visible = ordered.filter(conversation => ((partnerFor(conversation)?.name ?? 'SkillSwap member') + ' ' + conversation.context).toLowerCase().includes(query.trim().toLowerCase()))
  const selectConversation = (id?: string) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('conversation', id)
    else next.delete('conversation')
    setSearchParams(next, { replace: true })
  }

  return (
    <main className="messages-page">
      <div className="messages-backdrop" aria-hidden="true" />
      <div className="page-shell messages-content">
        <header className="messages-heading"><p className="messages-eyebrow">GOOD THINGS START WITH HELLO</p><h1>A conversation today. <em>A new skill tomorrow.</em></h1><p>A little space to connect, make plans, and keep learning together.</p></header>
        <div className={`messages-workspace${requested ? ' has-mobile-chat' : ''}`}>
          <aside className="messages-inbox" aria-label="Conversations">
            <div className="messages-inbox-heading"><h2>Your conversations<span>{conversations.length}</span></h2><div className="messages-search"><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search conversations" placeholder="Find a person or skill" /></div></div>
            <div className="messages-thread-list">{visible.map(conversation => {
              const partner = partnerFor(conversation)
              const last = conversation.messages.at(-1)
              const unread = conversation.messages.some(message => !message.read && message.senderId !== currentUser.id)
              return <button key={conversation.id} type="button" className={`messages-thread${active?.id === conversation.id ? ' is-active' : ''}`} onClick={() => selectConversation(conversation.id)} aria-pressed={active?.id === conversation.id}>
                <PersonAvatar partner={partner} />
                <span className="messages-thread-copy"><span className="messages-thread-top"><strong>{partner?.name ?? 'SkillSwap member'}</strong>{last && <time dateTime={last.createdAt}>{dayKey(last.createdAt) === new Date().toDateString() ? messageTime(last.createdAt) : new Date(last.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time>}</span>
                  <span className="messages-thread-preview">{last ? `${last.senderId === currentUser.id ? 'You: ' : ''}${last.text}` : 'Start a conversation'}</span>
                  {conversation.context !== 'Direct message' && <span className="messages-thread-context">{conversation.context}</span>}
                </span>{unread && <span className="messages-unread"><span className="sr-only">Unread messages</span></span>}
              </button>
            })}
              {!visible.length && <div className="messages-list-empty"><MessageCircle size={23} /><h3>{query.trim() ? 'No conversations found' : 'Your next connection awaits'}</h3><p>{query.trim() ? 'Try another name or skill.' : 'Find someone you’d love to learn with and say hello.'}</p>{!query.trim() && <Link to="/discover">Explore the community<ArrowUpRight size={14} /></Link>}</div>}
            </div>
            <p className="messages-inbox-note">A little kindness goes a long way.</p>
          </aside>
          {active ? <ChatPanel key={active.id} conversation={active} partner={partnerFor(active)} currentUserId={currentUser.id} visibleOnMobile={Boolean(requested)}
            draft={drafts[active.id] ?? ''} onDraft={value => setDrafts(previous => ({ ...previous, [active.id]: value }))}
            onSend={text => sendMessage(active.id, text)} onBack={() => selectConversation()} />
            : <section className="messages-chat messages-welcome"><span><MessageCircle size={30} /></span><h2>Start with a simple hello.</h2><p>Your conversations and shared plans will live here.</p><Link to="/discover">Find your people<ArrowUpRight size={16} /></Link></section>}
        </div>
      </div>
    </main>
  )
}

function PersonAvatar({ partner }: { partner?: UserProfile }) {
  return partner ? <Avatar src={partner.avatar} name={partner.name} size="sm" /> : <span className="messages-avatar-fallback"><UserRound size={18} /></span>
}

function ChatPanel({ conversation, partner, currentUserId, visibleOnMobile, draft, onDraft, onSend, onBack }: {
  conversation: Conversation; partner?: UserProfile; currentUserId: string; visibleOnMobile: boolean; draft: string
  onDraft: (text: string) => void; onSend: (text: string) => void; onBack: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const followLatest = useRef(true)
  useLayoutEffect(() => {
    if (followLatest.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [conversation.messages.length, visibleOnMobile])
  const submit = () => {
    if (!draft.trim()) return
    followLatest.current = true
    onSend(draft.trim())
    onDraft('')
    composerRef.current?.focus()
  }
  return <section className="messages-chat" aria-label={`Conversation with ${partner?.name ?? 'SkillSwap member'}`}>
    <header className="messages-chat-heading"><button type="button" className="messages-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={20} /></button><PersonAvatar partner={partner} /><div><h2>{partner?.name ?? 'SkillSwap member'}</h2><p>{conversation.context === 'Direct message' ? 'A little knowledge, shared.' : conversation.context}</p></div>{partner && <Link to={`/users/${partner.id}`} className="messages-profile" aria-label={`View ${partner.name}'s profile`}><span>View profile</span><ArrowUpRight size={16} /></Link>}</header>
    <div ref={scrollRef} className="messages-history" role="log" aria-label="Message history" aria-live="polite" onScroll={event => {
      const element = event.currentTarget
      followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
    }}>
      {!conversation.messages.length && <div className="messages-chat-empty"><span><MessageCircle size={25} /></span><h3>A new connection starts here.</h3><p>Introduce yourself, share what you’d like to learn, or suggest a time to connect.</p></div>}
      {conversation.messages.map((message, index) => {
        const own = message.senderId === currentUserId
        const previous = conversation.messages[index - 1]
        return <Fragment key={message.id}>
          {(!previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)) && <div className="messages-date-divider"><span>{dayLabel(message.createdAt)}</span></div>}
          <div className={`messages-message${own ? ' is-own' : ''}`}><div className="messages-bubble">{message.text}</div><time dateTime={message.createdAt}><span className="sr-only">{own ? 'You' : partner?.name ?? 'Your partner'}, </span>{messageTime(message.createdAt)}</time></div>
        </Fragment>
      })}
    </div>
    <form className="messages-composer" onSubmit={event => { event.preventDefault(); submit() }}>
      <div className="messages-composer-field"><textarea ref={composerRef} rows={2} value={draft} onChange={event => onDraft(event.target.value)} placeholder="Write a little hello…" aria-label="Message" onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
      }} /><button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={18} /></button></div>
      <p><span>Enter to send · Shift + Enter for a new line</span><span>Make room for a good conversation.</span></p>
    </form>
  </section>
}
