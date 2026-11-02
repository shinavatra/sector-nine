import{useEffect,useRef,useState}from'react'
import{AlertTriangle,ChevronDown,Crown,LogOut,Search,ShieldCheck,UserMinus,Users,X}from'lucide-react'
import{toast}from'sonner'
import{friendsAPI,partyAPI}from'../utils/api'
import{useUser}from'../contexts/UserContext'
import{Avatar,AvatarFallback,AvatarImage}from'./ui/avatar'
import{Badge}from'./ui/badge'
import{Button}from'./ui/button'
import{Input}from'./ui/input'
import{createPartyPoller,type PartyPollingIssue}from'./partyPolling'
import{notifyNotificationsChanged}from'../utils/notificationEvents'
import{subscribeRealtime}from'../utils/realtime'

type Member={user_id:string;display_name:string;username:string;avatar?:string;ready:boolean;is_online:boolean;presence_status?:'online'|'away'|'in_match'|'offline'}
type Party={id:string;leader_id:string;queue_status:string;selected_game_id?:string;selected_game_mode?:string;selected_team_size?:number;maxPartySize?:number;members:Member[];isLeader:boolean}
type OutgoingInvite={id:string;invitee_id:string;expires_at:string}
type PartyState={party:Party|null;invites:any[];outgoingInvites?:OutgoingInvite[]}

