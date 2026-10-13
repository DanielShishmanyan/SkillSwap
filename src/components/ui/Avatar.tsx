import { cn } from '../../lib/cn'
export function Avatar({ src, name, size = 'md', className }: { src: string; name: string; size?: 'sm'|'md'|'lg'|'xl'; className?: string }) {
  return <img src={src} alt={`${name}'s avatar`} className={cn('shrink-0 rounded-full object-cover ring-2 ring-white', size === 'sm' && 'size-9', size === 'md' && 'size-12', size === 'lg' && 'size-16', size === 'xl' && 'size-24 sm:size-28', className)} />
}
