import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  useEffect(() => { const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-lg sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="modal-title" className="text-xl font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div><button onClick={onClose} className="rounded-md p-2 text-muted hover:bg-slate-100" aria-label="Close"><X size={20}/></button></div>{children}</div></div>
}
