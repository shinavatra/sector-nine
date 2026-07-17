import { useEffect,useState } from 'react'
import { MoreHorizontal,Search,UserPlus,Users } from 'lucide-react'
import { toast } from 'sonner'
import { friendsAPI } from '../utils/api'
import { useUser } from '../contexts/UserContext'
import { Avatar,AvatarFallback,AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card,CardContent,CardHeader,CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Tabs,TabsContent,TabsList,TabsTrigger } from './ui/tabs'
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger } from './ui/dropdown-menu'
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from './ui/alert-dialog'

type Friend={id:string;userId:string;username:string;steam_avatar?:string;isOnline:boolean}
type Request={id:string;senderId:string;recipientId:string;username:string;avatar?:string;sentAt:string}

export function Friends({currentPlayerId:_currentPlayerId,currentPlayerName:_currentPlayerName}:{currentPlayerId:string;currentPlayerName:string}){
  const {refreshProfile,onlineFriends}=useUser()
  const [friends,setFriends]=useState<Friend[]>([])
  const [incoming,setIncoming]=useState<Request[]>([])
  const [outgoing,setOutgoing]=useState<Request[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [busy,setBusy]=useState<string|null>(null)
  const [remove,setRemove]=useState<Friend|null>(null)
  const [query,setQuery]=useState('')
  const [results,setResults]=useState<any[]>([])

  const load=async()=>{setLoading(true);setError(null);try{const data=await friendsAPI.getFriends();setFriends(data.friends||[]);setIncoming(data.incomingRequests||[]);setOutgoing(data.outgoingRequests||[])}catch(e){setFriends([]);setIncoming([]);setOutgoing([]);setError(e instanceof Error?e.message:'Unable to load friends')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  useEffect(()=>{const onlineIds=new Set(onlineFriends.map(friend=>friend.id));setFriends(previous=>previous.map(friend=>({...friend,isOnline:onlineIds.has(friend.userId)})))},[onlineFriends])
  const refresh=async()=>{await load();await refreshProfile().catch(()=>undefined)}
  const act=async(id:string,run:()=>Promise<any>,success:string)=>{setBusy(id);try{await run();toast.success(success);await refresh()}catch(e){toast.error('Friend action failed',{description:e instanceof Error?e.message:'The server rejected the action'})}finally{setBusy(null)}}
  const search=async(value:string)=>{setQuery(value);if(value.trim().length<2)return setResults([]);try{const data=await friendsAPI.searchUsers(value.trim());setResults(data.users||[])}catch(e){toast.error('Search failed',{description:e instanceof Error?e.message:undefined})}}

  return <Card className="bg-black/40 border-orange-900/20"><CardHeader><CardTitle className="flex items-center font-mono text-orange-400"><Users className="mr-2 size-5"/>FRIENDS MANAGEMENT</CardTitle></CardHeader><CardContent>
    <Tabs defaultValue={sessionStorage.getItem('open_friend_requests')==='1'?(sessionStorage.removeItem('open_friend_requests'),'requests'):'friends'}><TabsList className="grid w-full grid-cols-3 bg-black/40"><TabsTrigger value="friends">FRIENDS ({friends.length})</TabsTrigger><TabsTrigger value="requests">REQUESTS ({incoming.length+outgoing.length})</TabsTrigger><TabsTrigger value="search">FIND FRIENDS</TabsTrigger></TabsList>
      <TabsContent value="friends" className="mt-6 space-y-3">{loading?<State text="Loading friends..."/>:error?<State text={error} error/>:friends.length===0?<State text="No accepted friends yet."/>:friends.map(friend=><div key={friend.id} className="flex items-center justify-between rounded border border-orange-900/20 bg-black/20 p-3"><Identity avatar={friend.steam_avatar} name={friend.username}/><div className="flex items-center gap-2"><span aria-label={friend.isOnline?'Online':'Offline'} className={`size-2.5 rounded-full ${friend.isOnline?'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,.7)]':'bg-gray-600'}`}/><Badge variant="outline" className={friend.isOnline?'border-green-700/50 text-green-400':''}>{friend.isOnline?'ONLINE':'OFFLINE'}</Badge><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${friend.username}`}><MoreHorizontal className="size-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-orange-900/30 bg-black"><DropdownMenuItem onClick={()=>toast.info('Invite sent')}>Invite</DropdownMenuItem><DropdownMenuItem onClick={()=>toast.info('Open the chat widget to message this friend')}>Message</DropdownMenuItem><DropdownMenuItem className="text-red-400" onClick={()=>setRemove(friend)}>Remove Friend</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>)}</TabsContent>
      <TabsContent value="requests" className="mt-6 space-y-6">{loading?<State text="Loading requests..."/>:error?<State text={error} error/>:<><section className="space-y-3"><h3 className="font-mono text-sm text-orange-400">INCOMING</h3>{incoming.length===0?<State text="No incoming requests."/>:incoming.map(request=><div key={request.id} className="flex items-center justify-between rounded border border-orange-900/20 bg-black/20 p-3"><Identity avatar={request.avatar} name={request.username}/><div className="flex gap-2"><Button size="sm" disabled={busy===request.id} onClick={()=>act(request.id,()=>friendsAPI.acceptRequest(request.id),'Friend request accepted')}>ACCEPT</Button><Button size="sm" variant="outline" disabled={busy===request.id} onClick={()=>act(request.id,()=>friendsAPI.declineRequest(request.id),'Friend request declined')}>DECLINE</Button></div></div>)}</section><section className="space-y-3"><h3 className="font-mono text-sm text-orange-400">OUTGOING</h3>{outgoing.length===0?<State text="No outgoing requests."/>:outgoing.map(request=><div key={request.id} className="flex items-center justify-between rounded border border-orange-900/20 bg-black/20 p-3"><Identity avatar={request.avatar} name={request.username}/><div className="flex items-center gap-2"><Badge variant="outline">PENDING</Badge><Button size="sm" variant="outline" disabled={busy===request.id} onClick={()=>act(request.id,()=>friendsAPI.cancelRequest(request.id),'Friend request cancelled')}>CANCEL REQUEST</Button></div></div>)}</section></>}</TabsContent>
      <TabsContent value="search" className="mt-6 space-y-3"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-gray-500"/><Input className="pl-9" value={query} onChange={e=>void search(e.target.value)} placeholder="Search by username..."/></div>{results.map(player=><div key={player.id} className="flex items-center justify-between rounded border border-orange-900/20 bg-black/20 p-3"><Identity avatar={player.steam_avatar} name={player.username}/><Button size="sm" disabled={busy===player.id} onClick={()=>act(player.id,()=>friendsAPI.sendFriendRequest(player.id),'Friend request sent')}><UserPlus className="mr-2 size-4"/>ADD FRIEND</Button></div>)}</TabsContent>
    </Tabs>
    <AlertDialog open={Boolean(remove)} onOpenChange={open=>!open&&setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Friend</AlertDialogTitle><AlertDialogDescription>Remove {remove?.username} from your accepted friends?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>CANCEL</AlertDialogCancel><AlertDialogAction onClick={()=>{const friend=remove;setRemove(null);if(friend)void act(friend.id,()=>friendsAPI.removeFriend(friend.id),'Friend removed')}}>REMOVE FRIEND</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CardContent></Card>
}

function Identity({avatar,name}:{avatar?:string;name:string}){return <div className="flex items-center gap-3"><Avatar><AvatarImage src={avatar}/><AvatarFallback>{name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><span className="font-mono text-orange-300">{name}</span></div>}
function State({text,error=false}:{text:string;error?:boolean}){return <div className={`rounded border p-6 text-center font-mono text-sm ${error?'border-red-700/40 text-red-300':'border-orange-900/20 text-gray-500'}`}>{text}</div>}
