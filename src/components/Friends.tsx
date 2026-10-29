import { useCallback,useEffect,useRef,useState } from 'react'
import type { ReactNode } from 'react'
import { Search,UserMinus,UserPlus,Users } from 'lucide-react'
import { toast } from 'sonner'
import { friendsAPI } from '../utils/api'
import { notifyNotificationsChanged } from '../utils/notificationEvents'
import { Avatar,AvatarFallback,AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card,CardContent,CardHeader,CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Tabs,TabsContent,TabsList,TabsTrigger } from './ui/tabs'
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from './ui/alert-dialog'
import { displayPlayerName,playerInitials } from '../utils/displayName'

type PlayerIdentity={id?:string;userId?:string;username:string;displayName?:string;steam_avatar?:string;avatar?:string;level?:number;isOnline?:boolean}
type Friend=PlayerIdentity&{id:string;userId:string;isOnline:boolean}
type Request=PlayerIdentity&{id:string;senderId:string;recipientId:string;sentAt:string}
type SearchPlayer=PlayerIdentity&{id:string;friendshipStatus:'none'|'request_sent'|'request_received'|'friends'|'blocked';requestId?:string|null;profileVisible?:boolean}

export function Friends({currentPlayerId,onNavigate}:{currentPlayerId:string;currentPlayerName:string;onNavigate?:(page:string)=>void}){
  const initialTab=sessionStorage.getItem('open_friend_requests')==='1'?'received':'friends'
  if(initialTab==='received')sessionStorage.removeItem('open_friend_requests')
  const [tab,setTab]=useState(initialTab)
  const [friends,setFriends]=useState<Friend[]>([])
  const [incoming,setIncoming]=useState<Request[]>([])
  const [outgoing,setOutgoing]=useState<Request[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [busy,setBusy]=useState<string|null>(null)
  const [remove,setRemove]=useState<Friend|null>(null)
  const [query,setQuery]=useState('')
  const [results,setResults]=useState<SearchPlayer[]>([])
  const [searching,setSearching]=useState(false)
  const searchRequest=useRef(0)
  const actionInFlight=useRef(false)

  const load=useCallback(async()=>{setLoading(true);setError(null);try{const data=await friendsAPI.getFriends();setFriends(data.friends||[]);setIncoming(data.incomingRequests||[]);setOutgoing(data.outgoingRequests||[])}catch(e){setFriends([]);setIncoming([]);setOutgoing([]);setError(e instanceof Error?e.message:'Unable to load friends')}finally{setLoading(false)}},[])
  useEffect(()=>{void load()},[load])
  const openProfile=(id?:string)=>{if(id&&id!==currentPlayerId)onNavigate?.(`profile/${encodeURIComponent(id)}`)}
  const run=async(id:string,action:()=>Promise<any>,success:string,onSuccess?:(data:any)=>void)=>{if(actionInFlight.current)return null;actionInFlight.current=true;setBusy(id);try{const data=await action();onSuccess?.(data);toast.success(success);notifyNotificationsChanged(data?.unreadCount);await load();return data}catch(e){toast.error('Friend action failed',{description:e instanceof Error?e.message:'The server rejected the action'});return null}finally{actionInFlight.current=false;setBusy(null)}}
  const accept=async(request:Request)=>{await run(request.id,()=>friendsAPI.acceptRequest(request.id),'Friend request accepted',data=>setResults(previous=>previous.map(player=>player.id===request.senderId?{...player,friendshipStatus:'friends',requestId:data.friendship?.id}:player)))}
  const decline=async(request:Request)=>{await run(request.id,()=>friendsAPI.declineRequest(request.id),'Friend request declined',()=>setResults(previous=>previous.map(player=>player.id===request.senderId?{...player,friendshipStatus:'none',requestId:null}:player)))}
  const cancel=async(request:Request)=>{await run(request.id,()=>friendsAPI.cancelRequest(request.id),'Friend request cancelled',()=>setResults(previous=>previous.map(player=>player.id===request.recipientId?{...player,friendshipStatus:'none',requestId:null}:player)))}
  const send=async(player:SearchPlayer)=>{await run(player.id,()=>friendsAPI.sendFriendRequest(player.id),'Friend request sent',data=>setResults(previous=>previous.map(item=>item.id===player.id?{...item,friendshipStatus:'request_sent',requestId:data.request?.id}:item)))}
  const cancelSearchRequest=async(player:SearchPlayer)=>{if(!player.requestId)return;await cancel({id:player.requestId,senderId:currentPlayerId,recipientId:player.id,sentAt:''})}

  useEffect(()=>{const value=query.trim();const request=++searchRequest.current;if(value.length<2){setResults([]);setSearching(false);return}setSearching(true);const timer=window.setTimeout(async()=>{try{const data=await friendsAPI.searchUsers(value);if(request===searchRequest.current)setResults(data.users||[])}catch(e){if(request===searchRequest.current)toast.error('Search failed',{description:e instanceof Error?e.message:undefined})}finally{if(request===searchRequest.current)setSearching(false)}},300);return()=>window.clearTimeout(timer)},[query])

  return <Card className="friends-panel border-orange-900/20 bg-black/40"><CardHeader><CardTitle className="flex items-center font-mono text-orange-400"><Users className="mr-2 size-5"/>FRIENDS MANAGEMENT</CardTitle></CardHeader><CardContent>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-black/40 p-1 sm:grid-cols-4"><TabsTrigger className="min-h-10 whitespace-normal px-2 text-center text-xs" value="friends">FRIENDS ({friends.length})</TabsTrigger><TabsTrigger className="min-h-10 whitespace-normal px-2 text-center text-xs" value="received">RECEIVED ({incoming.length})</TabsTrigger><TabsTrigger className="min-h-10 whitespace-normal px-2 text-center text-xs" value="sent">SENT ({outgoing.length})</TabsTrigger><TabsTrigger className="min-h-10 whitespace-normal px-2 text-center text-xs" value="search">FIND PLAYERS</TabsTrigger></TabsList>
      <TabsContent value="friends" className="mt-5 space-y-3">{loading?<State text="Loading friends..."/>:error?<State text={error} error/>:friends.length===0?<State text="No accepted friends yet." action="SEARCH FOR PLAYERS" onAction={()=>setTab('search')}/>:friends.map(friend=><PlayerRow key={friend.id} player={friend} onProfile={()=>openProfile(friend.userId)} actions={<><Presence online={friend.isOnline}/><Button size="sm" variant="outline" onClick={()=>openProfile(friend.userId)}>PROFILE</Button><Button size="icon" variant="ghost" aria-label={`Remove ${displayPlayerName(friend)}`} onClick={()=>setRemove(friend)}><UserMinus className="size-4 text-red-400"/></Button></>}/>)}</TabsContent>
      <TabsContent value="received" className="mt-5 space-y-3">{loading?<State text="Loading received requests..."/>:error?<State text={error} error/>:incoming.length===0?<State text="No received requests."/>:incoming.map(request=><PlayerRow key={request.id} player={request} onProfile={()=>openProfile(request.senderId)} actions={<><Button size="sm" variant="outline" onClick={()=>openProfile(request.senderId)}>PROFILE</Button><Button size="sm" disabled={busy===request.id} onClick={()=>void accept(request)}>ACCEPT</Button><Button size="sm" variant="outline" disabled={busy===request.id} onClick={()=>void decline(request)}>DECLINE</Button></>}/>)}</TabsContent>
      <TabsContent value="sent" className="mt-5 space-y-3">{loading?<State text="Loading sent requests..."/>:error?<State text={error} error/>:outgoing.length===0?<State text="No sent requests." action="FIND PLAYERS" onAction={()=>setTab('search')}/>:outgoing.map(request=><PlayerRow key={request.id} player={request} onProfile={()=>openProfile(request.recipientId)} actions={<><Badge variant="outline">REQUEST SENT</Badge><Button size="sm" variant="outline" disabled={busy===request.id} onClick={()=>void cancel(request)}>CANCEL</Button></>}/>)}</TabsContent>
      <TabsContent value="search" className="mt-5 space-y-3"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-500"/><Input className="h-11 pl-10 pr-3 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/30" value={query} maxLength={64} onChange={event=>setQuery(event.target.value)} placeholder="Search username or display name..." aria-label="Search registered players"/></div>{searching?<State text="Searching players..."/>:query.trim().length<2?<State text="Enter at least two characters."/>:results.length===0?<State text="No visible players found."/>:results.map(player=><PlayerRow key={player.id} player={player} onProfile={player.profileVisible?()=>openProfile(player.id):undefined} actions={<SearchAction player={player} busy={busy===player.id||busy===player.requestId} onSend={()=>void send(player)} onCancel={()=>void cancelSearchRequest(player)} onAccept={()=>void accept({...player,id:String(player.requestId),senderId:player.id,recipientId:currentPlayerId,sentAt:''})} onProfile={()=>openProfile(player.id)}/>}/>)}</TabsContent>
    </Tabs>
    <AlertDialog open={Boolean(remove)} onOpenChange={open=>!open&&setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Friend</AlertDialogTitle><AlertDialogDescription>Remove {displayPlayerName(remove)} from your friends? Their account, statistics, and match history will not be changed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>CANCEL</AlertDialogCancel><AlertDialogAction onClick={()=>{const friend=remove;setRemove(null);if(friend)void run(friend.id,()=>friendsAPI.removeFriend(friend.id),'Friend removed')}}>REMOVE FRIEND</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CardContent></Card>
}

function SearchAction({player,busy,onSend,onCancel,onAccept,onProfile}:{player:SearchPlayer;busy:boolean;onSend:()=>void;onCancel:()=>void;onAccept:()=>void;onProfile:()=>void}){if(busy)return <Button size="sm" disabled aria-label="Friend action loading">LOADING...</Button>;if(player.friendshipStatus==='blocked')return <Button size="sm" variant="outline" disabled title="Friend requests are unavailable because this player is blocked.">BLOCKED</Button>;if(player.friendshipStatus==='friends')return <><Badge variant="outline" className="border-green-700/50 text-green-300">FRIENDS</Badge><Button size="sm" variant="outline" onClick={onProfile}>PROFILE</Button></>;if(player.friendshipStatus==='request_sent')return <Button size="sm" variant="outline" disabled={!player.requestId} title={player.requestId?undefined:'The pending request identifier is unavailable.'} onClick={onCancel}>CANCEL REQUEST</Button>;if(player.friendshipStatus==='request_received')return <Button size="sm" disabled={!player.requestId} title={player.requestId?undefined:'The incoming request identifier is unavailable.'} onClick={onAccept}>ACCEPT REQUEST</Button>;return <Button size="sm" onClick={onSend}><UserPlus className="mr-2 size-4"/>ADD FRIEND</Button>}
function PlayerRow({player,onProfile,actions}:{player:PlayerIdentity;onProfile?:()=>void;actions:ReactNode}){return <div className="flex min-w-0 flex-col gap-3 rounded border border-orange-900/20 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onProfile} disabled={!onProfile} className="min-w-0 text-left disabled:cursor-default"><Identity player={player}/></button><div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div></div>}
function Identity({player}:{player:PlayerIdentity}){const name=displayPlayerName(player);return <div className="flex min-w-0 items-center gap-3"><Avatar><AvatarImage src={player.steam_avatar||player.avatar}/><AvatarFallback>{playerInitials(player)}</AvatarFallback></Avatar><span className="min-w-0"><span className="block truncate font-mono text-sm text-orange-300">{name}</span>{player.username&&player.username!==name&&<span className="block truncate text-xs text-gray-500">@{player.username}</span>}{Number.isFinite(Number(player.level))&&<span className="block text-[11px] font-mono text-gray-500">LEVEL {player.level}</span>}</span></div>}
function Presence({online}:{online?:boolean}){return <Badge variant="outline" className={online?'border-green-700/50 text-green-400':'text-gray-500'}><span className={`mr-1.5 size-2 rounded-full ${online?'bg-green-400':'bg-gray-600'}`}/>{online?'ONLINE':'OFFLINE'}</Badge>}
function State({text,error=false,action,onAction}:{text:string;error?:boolean;action?:string;onAction?:()=>void}){return <div className={`rounded border p-5 text-center font-mono text-sm ${error?'border-red-700/40 text-red-300':'border-orange-900/20 text-gray-500'}`}><p>{text}</p>{action&&<Button size="sm" variant="outline" className="mt-3" onClick={onAction}>{action}</Button>}</div>}
