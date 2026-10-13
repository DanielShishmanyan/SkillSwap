import { Star } from 'lucide-react'
export function Rating({ value, count, compact = false }: { value: number; count?: number; compact?: boolean }) {
  return <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink"><Star size={15} className="fill-amber-400 text-amber-400" />{value.toFixed(1)}{!compact && count !== undefined && <span className="font-normal text-muted">({count})</span>}</span>
}
