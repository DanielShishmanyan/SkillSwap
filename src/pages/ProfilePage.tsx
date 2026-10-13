import { Edit3, Save, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../app/app-store.context'
import { ProfileAchievements, ProfileAvailability, ProfileHero, ProfileSkills } from '../components/users/ProfileSections'
import { levelProgress } from '../features/gamification/gamification.service'

export function ProfilePage() {
  const { currentUser, updateProfile } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState(currentUser.bio)
  const [location, setLocation] = useState(currentUser.location)
  const progress = levelProgress(currentUser.xp)
  const edit = () => { setBio(currentUser.bio); setLocation(currentUser.location); setEditing(true) }
  const save = () => { updateProfile({ bio: bio.trim(), location: location.trim() }); setEditing(false); toast.success('Profile saved') }
  return <main className="profile-page"><div className="profile-backdrop" aria-hidden="true" /><div className="page-shell profile-content">
    <ProfileHero user={currentUser} own actions={<button type="button" className="profile-secondary" onClick={edit} disabled={editing}><Edit3 size={15} />Edit profile</button>} />
    <div className="profile-layout">
      <div className="profile-main">
        <section className="profile-section profile-about"><div className="profile-section-heading"><div><p className="profile-eyebrow">A LITTLE ABOUT YOU</p><h2>Your story starts here.</h2></div></div>
          {editing ? <form className="profile-editor" onSubmit={event => { event.preventDefault(); save() }}><label htmlFor="profile-location">Where you’re based</label><input id="profile-location" value={location} onChange={event => setLocation(event.target.value)} placeholder="City or online" autoFocus /><label htmlFor="profile-bio">A little introduction</label><textarea id="profile-bio" rows={5} value={bio} onChange={event => setBio(event.target.value)} placeholder="What do you enjoy sharing? What would you love to learn?" /><div><button className="profile-primary" type="submit"><Save size={15} />Save changes</button><button className="profile-secondary" type="button" onClick={() => setEditing(false)}><X size={15} />Cancel</button></div></form>
            : <p className="profile-bio">{currentUser.bio || 'Tell people a little about yourself, what you know, and what sparks your curiosity.'}</p>}
        </section>
        <ProfileSkills user={currentUser} own />
      </div>
      <aside className="profile-sidebar">
        <section className="profile-section profile-growth"><h2><Sparkles size={17} />A little growth, every day</h2><div><strong>Level {currentUser.level}</strong><span>{currentUser.xp} total XP</span></div><progress max={progress.required} value={progress.current} aria-label="Progress toward your next level" /><p>{progress.required - progress.current} XP to Level {currentUser.level + 1}</p></section>
        <ProfileAvailability user={currentUser} />
        <ProfileAchievements user={currentUser} own />
      </aside>
    </div>
  </div></main>
}
