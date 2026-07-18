import { Activity, BadgeCheck, Ban, Database, Gauge, LogOut, Server, Settings, Shield, Store, Swords, Trophy, Users } from 'lucide-react'
import { CrowbarLogo } from '../CrowbarLogo'
import type { AdminSection } from './adminTypes'

const groups = [
  {label:'Overview',items:[['dashboard','Dashboard',Gauge]]},
  {label:'Management',items:[['users','Users',Users],['servers','Servers',Server],['matchmaking','Matchmaking',Activity],['matches','Matches',Swords],['tournaments','Tournaments',Trophy]]},
  {label:'Moderation',items:[['reports','Reports',Shield],['bans','Bans',Ban]]},
  {label:'Customization',items:[['store','Store',Store],['vip','VIP',BadgeCheck],['badges','Badges',Shield],['frames','Frames',Shield]]},
  {label:'System',items:[['logs','Logs',Database],['system','System',Settings]]},
] as const

export function AdminSidebar({section,onSelect,onCreate:_onCreate,onLogout,onHub,open,onClose}:{section:AdminSection;onSelect:(s:AdminSection)=>void;onCreate:(type:'user'|'server'|'tournament')=>void;onLogout:()=>void;onHub:()=>void;open:boolean;onClose:()=>void}) {
  return <aside className={`admin-sidebar ${open?'admin-sidebar--open':''} inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-orange-900/25 bg-[#0b0b0c] shadow-2xl transition-transform ${open?'translate-x-0':'-translate-x-full'}`}>
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-orange-900/25 px-5"><CrowbarLogo className="size-9"/><div className="min-w-0"><p className="truncate text-sm font-semibold tracking-wider text-orange-400">SECTOR NINE</p><p className="text-[10px] uppercase tracking-[.22em] text-slate-500">Administration</p></div></div>
    <div className="admin-sidebar-scroll"><div className="space-y-6 p-4">{groups.map(group=><div key={group.label}><p className="mb-2 px-2 text-[10px] uppercase tracking-[.2em] text-slate-600">{group.label}</p><div className="space-y-1">{group.items.map(([id,label,Icon])=><a key={id} href={id==='dashboard'?'/admin':`/admin/${id}`} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onSelect(id);onClose()}} className={`flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-xs transition-colors ${section===id?'bg-orange-500/12 text-orange-300 ring-1 ring-orange-500/20':'text-slate-400 hover:bg-white/[.04] hover:text-slate-100'}`}><Icon size={15}/><span>{label}</span></a>)}</div></div>)}</div></div>
    <div className="shrink-0 space-y-3 border-t border-orange-900/25 p-4"><button onClick={onHub} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-slate-400 hover:bg-orange-500/10 hover:text-orange-300"><Gauge size={15}/>Return to Hub</button><button onClick={onLogout} className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-300"><LogOut size={15}/>Terminate session</button></div>
  </aside>
}