export function PartyPanel(){
  const{user}=useUser()
  const[state,setState]=useState<PartyState>({party:null,invites:[],outgoingInvites:[]}),[friends,setFriends]=useState<any[]>([]),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false),[inviteOpen,setInviteOpen]=useState(false),[inviteSearch,setInviteSearch]=useState(''),[connectionIssue,setConnectionIssue]=useState<PartyPollingIssue|null>(null)
  const pollerRef=useRef<ReturnType<typeof createPartyPoller<PartyState>>|null>(null)
  const actionInFlightRef=useRef(false)
  const realtimeRefreshRef=useRef(false)
  useEffect(()=>{
    const poller=createPartyPoller({
      poll:signal=>partyAPI.get(signal),
      intervalMs:5000,
      onSuccess:setState,
      onFailure:(_error,failures,issue)=>{
        if(issue==='authentication'||failures>=2)setConnectionIssue(issue)
      },
      onRecovery:()=>setConnectionIssue(null),
    })
    pollerRef.current=poller
    poller.start()
    return()=>{poller.stop();pollerRef.current=null}
  },[])
  useEffect(()=>subscribeRealtime(event=>{
    if(event.type==='presence.changed'||event.type==='presence.snapshot'){
      const updates=event.type==='presence.snapshot'?event.payload.players:[event.payload],map=new Map((Array.isArray(updates)?updates:[]).map((item:any)=>[String(item.userId),String(item.status)]))
      setState(previous=>previous.party?{...previous,party:{...previous.party,members:previous.party.members.map(member=>map.has(member.user_id)?{...member,presence_status:map.get(member.user_id) as Member['presence_status'],is_online:['online','in_match'].includes(String(map.get(member.user_id)))}:member)}}:previous)
      return
    }
    if(event.type!=='party.changed'&&event.type!=='party.invite'||realtimeRefreshRef.current)return
    realtimeRefreshRef.current=true
    partyAPI.get().then(setState).catch(()=>{}).finally(()=>{realtimeRefreshRef.current=false})
  },status=>{
    const poller=pollerRef.current
    if(!poller)return
    if(status==='connected'){poller.stop();setConnectionIssue(null)}else poller.start()
  }),[])
  useEffect(()=>{if(state.party?.isLeader)friendsAPI.getFriends().then(data=>setFriends(data.friends||[])).catch(()=>setFriends([]));else setFriends([])},[state.party?.isLeader])
  const act=async(action:()=>Promise<any>,message:string)=>{if(actionInFlightRef.current)return;actionInFlightRef.current=true;setBusy(true);try{await pollerRef.current?.waitForIdle();const result=await action();if(result?.party!==undefined)setState(result);else setState(await partyAPI.get());if(Number.isFinite(Number(result?.unreadCount)))notifyNotificationsChanged(Number(result.unreadCount));toast.success(message)}catch(error:any){toast.error(message,{description:error.message})}finally{actionInFlightRef.current=false;setBusy(false)}}
  const party=state.party
  const hasDetails=Boolean(party||state.invites.length)
  const filteredFriends=friends.filter(friend=>`${friend.displayName||''} ${friend.username||''}`.toLowerCase().includes(inviteSearch.trim().toLowerCase()))
  const partyFull=Boolean(party&&party.members.length>=Number(party.maxPartySize||5))
  return <div className="w-full font-mono sm:w-auto">
    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
      {!party&&<Button size="sm" disabled={busy} onClick={()=>void act(()=>partyAPI.create(),'Party created')} className="bg-orange-600 text-black hover:bg-orange-500"><Users className="mr-2 size-4"/>CREATE PARTY</Button>}
      {party&&<Button type="button" size="sm" variant="outline" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} className="border-green-800/50 text-green-300"><Users className="mr-2 size-4"/>PARTY {party.members.length}<Badge variant="outline" className="ml-2 border-orange-800/40 text-orange-300">{party.queue_status.toUpperCase()}</Badge><ChevronDown className={`ml-2 size-4 transition-transform ${expanded?'rotate-180':''}`}/></Button>}
      {!party&&state.invites.length>0&&<Button type="button" size="sm" variant="outline" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{state.invites.length} PARTY INVITE{state.invites.length===1?'':'S'}<ChevronDown className={`ml-2 size-4 transition-transform ${expanded?'rotate-180':''}`}/></Button>}
    </div>
    {connectionIssue&&<div role="status" className="mt-2 flex items-center gap-2 text-xs text-amber-300"><AlertTriangle className="size-3.5 shrink-0"/><span>{connectionIssue==='authentication'?'Party access is unavailable for this session.':'Party connection interrupted. Retrying…'}</span></div>}
    {hasDetails&&expanded&&<div className="absolute left-4 right-4 top-full z-30 mt-2 space-y-4 rounded border border-orange-900/35 bg-black/95 p-4 text-left shadow-xl sm:left-auto sm:right-0 sm:w-[min(36rem,calc(100vw-2rem))]">
      {state.invites.map(invite=><div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-orange-900/30 bg-black/40 p-3"><span className="text-sm text-gray-300">{invite.display_name||invite.username} invited you{invite.selected_game_id?` · ${String(invite.selected_game_id).toUpperCase()} ${invite.selected_game_mode||''}`:''}{Number.isFinite(Number(invite.member_count))?` · ${invite.member_count} member${Number(invite.member_count)===1?'':'s'}`:''}</span><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void act(()=>partyAPI.respond(invite.id,'accept'),'Party invite accepted')}>ACCEPT</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void act(()=>partyAPI.respond(invite.id,'decline'),'Party invite declined')}><X className="size-4"/></Button></div></div>)}
      {party&&<>
      <div className="grid gap-2">{party.members.map(member=>{const presence=member.presence_status||(member.is_online?'online':'offline');return <div key={member.user_id} className="flex items-center gap-3 rounded border border-orange-900/20 bg-black/35 p-2"><Avatar className="size-9"><AvatarImage src={member.avatar}/><AvatarFallback>{(member.display_name||member.username)[0]}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm text-gray-200">{member.display_name||member.username}</span>{member.user_id===party.leader_id&&<Crown className="size-4 text-amber-300"/>}<Badge variant="outline" className={presence==='in_match'?'border-orange-800 text-orange-300':presence==='online'?'border-green-800 text-green-300':presence==='away'?'border-amber-800 text-amber-300':'text-gray-500'}>{presence==='in_match'?'IN MATCH':presence.toUpperCase()}</Badge><Badge variant="outline" className={member.ready?'border-green-800 text-green-300':'border-gray-700 text-gray-500'}>{member.ready?'READY':'NOT READY'}</Badge>{party.isLeader&&member.user_id!==party.leader_id&&<><Button size="icon" variant="ghost" title="Transfer leader" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.transfer(member.user_id),'Leader transferred')}><ShieldCheck className="size-4"/></Button><Button size="icon" variant="ghost" title="Kick member" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.kick(member.user_id),'Member removed')}><UserMinus className="size-4"/></Button></>}</div>})}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.ready(!party.members.find(member=>member.user_id===user?.id)?.ready),'Ready state updated')}>READY / NOT READY</Button><Button variant="outline" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>party.isLeader?partyAPI.disband():partyAPI.leave(),party.isLeader?'Party disbanded':'Party left')}><LogOut className="mr-2 size-4"/>{party.isLeader?'DISBAND':'LEAVE'}</Button>{party.isLeader&&<Button variant="outline" disabled={busy||party.queue_status!=='idle'||partyFull} title={partyFull?'Party is full for the selected mode.':party.queue_status!=='idle'?'Party invites are locked while queued.':undefined} onClick={()=>setInviteOpen(value=>!value)}><Users className="mr-2 size-4"/>{partyFull?'PARTY FULL':'INVITE FRIENDS'}</Button>}</div>
      {party.isLeader&&inviteOpen&&!partyFull&&<div className="space-y-2 rounded border border-orange-900/25 bg-black/35 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500"/><Input value={inviteSearch} onChange={event=>setInviteSearch(event.target.value)} placeholder="Search friends..." className="h-9 pl-9"/></div>{friends.length===0?<p className="py-3 text-center text-xs text-gray-500">No friends available to invite.</p>:filteredFriends.length===0?<p className="py-3 text-center text-xs text-gray-500">No friends match this search.</p>:<div className="max-h-48 space-y-2 overflow-y-auto">{filteredFriends.map(friend=>{const member=party.members.some(item=>item.user_id===friend.userId),pending=state.outgoingInvites?.some(invite=>invite.invitee_id===friend.userId),presence=friend.presenceStatus||(friend.isOnline?'online':'offline');return <div key={friend.userId} className="flex items-center gap-2 rounded border border-orange-900/20 p-2"><span className={`size-2 rounded-full ${presence==='in_match'?'bg-orange-400':presence==='online'?'bg-green-400':presence==='away'?'bg-amber-400':'bg-gray-600'}`}/><span className="min-w-0 flex-1 truncate text-xs text-gray-300">{friend.displayName||friend.username}</span><span className="text-[10px] text-gray-500">{presence==='in_match'?'IN MATCH':String(presence).toUpperCase()}</span>{member?<Badge variant="outline">IN PARTY</Badge>:pending?<Badge variant="outline" className="border-amber-700/40 text-amber-300">INVITED</Badge>:<Button size="sm" variant="outline" disabled={busy} onClick={()=>void act(()=>partyAPI.invite(friend.userId),`Invite sent to ${friend.displayName||friend.username}`)}>INVITE</Button>}</div>})}</div>}</div>}
      {(party.selected_game_id||party.selected_game_mode)&&<p className="font-mono text-xs text-gray-500">{party.selected_game_id?.toUpperCase()} · {party.selected_game_mode} · TEAM {party.selected_team_size||'—'}</p>}
      </>}
    </div>}
  </div>
}
