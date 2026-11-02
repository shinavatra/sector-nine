import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { Copy,RefreshCw,Search,Server } from 'lucide-react'
import { toast } from 'sonner'
import { gameServerAPI } from '../utils/api'
import { subscribeRealtime,type RealtimeStatus } from '../utils/realtime'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card,CardContent,CardHeader,CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from './ui/select'
import { filterServerBrowserRows,type Availability,type BrowserServer,type LiveStatus } from './serverBrowserModel'

const gameNames:Record<string,string>={hl1:'Half-Life 1 / AG 6.6',cs16:'Counter-Strike 1.6',cod4:'Call of Duty 4 Promod',l4d2:'Left 4 Dead 2'}
const statusLabels:Record<LiveStatus,string>={online:'ONLINE',offline:'OFFLINE',starting:'STARTING',in_match:'IN MATCH'}
const availabilityLabels:Record<Availability,string>={reachable:'PUBLIC',idle:'IDLE MATCHMAKING',reserved:'RESERVED',active_match:'ACTIVE MATCH',offline:'UNAVAILABLE'}

export function ServerBrowser({defaultGameId}:{defaultGameId:string}){
  const [servers,setServers]=useState<BrowserServer[]>([]),[search,setSearch]=useState(''),[game,setGame]=useState(defaultGameId),[region,setRegion]=useState('all'),[availability,setAvailability]=useState('all')
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[realtimeStatus,setRealtimeStatus]=useState<RealtimeStatus>('disconnected')
  const inFlight=useRef(false),mounted=useRef(true)
  const refresh=useCallback(async(silent=false)=>{if(inFlight.current)return;inFlight.current=true;if(!silent)setLoading(true);try{const data=await gameServerAPI.getStatus('all');if(!mounted.current)return;setServers(Array.isArray(data?.servers)?data.servers:[]);setError('')}catch(err:any){if(mounted.current)setError(err?.message||'Live server status is unavailable.')}finally{inFlight.current=false;if(mounted.current)setLoading(false)}},[])
  useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false}},[refresh])
  useEffect(()=>{setGame(defaultGameId)},[defaultGameId])
  useEffect(()=>subscribeRealtime(event=>{if(event.type!=='server.status'||!event.payload.server)return;const next=event.payload.server as BrowserServer;setServers(current=>{const index=current.findIndex(server=>server.id===next.id);if(index<0)return [...current,next];const copy=[...current];copy[index]=next;return copy})},status=>{setRealtimeStatus(status);if(status==='connected')void refresh(true)}),[refresh])
  useEffect(()=>{if(realtimeStatus==='connected')return;const timer=window.setInterval(()=>void refresh(true),20_000);return()=>window.clearInterval(timer)},[realtimeStatus,refresh])
  const regions=useMemo(()=>Array.from(new Set(servers.map(server=>server.region))).sort(),[servers])
  const visible=useMemo(()=>filterServerBrowserRows(servers,{game,region,availability,search}),[servers,game,region,availability,search])
  const copyAddress=async(server:BrowserServer)=>{if(!server.canCopyAddress||!server.address)return;try{await navigator.clipboard.writeText(server.address);toast.success('Server address copied')}catch{toast.error('Could not copy the server address')}}
  return <Card className="mt-6 border-orange-900/35 bg-black/45">
    <CardHeader className="gap-3 border-b border-orange-900/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle className="flex items-center gap-2 font-mono text-base text-orange-300"><Server className="size-4"/>SERVER BROWSER</CardTitle><p className="mt-1 font-mono text-[11px] text-slate-500">LIVE HOST AGENT TELEMETRY · {realtimeStatus==='connected'?'REAL-TIME':'POLLING FALLBACK'}</p></div>
      <Button variant="outline" size="sm" className="gap-2 border-orange-900/40 font-mono" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={`size-3.5 ${loading?'animate-spin':''}`}/>REFRESH</Button>
    </CardHeader>
    <CardContent className="p-4">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="relative md:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"/><Input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search servers" className="h-10 border-orange-900/30 bg-black/40 pl-9 font-mono text-xs"/></label>
        <Select value={game} onValueChange={setGame}><SelectTrigger className="h-10 border-orange-900/30 bg-black/40 font-mono text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All games</SelectItem>{Object.entries(gameNames).map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
        <Select value={region} onValueChange={setRegion}><SelectTrigger className="h-10 border-orange-900/30 bg-black/40 font-mono text-xs"><SelectValue placeholder="All regions"/></SelectTrigger><SelectContent><SelectItem value="all">All regions</SelectItem>{regions.map(value=><SelectItem key={value} value={value}>{value.toUpperCase()}</SelectItem>)}</SelectContent></Select>
        <Select value={availability} onValueChange={setAvailability}><SelectTrigger className="h-10 border-orange-900/30 bg-black/40 font-mono text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All availability</SelectItem>{Object.entries(availabilityLabels).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </div>
      {error&&<div className="mt-4 rounded border border-red-800/50 bg-red-950/30 p-3 font-mono text-xs text-red-300">{error}</div>}
      {!error&&loading&&!servers.length&&<div className="mt-4 rounded border border-dashed border-orange-900/30 p-8 text-center font-mono text-xs text-slate-500">LOADING LIVE SERVER STATUS…</div>}
      {!error&&!loading&&!visible.length&&<div className="mt-4 rounded border border-dashed border-orange-900/30 p-8 text-center font-mono text-xs text-slate-500">NO REGISTERED SERVERS MATCH THESE FILTERS.</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(server=><article key={server.id} className="min-w-0 rounded border border-orange-900/25 bg-[#0d0d0e] p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-mono text-sm text-slate-100">{server.name}</h3><p className="mt-1 truncate font-mono text-[10px] uppercase text-slate-500">{gameNames[server.gameId]||server.gameId}{server.modeId?` · ${server.modeId}`:''}</p></div><Badge className={server.status==='offline'?'border-red-800/50 bg-red-950/40 text-red-300':server.status==='in_match'?'border-amber-700/50 bg-amber-950/40 text-amber-300':'border-green-700/50 bg-green-950/40 text-green-300'}>{statusLabels[server.status]}</Badge></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs"><div><dt className="text-[10px] text-slate-600">MAP</dt><dd className="mt-1 truncate text-slate-300">{server.currentMap||'—'}</dd></div><div><dt className="text-[10px] text-slate-600">PLAYERS</dt><dd className="mt-1 text-slate-300">{server.currentPlayers} / {server.maxPlayers||'—'}</dd></div><div><dt className="text-[10px] text-slate-600">REGION</dt><dd className="mt-1 text-slate-300">{server.region.toUpperCase()}</dd></div><div><dt className="text-[10px] text-slate-600">ACCESS</dt><dd className="mt-1 truncate text-slate-300">{availabilityLabels[server.availability]}</dd></div></dl>
        <div className="mt-4 flex min-h-9 items-center justify-between gap-2 border-t border-orange-900/15 pt-3"><span className="truncate font-mono text-[10px] text-slate-500">{server.address||(server.protectedCompetitive?'PROTECTED MATCHMAKING INSTANCE':'ADDRESS UNAVAILABLE')}</span>{server.canCopyAddress&&<Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 font-mono text-[10px] text-orange-300" onClick={()=>void copyAddress(server)}><Copy className="size-3"/>COPY ADDRESS</Button>}</div>
      </article>)}</div>
    </CardContent>
  </Card>
}
