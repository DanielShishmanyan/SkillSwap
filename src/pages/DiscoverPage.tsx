import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../app/app-store.context'
import { BookingModal } from '../components/transactions/BookingModal'
import { SwapModal } from '../components/transactions/SwapModal'
import { EmptyState } from '../components/ui/EmptyState'
import { UserCard } from '../components/users/UserCard'
import { rankMatches } from '../features/matches/matching.algorithm'
import { categories } from '../features/skills/skills.data'
import type { UserProfile } from '../types/domain'
import './DiscoverPage.css'

export function DiscoverPage() {
  const { users, currentUser, openConversation } = useAppStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [online, setOnline] = useState(false)
  const [available, setAvailable] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<UserProfile>()
  const [mode, setMode] = useState<'swap' | 'book'>()
  const matchMap = useMemo(() => new Map(rankMatches(currentUser, users).map(match => [match.user.id, match])), [currentUser, users])
  const filtered = useMemo(() => users
    .filter(user => user.id !== currentUser.id)
    .filter(user => (user.name + ' ' + user.teaches.map(skill => skill.name).join(' ')).toLowerCase().includes(query.trim().toLowerCase()))
    .filter(user => category === 'All' || user.teaches.some(skill => skill.category === category))
    .filter(user => !online || user.teaches.some(skill => skill.deliveryMode !== 'in_person'))
    .filter(user => !available || user.availableNow),
  [users, currentUser.id, query, category, online, available])
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const extraFilters = Number(online) + Number(available)
  const hasFilters = Boolean(query.trim() || category !== 'All' || extraFilters)
  const reset = () => { setQuery(''); setCategory('All'); setOnline(false); setAvailable(false); setPage(1) }
  const open = (user: UserProfile, nextMode: 'swap' | 'book') => { setSelected(user); setMode(nextMode) }
  const goToPage = (next: number) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <>
      <main className="discover-page">
        <div className="discover-backdrop" aria-hidden="true" />
        <div className="page-shell discover-content">
          <header className="discover-heading">
            <p className="discover-eyebrow">A WORLD OF KNOW-HOW, SHARED</p>
            <h1>Find your people. <em>Learn something new.</em></h1>
            <p>From everyday hobbies to your next big passion. It starts with a connection.</p>
          </header>

          <section className="discover-search-panel" aria-label="Find people">
            <div className="discover-search-row">
              <div className="discover-search">
                <Search size={19} aria-hidden="true" />
                <label className="sr-only" htmlFor="discover-search">Search by name or skill</label>
                <input id="discover-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Who or what would you like to learn?" />
              </div>
              <select aria-label="Skill category" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
                {categories.map(item => <option key={item} value={item}>{item === 'All' ? 'All interests' : item}</option>)}
              </select>
              <button type="button" className="discover-filter-button" aria-expanded={filtersOpen} aria-controls="discover-extra-filters" onClick={() => setFiltersOpen(value => !value)}>
                <SlidersHorizontal size={16} />Filters{extraFilters > 0 && <span>{extraFilters}</span>}
              </button>
            </div>
            {filtersOpen && <div id="discover-extra-filters" className="discover-extra-filters">
              <label><input type="checkbox" checked={online} onChange={event => { setOnline(event.target.checked); setPage(1) }} />Online only</label>
              <label><input type="checkbox" checked={available} onChange={event => { setAvailable(event.target.checked); setPage(1) }} />Available now</label>
            </div>}
          </section>

          <div className="discover-results-summary">
            <p role="status"><strong>{filtered.length}</strong> {filtered.length === 1 ? 'person' : 'people'} to discover{extraFilters > 0 && <span> · {[online && 'Online', available && 'Available now'].filter(Boolean).join(' · ')}</span>}</p>
            {hasFilters && <button type="button" onClick={reset}>Clear filters</button>}
          </div>

          {filtered.length ? <>
            <div className="discover-grid">
              {visibleUsers.map(user => <UserCard key={user.id} user={user} match={matchMap.get(user.id)}
                onSwap={() => open(user, 'swap')} onBook={() => open(user, 'book')}
                onMessage={() => navigate(`/messages?conversation=${openConversation(user.id)}`)} />)}
            </div>
            {pageCount > 1 && <nav className="discover-pagination" aria-label="Discover pagination">
              <p>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</p>
              <div>
                <button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
              </div>
            </nav>}
          </> : <div className="discover-empty">
            <EmptyState icon={Users} title="No connections found just yet" description="Try another skill or loosen your filters to meet more people." />
            {hasFilters && <button type="button" onClick={reset}>Show all people</button>}
          </div>}
        </div>
      </main>
      <SwapModal user={selected} open={mode === 'swap'} onClose={() => setMode(undefined)} />
      <BookingModal user={selected} open={mode === 'book'} onClose={() => setMode(undefined)} />
    </>
  )
}
