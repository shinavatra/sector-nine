import { useEffect,useState } from 'react'
import { Activity,AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { adminAPI } from '../../utils/adminApi'
import type { AdminRow } from './adminTypes'
import type { AdminMatchAction } from './AdminTable'
import { displayPlayerName } from '../../utils/displayName'

type ManagedAction=Exclude<AdminMatchAction,'view'>
type Props={row:AdminRow|null;action:ManagedAction|null;onClose:()=>void;onSaved:(match:AdminRow|null)=>void}
const titles={score:'Edit score',winner:'Change winner',status:'Edit match status',players:'Edit players',server:'Assign / remove server',cancel:'Cancel match',finish:'Force finish',delete:'Delete match'} as const
const inputClass='mt-1 border-orange-900/30 bg-black/30'
const playerName=(player:any,fallback='Player')=>displayPlayerName({display_name:player?.display_name,displayName:player?.displayName,username:player?.username},fallback)

export function AdminMatchManagement({row,action,onClose,onSaved}:Props){
  const [detail,setDetail]=useState<any>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!row||!action)return;let live=true;setLoading(true);setError('');adminAPI.get(`/matches/${row.id}`).then(value=>live&&setDetail(value)).catch((e:any)=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false}},[row?.id,action])
  if(!row||!action)return null
  const match=detail?.match||row,users=detail?.users||[],servers=detail?.servers||[]
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries()),reason=String(data.reason||'');setSaving(true);setError('');try{let result:any
    if(action==='score')result=await adminAPI.patch(`/matches/${row.id}`,{scoreP1:Number(data.scoreP1),scoreP2:Number(data.scoreP2),reason})
    if(action==='winner')result=await adminAPI.patch(`/matches/${row.id}`,{winnerId:data.winnerId,reason})
    if(action==='status')result=await adminAPI.patch(`/matches/${row.id}`,{status:data.status,reason})
    if(action==='players')result=await adminAPI.patch(`/matches/${row.id}`,{player1Id:data.player1Id,player2Id:data.player2Id,...(match.status==='completed'?{winnerId:data.winnerId}:{}),reason})
    if(action==='server')result=await adminAPI.patch(`/matches/${row.id}`,{serverId:data.serverId||null,reason})
    if(action==='cancel')result=await adminAPI.patch(`/matches/${row.id}`,{status:'cancelled',reason})
    if(action==='finish')result=await adminAPI.patch(`/matches/${row.id}`,{status:'completed',winnerId:data.winnerId,scoreP1:Number(data.scoreP1),scoreP2:Number(data.scoreP2),reason})
    if(action==='delete'){const response:any=await adminAPI.delete(`/matches/${row.id}`,{reason});if(!response?.deleted)throw new Error('Backend did not confirm match deletion');toast.success('Match deleted');onSaved(null);onClose();return}
    if(!result?.match)throw new Error('Backend did not return the updated match');toast.success(`${titles[action]} completed`);onSaved(result.match);onClose()
  }catch(e:any){setError(e.message||'Match action failed')}finally{setSaving(false)}}
  const field=(name:string,label:string,value:any,type='text')=><label className="text-xs text-slate-400">{label}<Input name={name} type={type} defaultValue={value??''} required className={inputClass}/></label>
  const userOptions=(selected?:string)=><>{users.map((user:any)=><option key={user.id} value={user.id}>{playerName(user)} ({user.username})</option>)}{selected&&!users.some((user:any)=>user.id===selected)&&<option value={selected}>{selected}</option>}</>
  const reasonField=field('reason','Required administrative reason','')
  const playerOne=displayPlayerName({display_name:match.player1_display_name,username:match.player1_username},'Player one')
  const playerTwo=displayPlayerName({display_name:match.player2_display_name,username:match.player2_username},'Player two')
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>{playerOne} vs {playerTwo} · {match.status}</DialogDescription></DialogHeader>{loading?<div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Activity className="animate-spin"/>Loading current match data…</div>:<form onSubmit={submit} className="space-y-4">
    {action==='score'&&<div className="grid gap-3 sm:grid-cols-2">{field('scoreP1',playerOne,match.score_p1,'number')}{field('scoreP2',playerTwo,match.score_p2,'number')}</div>}
    {action==='winner'&&<label className="text-xs text-slate-400">Winner<select name="winnerId" required defaultValue={match.winner_id||''} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="">Select winner</option>{[match.player1_id,match.player2_id].map((id:string,index:number)=><option key={id} value={id}>{index===0?playerOne:playerTwo} ({id})</option>)}</select></label>}
    {action==='status'&&<label className="text-xs text-slate-400">Status<select name="status" defaultValue={match.status} className={`${inputClass} h-10 w-full rounded border px-3`}>{['pending','in_progress','completed','cancelled'].map(value=><option key={value} value={value}>{value}</option>)}</select>{!match.winner_id&&<span className="mt-2 block text-amber-400">Use Force finish to complete a match that does not yet have a winner.</span>}</label>}
    {action==='players'&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Player one<select name="player1Id" required defaultValue={match.player1_id} className={`${inputClass} h-10 w-full rounded border px-3`}>{userOptions(match.player1_id)}</select></label><label className="text-xs text-slate-400">Player two<select name="player2Id" required defaultValue={match.player2_id} className={`${inputClass} h-10 w-full rounded border px-3`}>{userOptions(match.player2_id)}</select></label>{match.status==='completed'&&<label className="text-xs text-slate-400 sm:col-span-2">Winner after player change<select name="winnerId" required defaultValue={match.winner_id||''} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="">Select winner</option>{userOptions(match.winner_id)}</select></label>}</div>}
    {action==='server'&&<label className="text-xs text-slate-400">Server<select name="serverId" defaultValue={match.server_id||''} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="">No server / remove current server</option>{servers.map((server:any)=><option key={server.id} value={server.id}>{server.name} · {server.public_host}:{server.port} · {server.status}</option>)}</select>{['completed','cancelled'].includes(match.status)&&<span className="mt-2 block text-amber-400">Completed or cancelled matches cannot hold a server assignment.</span>}</label>}
    {action==='cancel'&&<div className="rounded border border-red-500/30 bg-red-950/10 p-3 text-sm text-red-300">Cancelling releases the assigned server and reverses recorded completion statistics.</div>}
    {action==='finish'&&<><label className="text-xs text-slate-400">Winner<select name="winnerId" required defaultValue={match.winner_id||match.player1_id} className={`${inputClass} h-10 w-full rounded border px-3`}>{[match.player1_id,match.player2_id].map((id:string,index:number)=><option key={id} value={id}>{index===0?playerOne:playerTwo}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2">{field('scoreP1',playerOne,match.score_p1,'number')}{field('scoreP2',playerTwo,match.score_p2,'number')}</div></>}
    {action==='delete'&&<div className="rounded border border-red-500/30 bg-red-950/10 p-3 text-sm text-red-300">Deletion is permanent. Any recorded completion statistics and server assignment will be reversed first.</div>}
    {reasonField}{error&&<div className="flex gap-2 rounded border border-red-500/30 bg-red-950/10 p-3 text-xs text-red-300"><AlertTriangle size={15}/>{error}</div>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving||(action==='server'&&['completed','cancelled'].includes(match.status)&&!match.server_id)} variant={['cancel','delete'].includes(action)?'destructive':'default'}>{saving?'Saving…':action==='delete'?'Delete match':'Confirm change'}</Button></DialogFooter>
  </form>}</DialogContent></Dialog>
}
