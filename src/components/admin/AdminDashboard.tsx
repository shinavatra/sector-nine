import { Activity, BadgeCheck, Ban, Gamepad2, Link, ListTodo, Server, ShieldCheck, Trophy, UserCheck, Users, Wifi } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { AdminMetricCard } from './AdminMetricCard'

const metrics=[['total_users','Total Users','Registered personnel',Users],['online_users','Online Users','Visible and seen in last 5 minutes',Wifi],['premium_users','Premium Users','Active VIP accounts',BadgeCheck],['steam_linked','Steam Linked','Accounts linked to Steam',Link],['steam_verified','Steam Verified','Verified Steam profiles',ShieldCheck],['owns_hl1','Own HL1','Eligible game owners',Gamepad2],['current_queue','Queue','Players waiting now',ListTodo],['running_matches','Active Matches','Pending or in progress',Activity],['online_servers','Online Servers','Ready game servers',Server],['active_tournaments','Active Tournaments','Registration or running',Trophy],['reports_waiting','Open Reports','Awaiting moderation',UserCheck],['banned_players','Active Bans','Current restrictions',Ban]] as const

function ActivityChart({series}:{series:Record<string,Array<{day:string;value:number}>>}) {
  const values=Object.values(series).flat().map(point=>Number(point.value))
  const max=Math.max(1,...values)
  return <div className="admin-panels-grid">{Object.entries(series).map(([name,points])=><div key={name}><div className="mb-3 flex items-center justify-between"><span className="text-xs capitalize text-slate-400">{name.split('_').join(' ')}</span><span className="text-[10px] text-slate-600">14 DAYS</span></div><div className="flex h-44 items-end gap-1.5 rounded-md border border-orange-900/15 bg-black/20 p-3">{points.map(point=><div key={point.day} title={`${new Date(point.day).toLocaleDateString()}: ${point.value}`} className="min-h-px flex-1 rounded-t-sm bg-gradient-to-t from-orange-700 to-orange-400 opacity-80 transition-opacity hover:opacity-100" style={{height:`${Math.max(2,Number(point.value)/max*100)}%`}}/>)}</div></div>)}</div>
}

export function AdminDashboard({data}:{data:any}) {
  return <div className="admin-dashboard space-y-6"><div className="admin-metrics-grid">{metrics.map(([key,label,detail,Icon])=><AdminMetricCard key={key} label={label} detail={detail} value={data.cards[key]} icon={Icon}/>)}</div><Card className="min-w-0 border-orange-900/25 bg-[#101011]"><CardHeader><CardTitle className="text-base">Platform Activity</CardTitle><CardDescription>Registrations and matches from live PostgreSQL records</CardDescription></CardHeader><CardContent><ActivityChart series={data.charts}/></CardContent></Card></div>
}
