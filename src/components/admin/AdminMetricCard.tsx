import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

export function AdminMetricCard({ label, value, detail, icon: Icon }: { label: string; value: number|string; detail: string; icon: LucideIcon }) {
  return <Card className="admin-metric-card min-h-32 border-orange-900/25 bg-[#111]/95 shadow-sm transition-colors hover:border-orange-700/40">
    <CardContent className="admin-metric-content flex h-full items-start justify-between gap-4 p-5">
      <div className="min-w-0"><p className="text-[11px] uppercase tracking-[.14em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums text-slate-100">{value}</p><p className="mt-2 truncate text-xs text-slate-500">{detail}</p></div>
      <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-400"><Icon size={19}/></div>
    </CardContent>
  </Card>
}
