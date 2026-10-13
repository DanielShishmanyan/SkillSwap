import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral'|'green'|'amber'|'blue'|'red'; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', tone === 'neutral' && 'bg-slate-100 text-slate-600', tone === 'green' && 'bg-brand-100 text-brand-700', tone === 'amber' && 'bg-amber-100 text-amber-800', tone === 'blue' && 'bg-sky-100 text-sky-800', tone === 'red' && 'bg-red-100 text-red-700', className)}>{children}</span>
}
