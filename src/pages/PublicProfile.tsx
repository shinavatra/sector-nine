import { useEffect,useState } from 'react'
import { ArrowLeft,Check,Loader2,ShieldCheck,UserMinus,UserPlus,X } from 'lucide-react'
import { toast } from 'sonner'
import { friendsAPI,userAPI } from '../utils/api'
import { useUser } from '../contexts/UserContext'
import { displayPlayerName,playerInitials } from '../utils/displayName'
import { RetroXpProgress } from '../components/RetroXpProgress'
import { FramedAvatar } from '../components/FramedAvatar'
import { Avatar,AvatarFallback,AvatarImage } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card,CardContent } from '../components/ui/card'
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from '../components/ui/alert-dialog'

export function PublicProfile({userId,onNavigate}:{userId:string;onNavigate?:(page:string)=>void}){
  const {user}=useUser()
  const [profile,setProfile]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [confirmRemove,setConfirmRemove]=useState(false)

  const load=async()=>{setLoading(true);try{const data:any=await userAPI.getPublicProfile(userId);setProfile(data.profile);setError('')}catch(error){setError(error instanceof Error?error.message:'Unable to load this profile')}finally{setLoading(false)}}
  useEffect(()=>{if(user?.id===userId){onNavigate?.('profile');return}void load()},[userId,user?.id])
  const act=async(action:()=>Promise<any>,success:string)=>{if(busy)return;setBusy(true);try{await action();toast.success(success);await load()}catch(error){toast.error('Friend action failed',{description:error instanceof Error?error.message:'The server rejected the action'})}finally{setBusy(false)}}

  if(loading)return <main className="page-container page-container-reading grid min-h-[55vh] place-items-center"><Loader2 className="size-8 animate-spin text-orange-400"/></main>
  if(error||!profile)return <main className="page-container page-container-reading mx-auto px-4 py-8"><Button variant="ghost" onClick={()=>onNavigate?.('configuration')}><ArrowLeft className="mr-2 size-4"/>BACK TO FRIENDS</Button><Card className="mt-6 border-red-800/40 bg-red-950/10"><CardContent className="p-6 text-center font-mono text-red-300">{error||'Profile unavailable'}</CardContent></Card></main>
  const name=displayPlayerName(profile)
  const friendshipAction=profile.friendshipStatus==='friends'?<><Badge variant="outline" className="border-green-700/50 text-green-300"><Check className="mr-1 size-3"/>FRIENDS</Badge><Button variant="outline" size="sm" disabled={busy} onClick={()=>setConfirmRemove(true)}><UserMinus className="mr-2 size-4"/>REMOVE</Button></>:profile.friendshipStatus==='request_sent'?<Button size="sm" disabled>REQUEST SENT</Button>:profile.friendshipStatus==='request_received'?<div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void act(()=>friendsAPI.acceptRequest(profile.friendshipId),'Friend request accepted')}><Check className="mr-2 size-4"/>ACCEPT</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void act(()=>friendsAPI.declineRequest(profile.friendshipId),'Friend request declined')}><X className="mr-2 size-4"/>DECLINE</Button></div>:<Button size="sm" disabled={busy} onClick={()=>void act(()=>friendsAPI.sendFriendRequest(profile.id),'Friend request sent')}><UserPlus className="mr-2 size-4"/>ADD FRIEND</Button>

  return <main className="page-container page-container-reading mx-auto px-4 py-8"><Button variant="ghost" onClick={()=>onNavigate?.('configuration')}><ArrowLeft className="mr-2 size-4"/>BACK TO FRIENDS</Button><Card className="mt-5 border-orange-900/20 bg-black/40"><CardContent className="space-y-6 p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start"><FramedAvatar frameId={profile.equippedFrame}><Avatar className="size-24 border-2 border-orange-900/40"><AvatarImage src={profile.resolvedAvatar}/><AvatarFallback>{playerInitials(profile)}</AvatarFallback></Avatar></FramedAvatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="truncate text-2xl font-semibold text-orange-300">{name}</h1>{profile.username!==name&&<p className="text-sm text-gray-500">@{profile.username}</p>}</div><div className="flex flex-wrap items-center gap-2">{friendshipAction}</div></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className={profile.isOnline?'border-green-700/50 text-green-300':'text-gray-500'}>{profile.isOnline?'ONLINE':'OFFLINE'}</Badge>{profile.steamVerified&&<Badge variant="outline" className="border-blue-700/40 text-blue-300"><ShieldCheck className="mr-1 size-3"/>STEAM VERIFIED</Badge>}</div></div></div>{profile.bio&&<p className="rounded border border-orange-900/20 bg-black/30 p-4 text-sm leading-6 text-gray-300">{profile.bio}</p>}<RetroXpProgress level={profile.level} totalXp={profile.experience}/><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Wins',profile.wins],['Losses',profile.losses],['Kills',profile.totalKills],['Deaths',profile.totalDeaths]].map(([label,value])=><div key={String(label)} className="rounded border border-orange-900/20 bg-black/30 p-3"><p className="font-mono text-xs text-gray-500">{label}</p><p className="mt-1 text-lg text-orange-200">{Number(value)||0}</p></div>)}</div></CardContent></Card><AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Friend</AlertDialogTitle><AlertDialogDescription>Remove {name} from your friends? Player data and match history are unaffected.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>CANCEL</AlertDialogCancel><AlertDialogAction onClick={()=>{setConfirmRemove(false);void act(()=>friendsAPI.removeFriend(profile.friendshipId),'Friend removed')}}>REMOVE FRIEND</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>
}
