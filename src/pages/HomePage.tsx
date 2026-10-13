import { ArrowRight, ArrowRightLeft, Check, Plus, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppStore } from '../app/app-store.context'
import { Button } from '../components/ui/Button'
import { skills } from '../features/skills/skills.data'
import type { TeachableSkill } from '../types/domain'
import './HomePage.css'

type SkillIntent = 'teach' | 'learn'
const suggestedIds = ['react', 'figma', 'spanish', 'photography', 'piano', 'python', 'cooking', 'yoga']
const suggestedSkills = suggestedIds.flatMap(id => skills.filter(skill => skill.id === id))
const steps = [
  { title: 'Bring what you know', text: 'A language, a hobby, a little work experience. It all has value.' },
  { title: 'Find your other half', text: 'Meet someone who can teach you something and learn from you, too.' },
  { title: 'Make time to grow', text: 'Start a conversation, plan a session, and learn at your own pace.' },
]

export function HomePage() {
  const { currentUser, updateSkills } = useAppStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [intent, setIntent] = useState<SkillIntent>('teach')
  const [teachIds, setTeachIds] = useState(currentUser.teaches.map(skill => skill.id))
  const [learnIds, setLearnIds] = useState(currentUser.learns.map(skill => skill.id))
  const selectedIds = intent === 'teach' ? teachIds : learnIds
  const visibleSkills = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? skills.filter(skill => skill.name.toLowerCase().includes(term)) : suggestedSkills
  }, [query])
  const canMatch = teachIds.length > 0 && learnIds.length > 0
  const skillName = (id: string) => skills.find(skill => skill.id === id)?.name
    ?? currentUser.teaches.find(skill => skill.id === id)?.name
    ?? currentUser.learns.find(skill => skill.id === id)?.name
    ?? id

  const toggleSkill = (id: string) => {
    const setIds = intent === 'teach' ? setTeachIds : setLearnIds
    setIds(ids => ids.includes(id) ? ids.filter(selected => selected !== id) : [...ids, id])
  }

  const save = () => {
    if (!canMatch) return
    const teaches = teachIds.flatMap(id => {
      const existing = currentUser.teaches.find(skill => skill.id === id)
      if (existing) return [existing]
      const skill = skills.find(item => item.id === id)
      return skill ? [{ ...skill, proficiency: 3, deliveryMode: 'both' } satisfies TeachableSkill] : []
    })
    const learns = learnIds.flatMap(id => {
      const skill = currentUser.learns.find(item => item.id === id) ?? skills.find(item => item.id === id)
      return skill ? [skill] : []
    })
    updateSkills(teaches, learns)
    toast.success('Skills saved')
    navigate('/matches')
  }

  return (
    <main className="home-page">
      <div className="home-atmosphere" aria-hidden="true">
        <span className="home-glow home-glow-sage" />
        <span className="home-glow home-glow-lilac" />
        <span className="home-orbit" />
        <span className="home-drift-dot home-drift-dot-one" />
        <span className="home-drift-dot home-drift-dot-two" />
      </div>

      <section className="home-hero page-shell" aria-labelledby="home-title">
        <div className="home-intro">
          <p className="home-eyebrow"><span /> A LITTLE CURIOSITY GOES A LONG WAY</p>
          <h1 id="home-title">Share your thing.<br /><em>Find your next.</em></h1>
          <p className="home-description">Something you know could open a door for someone else. Swap skills, meet your people, and discover what comes next.</p>
          <Link to="/discover" className="home-explore">Explore the community <ArrowRight size={17} /></Link>
          <div className="home-exchange-note">
            <span className="home-exchange-mark"><ArrowRightLeft size={20} /></span>
            <p>A little give. A little grow.<br /><span>Mutual skill swaps are always free.</span></p>
          </div>
        </div>

        <section className="home-picker" aria-labelledby="picker-title">
          <div className="home-picker-heading">
            <span className="home-picker-icon"><Sparkles size={20} /></span>
            <p>GOOD CONNECTIONS START HERE</p>
          </div>
          <h2 id="picker-title">What’s your thing?</h2>
          <p className="home-picker-description">Choose what you can share and what sparks your curiosity.</p>

          <div className="home-intent-switch" role="group" aria-label="Choose skills to teach or learn">
            <button type="button" aria-pressed={intent === 'teach'} onClick={() => { setIntent('teach'); setQuery('') }}>
              I can teach <span>{teachIds.length}</span>
            </button>
            <button type="button" aria-pressed={intent === 'learn'} onClick={() => { setIntent('learn'); setQuery('') }}>
              I want to learn <span>{learnIds.length}</span>
            </button>
          </div>

          <div className="home-skill-search">
            <Search size={17} aria-hidden="true" />
            <label htmlFor="home-skill-search" className="sr-only">Search skills to {intent}</label>
            <input id="home-skill-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={intent === 'teach' ? 'What could you teach someone?' : 'What would you love to learn?'} autoComplete="off" />
          </div>

          <div className="home-options-heading">
            <p>{query.trim() ? 'Search results' : 'A few ideas to get you started'}</p>
            <span role="status">{query.trim() ? `${visibleSkills.length} found` : ''}</span>
          </div>
          <div className="home-skill-options" role="group" aria-label={`Skills you can ${intent}`}>
            {visibleSkills.map(skill => (
              <button key={skill.id} type="button" className={`home-skill-option ${intent === 'learn' ? 'home-skill-option-learn' : ''}`} aria-pressed={selectedIds.includes(skill.id)} onClick={() => toggleSkill(skill.id)}>
                {skill.name}{selectedIds.includes(skill.id) ? <Check size={13} /> : <Plus size={13} />}
              </button>
            ))}
            {!visibleSkills.length && <p className="home-no-skills">No skills found. Try a broader term, like “design” or “music”.</p>}
          </div>

          <div className="home-selection">
            <p className="home-selection-label">{intent === 'teach' ? 'Your teaching skills' : 'Your learning wishlist'} <span aria-live="polite">· {selectedIds.length} selected</span></p>
            <div className="home-selected-skills">
              {selectedIds.map(id => (
                <button key={id} type="button" className={intent === 'learn' ? 'home-selected-learn' : ''} onClick={() => toggleSkill(id)} aria-label={`Remove ${skillName(id)} from skills to ${intent}`}>
                  {skillName(id)}<X size={12} />
                </button>
              ))}
              {!selectedIds.length && <p>Pick a skill above. You can always change it later.</p>}
            </div>
          </div>

          <Button className="home-match-button" onClick={save} disabled={!canMatch} aria-describedby="home-match-hint">Find my matches <ArrowRight size={17} /></Button>
          <p id="home-match-hint" className="home-match-hint">{canMatch ? 'A new connection could be one click away.' : 'Choose at least one skill to teach and one to learn.'}</p>
        </section>
      </section>

      <section className="home-how page-shell" aria-labelledby="home-how-title">
        <div className="home-how-heading"><h2 id="home-how-title">Small exchanges. <span>New possibilities.</span></h2><p>That’s how we grow together.</p></div>
        <div className="home-steps">
          {steps.map((step, index) => (
            <article key={step.title} className="home-step">
              <span className="home-step-number">0{index + 1}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
