import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { AppStoreProvider } from './AppStore'
import { AuthProvider } from '../features/auth/AuthProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  return <QueryClientProvider client={queryClient}><AuthProvider><AppStoreProvider>{children}<Toaster richColors position="bottom-right" /></AppStoreProvider></AuthProvider></QueryClientProvider>
}
