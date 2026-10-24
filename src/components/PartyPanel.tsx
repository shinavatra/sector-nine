import{useCallback,useEffect,useState}from'react'
import{Crown,LogOut,ShieldCheck,UserMinus,Users,X}from'lucide-react'
import{toast}from'sonner'
import{friendsAPI,partyAPI}from'../utils/api'
import{useUser}from'../contexts/UserContext'
import{Avatar,AvatarFallback,AvatarImage}from'./ui/avatar'
import{Badge}from'./ui/badge'
import{Button}from'./ui/button'
import{Card,CardContent,CardHeader,CardTitle}from'./ui/card'

type Member={user_id:string;display_name:string;username:string;avatar?:string;ready:boolean;is_online:boolean}
type Party={id:string;leader_id:string;queue_status:string;selected_game_id?:string;selected_game_mode?:string;selected_team_size?:number;members:Member[];isLeader:boolean}

export function PartyPanel(){
  const{user}=useUser()
  const[state,setState]=useState<{party:Party|null;invites:any[]}>({party:null,invites:[]}),[friends,setFriends]=useState<any[]>([]),[busy,setBusy]=useState(false)
  const load=useCallback(async()=>{try{setState(await partyAPI.get())}catch{}},[])
  useEffect(()=>{void load();const timer=window.setInterval(load,5000);return()=>window.clearInterval(timer)},[load])
  useEffect(()=>{if(state.party?.isLeader)friendsAPI.getFriends().then(data=>setFriends(data.friends||[])).catch(()=>setFriends([]));else setFriends([])},[state.party?.isLeader])
  const act=async(action:()=>Promise<any>,message:string)=>{setBusy(true);try{const result=await action();if(result?.party!==undefined)setState(result);else await load();toast.success(message)}catch(error:any){toast.error(message,{description:error.message})}finally{setBusy(false)}}
  const party=state.party
  return <Card className="mb-6 border-orange-900/30 bg-black/75"><CardHeader className="border-b border-orange-900/20"><CardTitle className="flex items-center justify-between font-mono text-green-400"><span className="flex items-center gap-2"><Users className="size-5"/>PARTY</span>{party&&<Badge variant="outline" className="border-orange-800/40 text-orange-300">{party.queue_status.toUpperCase()}</Badge>}</CardTitle></CardHeader><CardContent className="space-y-4 p-4">
    {state.invites.map(invite=><div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-orange-900/30 bg-black/40 p-3"><span className="text-sm text-gray-300">{invite.display_name||invite.username} invited you</span><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void act(()=>partyAPI.respond(invite.id,'accept'),'Party invite accepted')}>ACCEPT</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void act(()=>partyAPI.respond(invite.id,'decline'),'Party invite declined')}><X className="size-4"/></Button></div></div>)}
    {!party?<Button disabled={busy} onClick={()=>void act(()=>partyAPI.create(),'Party created')} className="w-full">CREATE PARTY</Button>:<>
      <div className="grid gap-2">{party.members.map(member=><div key={member.user_id} className="flex items-center gap-3 rounded border border-orange-900/20 bg-black/35 p-2"><Avatar className="size-9"><AvatarImage src={member.avatar}/><AvatarFallback>{(member.display_name||member.username)[0]}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm text-gray-200">{member.display_name||member.username}</span>{member.user_id===party.leader_id&&<Crown className="size-4 text-amber-300"/>}<Badge variant="outline" className={member.is_online?'border-green-800 text-green-300':'text-gray-500'}>{member.is_online?'LIVE':'OFFLINE'}</Badge><Badge variant="outline" className={member.ready?'border-green-800 text-green-300':'border-gray-700 text-gray-500'}>{member.ready?'READY':'NOT READY'}</Badge>{party.isLeader&&member.user_id!==party.leader_id&&<><Button size="icon" variant="ghost" title="Transfer leader" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.transfer(member.user_id),'Leader transferred')}><ShieldCheck className="size-4"/></Button><Button size="icon" variant="ghost" title="Kick member" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.kick(member.user_id),'Member removed')}><UserMinus className="size-4"/></Button></>}</div>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.ready(!party.members.find(member=>member.user_id===user?.id)?.ready),'Ready state updated')}>READY / NOT READY</Button><Button variant="outline" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>party.isLeader?partyAPI.disband():partyAPI.leave(),party.isLeader?'Party disbanded':'Party left')}><LogOut className="mr-2 size-4"/>{party.isLeader?'DISBAND':'LEAVE'}</Button></div>
      {party.isLeader&&friends.filter(friend=>!party.members.some(member=>member.user_id===friend.userId)).length>0&&<div><p className="mb-2 font-mono text-xs text-gray-500">INVITE FRIEND</p><div className="flex flex-wrap gap-2">{friends.filter(friend=>!party.members.some(member=>member.user_id===friend.userId)).map(friend=><Button key={friend.userId} size="sm" variant="outline" disabled={busy||party.queue_status!=='idle'} onClick={()=>void act(()=>partyAPI.invite(friend.userId),`Invite sent to ${friend.displayName||friend.username}`)}>{friend.displayName||friend.username}</Button>)}</div></div>}
      {(party.selected_game_id||party.selected_game_mode)&&<p className="font-mono text-xs text-gray-500">{party.selected_game_id?.toUpperCase()} · {party.selected_game_mode} · TEAM {party.selected_team_size||'—'}</p>}
    </>}
  </CardContent></Card>
}
