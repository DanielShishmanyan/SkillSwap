import { ArrowRightLeft, CalendarDays, ChevronDown, ChevronRight, Compass, Home, LogOut, Menu, MessageCircle, Sparkles, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../../app/app-store.context'
import { useAuth } from '../../features/auth/AuthProvider'
import { Avatar } from '../ui/Avatar'
import './Navbar.css'

const links = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/matches', label: 'Matches', icon: Sparkles },
  { to: '/swaps', label: 'Swaps', icon: ArrowRightLeft },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
]

export function Navbar() {
  const location = useLocation()
  const [panel, setPanel] = useState<'navigation' | 'account' | null>(null)
  const [scrollState, setScrollState] = useState({ routeKey: location.key, hidden: false })
  const { currentUser } = useAppStore()
  const { user, logout } = useAuth()
  const headerRef = useRef<HTMLElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const navigationButtonRef = useRef<HTMLButtonElement>(null)
  const name = user?.name ?? currentUser.name
  const close = () => setPanel(null)
  const hidden = !panel && scrollState.routeKey === location.key && scrollState.hidden

  useEffect(() => {
    // Clamp overscroll so mobile bounce does not look like a direction change.
    const scrollPosition = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight))
    let previousY = scrollPosition()
    let travel = 0
    let frame: number | undefined
    const showHeader = (hide: boolean) => {
      setScrollState(previous => previous.routeKey === location.key && previous.hidden === hide
        ? previous
        : { routeKey: location.key, hidden: hide })
    }
    const update = () => {
      frame = undefined
      const y = scrollPosition()
      const delta = y - previousY
      previousY = y

      if (y <= (headerRef.current?.offsetHeight ?? 88) || panel || headerRef.current?.querySelector(':focus-visible')) {
        travel = 0
        showHeader(false)
        return
      }
      if (!delta) return
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0
      travel += delta

      // Ignore tiny trackpad movements; respond sooner when scrolling up.
      if (travel >= 12 || travel <= -8) {
        showHeader(travel > 0)
        travel = 0
      }
    }
    const onScroll = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [location.key, panel])

  useEffect(() => {
    if (!panel) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setPanel(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPanel(null)
      const trigger = panel === 'account' ? accountButtonRef : navigationButtonRef
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [panel])

  return (
    <header className={`site-header${hidden ? ' is-hidden' : ''}`} ref={headerRef} onFocusCapture={() => setScrollState({ routeKey: location.key, hidden: false })} onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close()
    }}>
      <div className="site-header-bar">
        <NavLink to="/" className="site-brand" onClick={close} aria-label="SkillSwap home">
          <span className="site-brand-mark"><ArrowRightLeft size={20} /></span>
          <span>Skill<span className="site-brand-accent">Swap</span></span>
        </NavLink>

        <nav className="site-desktop-nav" aria-label="Main navigation">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={close} className={({ isActive }) => `site-nav-link${isActive ? ' is-active' : ''}`}>{label}</NavLink>
          ))}
        </nav>

        <div className="site-header-actions">
          <div className="site-account">
            <button ref={accountButtonRef} type="button" className="site-account-trigger" onClick={() => setPanel(panel === 'account' ? null : 'account')} aria-label="Account options" aria-expanded={panel === 'account'} aria-controls="site-account-panel">
              <Avatar src={currentUser.avatar} name={name} size="sm" />
              <span className="site-account-name">{name.split(' ')[0]}</span>
              <ChevronDown size={14} className={panel === 'account' ? 'site-chevron-open' : ''} />
            </button>
            {panel === 'account' && (
              <div id="site-account-panel" className="site-account-panel">
                <div className="site-account-summary"><p>{name}</p><span>Level {currentUser.level} · Keep growing</span></div>
                <NavLink to="/profile" className="site-panel-link" onClick={close}><User size={17} />My profile<ChevronRight size={14} className="site-profile-accent" /></NavLink>
                <button type="button" className="site-panel-link site-logout" onClick={() => { close(); void logout() }}><LogOut size={17} />Log out</button>
              </div>
            )}
          </div>
          <button ref={navigationButtonRef} type="button" className="site-menu-trigger" onClick={() => setPanel(panel === 'navigation' ? null : 'navigation')} aria-expanded={panel === 'navigation'} aria-controls="site-mobile-navigation" aria-label={panel === 'navigation' ? 'Close navigation' : 'Open navigation'}>
            {panel === 'navigation' ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {panel === 'navigation' && (
          <nav id="site-mobile-navigation" className="site-mobile-nav" aria-label="Mobile navigation">
            <p className="site-mobile-label">YOUR NEXT CONNECTION</p>
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={close} className={({ isActive }) => `site-panel-link${isActive ? ' is-active' : ''}`}><Icon size={18} />{label}</NavLink>
            ))}
            <NavLink to="/profile" onClick={close} className={({ isActive }) => `site-panel-link site-mobile-profile${isActive ? ' is-active' : ''}`}><User size={18} />My profile</NavLink>
          </nav>
        )}
      </div>
    </header>
  )
}
