import { Badge } from '../ui/badge'

export function AdminStatusBadge({ value }: { value: unknown }) {
  const label = String(value ?? 'unknown').split('_').join(' ')
  const normalized = label.toLowerCase()
  const tone = ['online','active','completed','verified','true','in progress'].includes(normalized)
    ? 'border-green-500/30 bg-green-500/10 text-green-300'
    : ['pending','maintenance','registration','in use'].includes(normalized)
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : ['banned','cancelled','offline','false'].includes(normalized)
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
  return <Badge variant="outline" className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>{label}</Badge>
}
