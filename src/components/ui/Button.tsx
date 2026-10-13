import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ className, variant = 'primary', loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; children: ReactNode }) {
  return <button className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-50', variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700', variant === 'secondary' && 'border border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50', variant === 'ghost' && 'text-muted hover:bg-slate-100 hover:text-ink', variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700', className)} disabled={loading || props.disabled} {...props}>{loading && <LoaderCircle size={16} className="animate-spin" />}{children}</button>
}
