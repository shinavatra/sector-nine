import { Activity, BadgeCheck, Ban, CalendarPlus, CircleOff, MessageSquareWarning, Server, ShieldCheck, Trophy, Users, VolumeX, Wifi } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { AdminMetricCard } from './AdminMetricCard'

const metrics=[
  ['total_users','Total Users','Active registered accounts',Users],
  ['online_users','Online Users','Visible and seen in the last 5 minutes',Wifi],
  ['today_registrations',"Today's Registrations",'Accounts created since midnight',CalendarPlus],
  ['active_matches','Active Matches','Matches currently in progress',Activity],
  ['running_tournaments','Running Tournaments','Tournaments currently in progress',Trophy],
  ['online_servers','Online Servers','Servers with online status',Server],
  ['offline_servers','Offline Servers','Servers with offline status',CircleOff],
  ['pending_reports','Pending Reports','Reports awaiting moderation',MessageSquareWarning],
  ['active_bans','Active Bans','Unexpired active restrictions',Ban],
  ['active_mutes','Active Mutes','Unexpired active chat restrictions',VolumeX],
  ['premium_users','Premium Users','Active unexpired VIP accounts',BadgeCheck],
  ['steam_verified_users','Steam Verified Users','Verified active accounts',ShieldCheck],
] as const

function ActivityChart({series}:{series:Record<string,Array<{day:string;value:number}>>}) {
  const values=Object.values(series).flat().map(point=>Number(point.value))
  const max=Math.max(1,...values)
  return <div className="admin-panels-grid">{Object.entries(series).map(([name,points])=><div key={name}><div className="mb-3 flex items-center justify-between"><span className="text-xs capitalize text-slate-400">{name.split('_').join(' ')}</span><span className="text-[10px] text-slate-600">14 DAYS</span></div><div className="flex h-44 items-end gap-1.5 rounded-md border border-orange-900/15 bg-black/20 p-3">{points.map(point=><div key={point.day} title={`${new Date(point.day).toLocaleDateString()}: ${point.value}`} className="min-h-px flex-1 rounded-t-sm bg-gradient-to-t from-orange-700 to-orange-400 opacity-80 transition-opacity hover:opacity-100" style={{height:`${Math.max(2,Number(point.value)/max*100)}%`}}/>)}</div></div>)}</div>
}

export function AdminDashboard({data}:{data:any}) {
  return <div className="admin-dashboard space-y-6"><div className="admin-metrics-grid">{metrics.map(([key,label,detail,Icon])=><AdminMetricCard key={key} label={label} detail={detail} value={data.cards[key]} icon={Icon}/>)}</div><Card className="min-w-0 border-orange-900/25 bg-[#101011]"><CardHeader><CardTitle className="text-base">Platform Activity</CardTitle><CardDescription>Registrations and matches from live PostgreSQL records</CardDescription></CardHeader><CardContent><ActivityChart series={data.charts}/></CardContent></Card></div>
}
