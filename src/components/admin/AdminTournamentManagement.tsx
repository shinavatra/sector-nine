import { useEffect,useState } from 'react'
import { Activity,AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { adminAPI } from '../../utils/adminApi'
import type { AdminRow } from './adminTypes'
import type { AdminTournamentAction } from './AdminTable'
import { displayPlayerName } from '../../utils/displayName'

type ManagedAction=Exclude<AdminTournamentAction,'view'>
type Props={row:AdminRow|null;action:ManagedAction|null;onClose:()=>void;onSaved:(tournament:AdminRow|null)=>void}
const titles={edit:'Edit tournament',rewards:'Edit rewards',maps:'Edit maps',gameMode:'Edit game mode',registration:'Edit registration',addPlayer:'Add player',removePlayer:'Remove player',start:'Start tournament',finish:'Finish tournament',cancel:'Cancel tournament',delete:'Delete tournament'} as const
const inputClass='mt-1 border-orange-900/30 bg-black/30'
const localDate=(value:any)=>value?new Date(value).toISOString().slice(0,16):''
const playerName=(player:any)=>displayPlayerName({display_name:player?.display_name,displayName:player?.displayName,username:player?.username},'Player')

export function AdminTournamentManagement({row,action,onClose,onSaved}:Props){
  const [detail,setDetail]=useState<any>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!row||!action)return;let live=true;setLoading(true);setError('');adminAPI.get(`/tournaments/${row.id}`).then(value=>live&&setDetail(value)).catch((e:any)=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false}},[row?.id,action])
  if(!row||!action)return null
  const tournament=detail?.tournament||row,participants=detail?.participants||[],availableUsers=detail?.availableUsers||[],availableGames=detail?.games||[{game_id:'hl1'}]
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries()),reason=String(data.reason||'');setSaving(true);setError('');try{let result:any
    if(action==='edit')result=await adminAPI.patch(`/tournaments/${row.id}/game`,{name:data.name,gameId:data.gameId,description:data.description,tournamentType:data.tournamentType,reason})
    if(action==='rewards')result=await adminAPI.patch(`/tournaments/${row.id}`,{entryFeePoints:Number(data.entryFeePoints),prizePoolPoints:Number(data.prizePoolPoints),prize1st:Number(data.prize1st),prize2nd:Number(data.prize2nd),prize3rd:Number(data.prize3rd),requiresVip:data.requiresVip==='true',reason})
    if(action==='maps')result=await adminAPI.patch(`/tournaments/${row.id}`,{maps:String(data.maps||'').split(/[\n,]/).map(value=>value.trim()).filter(Boolean),reason})
    if(action==='gameMode')result=await adminAPI.patch(`/tournaments/${row.id}`,{gameMode:data.gameMode,reason})
    if(action==='registration')result=await adminAPI.patch(`/tournaments/${row.id}`,{maxParticipants:Number(data.maxParticipants),registrationDeadline:data.registrationDeadline||null,startDate:data.startDate||null,endDate:data.endDate||null,reason})
    if(action==='addPlayer')result=await adminAPI.post(`/tournaments/${row.id}/participants`,{userId:data.userId,reason})
    if(action==='removePlayer')result=await adminAPI.delete(`/tournaments/${row.id}/participants/${data.userId}`,{reason})
    if(action==='start')result=await adminAPI.patch(`/tournaments/${row.id}`,{status:'in_progress',reason})
    if(action==='finish')result=await adminAPI.patch(`/tournaments/${row.id}`,{status:'completed',reason})
    if(action==='cancel')result=await adminAPI.patch(`/tournaments/${row.id}`,{status:'cancelled',reason})
    if(action==='delete'){const response:any=await adminAPI.delete(`/tournaments/${row.id}`,{reason});if(!response?.deleted)throw new Error('Backend did not confirm tournament deletion');toast.success('Tournament deleted');onSaved(null);onClose();return}
    if(!result?.tournament)throw new Error('Backend did not return the updated tournament');toast.success(`${titles[action]} completed`);onSaved(result.tournament);onClose()
  }catch(e:any){setError(e.message||'Tournament action failed')}finally{setSaving(false)}}
  const field=(name:string,label:string,value:any,type='text',required=true)=><label className="text-xs text-slate-400">{label}<Input name={name} type={type} defaultValue={value??''} required={required} className={inputClass}/></label>
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>{tournament.name} · {tournament.status}</DialogDescription></DialogHeader>{loading?<div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Activity className="animate-spin"/>Loading current tournament data…</div>:<form onSubmit={submit} className="space-y-4">
    {action==='edit'&&<>{field('name','Tournament name',tournament.name)}<label className="text-xs text-slate-400">Game<select name="gameId" defaultValue={tournament.game_id||'hl1'} className={`${inputClass} h-10 w-full rounded border px-3`}>{availableGames.map((game:any)=>{const id=String(game.game_id);return <option key={id} value={id}>{({hl1:'Half-Life 1',cs16:'Counter-Strike 1.6',l4d2:'Left 4 Dead 2',cod4:'Call of Duty 4 Promod'} as Record<string,string>)[id]}</option>})}</select></label><label className="text-xs text-slate-400">Description<textarea name="description" defaultValue={tournament.description||''} className={`${inputClass} min-h-24 w-full rounded border p-3`}/></label><label className="text-xs text-slate-400">Tournament format<select name="tournamentType" defaultValue={tournament.tournament_type||'single-elimination'} className={`${inputClass} h-10 w-full rounded border px-3`}>{['single-elimination','double-elimination','round-robin'].map(value=><option key={value}>{value}</option>)}</select></label></>}
    {action==='rewards'&&<><div className="grid gap-3 sm:grid-cols-2">{field('entryFeePoints','Entry fee',tournament.entry_fee_points??0,'number')}{field('prizePoolPoints','Prize pool',tournament.prize_pool_points??0,'number')}{field('prize1st','First place',tournament.prize_1st??0,'number')}{field('prize2nd','Second place',tournament.prize_2nd??0,'number')}{field('prize3rd','Third place',tournament.prize_3rd??0,'number')}</div><label className="text-xs text-slate-400">VIP requirement<select name="requiresVip" defaultValue={String(Boolean(tournament.requires_vip))} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="false">Open to all</option><option value="true">VIP required</option></select></label></>}
    {action==='maps'&&<label className="text-xs text-slate-400">Tournament maps (one per line or comma-separated)<textarea name="maps" defaultValue={(tournament.maps||[]).join('\n')} className={`${inputClass} min-h-40 w-full rounded border p-3 font-mono`}/></label>}
    {action==='gameMode'&&<label className="text-xs text-slate-400">Game mode<select name="gameMode" defaultValue={tournament.game_mode||'classic-deathmatch'} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="classic-deathmatch">Classic deathmatch</option><option value="instagib-mode">Instagib mode</option></select></label>}
    {action==='registration'&&<div className="grid gap-3 sm:grid-cols-2">{field('maxParticipants','Maximum participants',tournament.max_participants??0,'number')}{field('registrationDeadline','Registration deadline',localDate(tournament.registration_deadline),'datetime-local',false)}{field('startDate','Start date',localDate(tournament.start_date),'datetime-local',false)}{field('endDate','End date',localDate(tournament.end_date),'datetime-local',false)}</div>}
    {action==='addPlayer'&&<label className="text-xs text-slate-400">Player<select name="userId" required defaultValue="" className={`${inputClass} h-10 w-full rounded border px-3`}><option value="" disabled>Select an active player</option>{availableUsers.map((user:any)=><option key={user.id} value={user.id}>{playerName(user)} ({user.username})</option>)}</select></label>}
    {action==='removePlayer'&&<label className="text-xs text-slate-400">Registered player<select name="userId" required defaultValue="" className={`${inputClass} h-10 w-full rounded border px-3`}><option value="" disabled>Select a player</option>{participants.map((participant:any)=><option key={participant.user_id} value={participant.user_id}>{playerName(participant)} ({participant.username})</option>)}</select></label>}
    {['start','finish','cancel','delete'].includes(action)&&<div className={`rounded border p-3 text-sm ${['cancel','delete'].includes(action)?'border-red-500/30 bg-red-950/10 text-red-300':'border-orange-500/30 bg-orange-950/10 text-orange-200'}`}>{action==='start'?'Registration will close and the tournament will become active.':action==='finish'?'The tournament will be marked completed.':action==='cancel'?'The tournament will be cancelled.':'Deletion permanently removes the tournament and its participant registrations.'}</div>}
    {field('reason','Required administrative reason','')}{error&&<div className="flex gap-2 rounded border border-red-500/30 bg-red-950/10 p-3 text-xs text-red-300"><AlertTriangle size={15}/>{error}</div>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving||(action==='addPlayer'&&!availableUsers.length)||(action==='removePlayer'&&!participants.length)} variant={['cancel','delete'].includes(action)?'destructive':'default'}>{saving?'Saving…':action==='delete'?'Delete tournament':'Confirm change'}</Button></DialogFooter>
  </form>}</DialogContent></Dialog>
}
