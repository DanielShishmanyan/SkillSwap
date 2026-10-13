import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth(); const location = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center bg-canvas"><div className="size-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label="Loading" /></div>
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}
