import { LoaderCircle } from 'lucide-react'

export function GoogleSignInButton({ loading, disabled, onClick }: {
  loading: boolean; disabled: boolean; onClick: () => void
}) {
  return <button type="button" className="auth-google-button" disabled={disabled} onClick={onClick} aria-busy={loading}>
    <img src="/google-g.png" alt="" width={20} height={20} />
    <span>{loading ? 'Connecting to Google…' : 'Continue with Google'}</span>
    {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
  </button>
}
