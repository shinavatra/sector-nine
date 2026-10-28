import { useEffect, useState, type ReactNode } from "react";
import { Coins, Gamepad2, Loader2, Swords, Trophy, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { FramedAvatar } from "../components/FramedAvatar";
import { RetroXpProgress } from "../components/RetroXpProgress";
import { useGame } from "../contexts/GameContext";
import { useUser } from "../contexts/UserContext";
import { partyAPI, statsAPI } from "../utils/api";
import { displayPlayerName, playerInitials } from "../utils/displayName";

interface HubProps { onNavigate?: (page: string) => void }
type DashboardData={stats:any|null;matches:any[];party:any|null;invites:any[]}
const safeNumber=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0

export function Hub({onNavigate}:HubProps){
  const{user,onlineFriends}=useUser()
  const{selectedGame}=useGame()
  const[data,setData]=useState<DashboardData>({stats:null,matches:[],party:null,invites:[]})
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  useEffect(()=>{
    let active=true
    setLoading(true);setError('')
    Promise.allSettled([statsAPI.getUserStats(selectedGame.id),statsAPI.getMatchHistory(selectedGame.id),partyAPI.get()])
      .then(results=>{if(!active)return;const[statsResult,historyResult,partyResult]=results;const stats=statsResult.status==='fulfilled'?statsResult.value:null,history=historyResult.status==='fulfilled'?historyResult.value:null,party=partyResult.status==='fulfilled'?partyResult.value:null;setData({stats:stats?.stats||null,matches:Array.isArray(history?.matches)?history.matches.slice(0,5):[],party:party?.party||null,invites:Array.isArray(party?.invites)?party.invites:[]});const failed=results.filter(result=>result.status==='rejected');if(failed.length)setError(`${failed.length} dashboard section${failed.length===1?'':'s'} could not be loaded.`)})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[selectedGame.id])

  if(!user)return null
  const stats=data.stats,wins=safeNumber(stats?.wins),losses=safeNumber(stats?.losses),rating=safeNumber(stats?.rating)
  const competitiveRank=stats?.rank==null?'UNRANKED':`#${safeNumber(stats.rank)}`

  return <main className="page-container page-container-wide container mx-auto px-4 py-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="font-mono text-xs text-green-400">PERSONNEL DASHBOARD</p><h1 className="mt-1 font-mono text-3xl font-bold text-orange-400">WELCOME, {displayPlayerName(user).toUpperCase()}</h1><p className="mt-1 font-mono text-sm text-gray-400">Live account data for {selectedGame.name}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>onNavigate?.('profile')}>VIEW PROFILE</Button><Button onClick={()=>onNavigate?.('lobby')}>MATCHMAKING</Button></div>
    </div>
    {error&&<div role="alert" className="mb-5 rounded border border-red-900/40 bg-red-950/20 p-4 font-mono text-sm text-red-200">Dashboard data failed to load: {error}</div>}
    {loading?<div className="grid min-h-[50vh] place-items-center"><div className="flex items-center gap-3 font-mono text-gray-400"><Loader2 className="size-6 animate-spin text-orange-400"/>Loading account data...</div></div>:<>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
        <Card className="border-orange-900/20 bg-black/40"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <FramedAvatar frameId={user.equippedFrame}><Avatar className="size-24 border-2 border-orange-900/40"><AvatarImage src={user.resolvedAvatar}/><AvatarFallback>{playerInitials(user)}</AvatarFallback></Avatar></FramedAvatar>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-mono text-2xl text-orange-300">{displayPlayerName(user)}</h2><Badge variant="outline" className={user.isPremium?'border-yellow-700/50 text-yellow-300':'text-gray-500'}>{user.isPremium?'VIP ACTIVE':'STANDARD'}</Badge></div><p className="mt-1 font-mono text-sm text-gray-500">{user.steamId?'Steam connected':'Steam not connected'}</p><RetroXpProgress className="mt-4" level={user.level} totalXp={user.experience}/></div>
        </div></CardContent></Card>
        <Card className="border-yellow-900/30 bg-black/40"><CardHeader><CardTitle className="flex items-center gap-2 font-mono text-yellow-300"><Coins className="size-5"/>ACCOUNT STATUS</CardTitle></CardHeader><CardContent className="space-y-3"><DataRow label="FL Points" value={safeNumber(user.points).toLocaleString()}/><DataRow label="VIP" value={user.isPremium?'Active':'Inactive'}/><DataRow label="Selected game" value={selectedGame.shortName}/><Button className="w-full" variant="outline" onClick={()=>onNavigate?.('store')}>OPEN SHOP</Button></CardContent></Card>
      </div>
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={<Trophy/>} label="Competitive rank" value={competitiveRank}/><Metric icon={<Gamepad2/>} label="Rating" value={rating}/><Metric icon={<Swords/>} label="Wins / Losses" value={`${wins} / ${losses}`}/><Metric icon={<Users/>} label="Friends online" value={onlineFriends.length}/></section>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
        <Card className="border-orange-900/20 bg-black/40 lg:col-span-2"><CardHeader className="flex-row items-center justify-between"><CardTitle className="font-mono text-orange-400">RECENT MATCHES</CardTitle><Button size="sm" variant="ghost" onClick={()=>onNavigate?.('matches')}>VIEW ALL</Button></CardHeader><CardContent>{data.matches.length?<div className="space-y-2">{data.matches.map(match=><RecentMatch key={match.id} match={match} userId={user.id}/>)}</div>:<Empty text={`No completed ${selectedGame.shortName} matches.`}/>}</CardContent></Card>
        <div className="space-y-5">
          <Card className="border-green-900/25 bg-black/40"><CardHeader><CardTitle className="flex items-center gap-2 font-mono text-green-400"><Users className="size-5"/>FRIENDS ONLINE</CardTitle></CardHeader><CardContent>{onlineFriends.length?<div className="space-y-2">{onlineFriends.slice(0,6).map(friend=><button key={friend.id} className="flex w-full items-center gap-3 rounded border border-green-900/20 bg-green-950/10 p-2 text-left" onClick={()=>onNavigate?.(`profile/${encodeURIComponent(friend.id)}`)}><FramedAvatar frameId={friend.equippedFrame}><Avatar className="size-9"><AvatarImage src={friend.resolvedAvatar||''}/><AvatarFallback>{playerInitials(friend)}</AvatarFallback></Avatar></FramedAvatar><span className="min-w-0 flex-1 truncate text-sm text-gray-200">{displayPlayerName(friend)}</span><span className="size-2 rounded-full bg-green-400"/></button>)}</div>:<Empty text="No friends are online."/>}<Button className="mt-3 w-full" size="sm" variant="outline" onClick={()=>onNavigate?.('configuration')}>MANAGE FRIENDS</Button></CardContent></Card>
          <Card className="border-orange-900/20 bg-black/40"><CardHeader><CardTitle className="font-mono text-orange-400">PARTY STATUS</CardTitle></CardHeader><CardContent>{data.party?<div className="space-y-3"><DataRow label="Members" value={`${data.party.members?.length||0}`}/><DataRow label="Queue" value={String(data.party.queue_status||'idle').toUpperCase()}/><DataRow label="Leader" value={data.party.isLeader?'You':'Party member'}/>{data.party.members?.map((member:any)=><div key={member.user_id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-gray-300">{member.display_name||member.username}</span><span className={member.ready?'text-green-400':'text-gray-500'}>{member.ready?'READY':'NOT READY'}</span></div>)}</div>:<Empty text={data.invites.length?`${data.invites.length} pending party invite(s).`:'You are not in a party.'}/>}<Button className="mt-3 w-full" size="sm" variant="outline" onClick={()=>onNavigate?.('lobby')}>OPEN PARTY</Button></CardContent></Card>
        </div>
      </div>
    </>}
  </main>
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:string|number}){return <Card className="border-orange-900/20 bg-black/40"><CardContent className="p-4"><div className="mb-2 text-orange-400 [&>svg]:size-5">{icon}</div><p className="font-mono text-xs text-gray-500">{label}</p><p className="mt-1 font-mono text-xl text-gray-100">{value}</p></CardContent></Card>}
function DataRow({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3 border-b border-orange-900/15 pb-2 text-sm"><span className="text-gray-500">{label}</span><strong className="text-right font-mono text-gray-200">{value}</strong></div>}
function Empty({text}:{text:string}){return <p className="rounded border border-dashed border-orange-900/25 p-5 text-center font-mono text-sm text-gray-500">{text}</p>}
function RecentMatch({match,userId}:{match:any;userId:string}){const isP1=match.player1_id===userId,won=match.winner_id===userId,myScore=isP1?match.score_p1:match.score_p2,otherScore=isP1?match.score_p2:match.score_p1,opponent=isP1?(match.player2_display_name||match.player2_username):(match.player1_display_name||match.player1_username);return <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-orange-900/20 bg-black/25 p-3"><div><div className="flex items-center gap-2"><Badge variant="outline" className={won?'border-green-800 text-green-300':'border-red-900 text-red-300'}>{won?'WIN':'LOSS'}</Badge><span className="font-mono text-sm text-gray-200">vs {opponent}</span></div><p className="mt-1 text-xs text-gray-500">{match.selected_map||'Map not recorded'} · {match.completed_at?new Date(match.completed_at).toLocaleString():'Date not recorded'}</p></div><strong className="font-mono text-lg text-orange-300">{myScore} - {otherScore}</strong></div>}
