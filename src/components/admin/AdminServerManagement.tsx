import { useEffect,useState } from 'react'
import { Activity,AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { adminAPI } from '../../utils/adminApi'
import { SUPPORTED_REGIONS, isSupportedRegionId } from '../../shared/regions'
import type { AdminRow } from './adminTypes'
import type { AdminServerAction } from './AdminTable'

type ManagedAction=Exclude<AdminServerAction,'view'|'copy'>
type Props={row:AdminRow|null;action:ManagedAction|null;onClose:()=>void;onSaved:(server:AdminRow|null)=>void}
const titles={edit:'Edit server',status:'Change server status',assign:'Assign active match',unassign:'Unassign match',delete:'Delete server'} as const
const inputClass='mt-1 border-orange-900/30 bg-black/30'

export function AdminServerManagement({row,action,onClose,onSaved}:Props){
  const [detail,setDetail]=useState<any>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!row||!action)return;let live=true;setLoading(true);setError('');adminAPI.get(`/servers/${row.id}`).then(value=>live&&setDetail(value)).catch((e:any)=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false}},[row?.id,action])
  if(!row||!action)return null
  const server=detail?.server||row,matches=detail?.activeMatches||[]
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());setSaving(true);setError('');try{let result:any
    if(action==='edit'){const rconPassword=String(data.rconPassword||''),clearRcon=data.clearRcon==='on';if(data.gameId!==server.game_id)await adminAPI.patch(`/servers/${row.id}/game`,{gameId:data.gameId});result=await adminAPI.patch(`/servers/${row.id}`,{game:data.game,region:data.region,name:data.name,publicHost:data.publicHost,port:Number(data.port),maxSlots:Number(data.maxSlots),playitTunnel:data.playitTunnel});if(rconPassword||clearRcon)result=await adminAPI.post(`/servers/${row.id}/rcon`,rconPassword?{password:rconPassword}:{clear:true})}
    if(action==='status')result=await adminAPI.post(`/servers/${row.id}/status`,{status:data.status})
    if(action==='assign')result=await adminAPI.post(`/servers/${row.id}/assign-match`,{matchId:data.matchId})
    if(action==='unassign')result=await adminAPI.post(`/servers/${row.id}/unassign-match`,{status:data.status})
    if(action==='delete'){await adminAPI.delete(`/servers/${row.id}`);toast.success('Server deleted');onSaved(null);onClose();return}
    if(!result?.server)throw new Error('Backend did not return the updated server');toast.success(`${titles[action]} completed`);onSaved(result.server);onClose()
  }catch(e:any){setError(e.message||'Server action failed')}finally{setSaving(false)}}
  const field=(name:string,text:string,type='text',value:any='',required=true)=><label className="text-xs text-slate-400">{text}<Input name={name} type={type} defaultValue={value??''} required={required} className={inputClass}/></label>
  const regionSelect=(value:unknown)=><label className="text-xs text-slate-400">Region<select name="region" required defaultValue={isSupportedRegionId(value)?value:SUPPORTED_REGIONS[0].id} className={`${inputClass} h-10 w-full rounded border px-3`}>{SUPPORTED_REGIONS.map(region=><option key={region.id} value={region.id}>{region.label}</option>)}</select></label>
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>{titles[action]}</DialogTitle><DialogDescription>{server.name} · {server.public_host}:{server.port}. Changes are persisted and audited.</DialogDescription></DialogHeader>{loading?<div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Activity className="animate-spin"/>Loading current server data…</div>:<form onSubmit={submit} className="space-y-4">
    {action==='edit'&&<><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Game ID<select name="gameId" defaultValue={server.game_id||'hl1'} className={`${inputClass} h-10 w-full rounded border px-3`}><option value="hl1">Half-Life 1 (hl1)</option><option value="cs16">Counter-Strike 1.6 (cs16)</option><option value="l4d2">Left 4 Dead 2 (l4d2)</option><option value="cod4">Call of Duty 4 Promod (cod4)</option></select></label>{field('game','Game','text',server.game||'Half-Life 1')}{regionSelect(server.region)}{field('name','Name','text',server.name)}{field('publicHost','Public host / IP','text',server.public_host)}{field('port','Port','number',server.port)}{field('maxSlots','Maximum slots','number',server.max_slots)}{field('playitTunnel','Playit tunnel','text',server.playit_tunnel,false)}{field('rconPassword',server.has_rcon?'Replace RCON password (write-only)':'Set RCON password (write-only)','password','',false)}</div><p className="rounded border border-orange-900/20 p-3 text-xs text-slate-400">RCON is {server.has_rcon?'configured':'not configured'}. The existing password is never returned to this page. Leave the password field empty to keep it unchanged.</p>{server.has_rcon&&<label className="flex gap-2 text-xs text-red-300"><input name="clearRcon" type="checkbox"/>Remove the configured RCON password</label>}</>}
    {action==='status'&&<label className="text-xs text-slate-400">Status<select name="status" defaultValue={server.status} className={`${inputClass} h-10 w-full rounded border px-3`}>{(server.current_match_id?['in_use']:['online','offline','maintenance']).map(value=><option key={value} value={value}>{value}</option>)}</select>{server.current_match_id&&<span className="mt-2 block text-amber-400">Unassign the current match before taking this server out of use.</span>}</label>}
    {action==='assign'&&<label className="text-xs text-slate-400">Active unassigned match<select name="matchId" required className={`${inputClass} h-10 w-full rounded border px-3`}><option value="">Select a match</option>{matches.map((match:any)=><option key={match.id} value={match.id}>{match.id} · {match.status} · {match.selected_map||'no map'}</option>)}</select>{!matches.length&&<span className="mt-2 block text-amber-400">No compatible active matches are available.</span>}</label>}
    {action==='unassign'&&<><p className="text-sm text-slate-300">Clear match {server.current_match_id} from this server and from the matching PostgreSQL row.</p><label className="text-xs text-slate-400">Status after unassign<select name="status" defaultValue="online" className={`${inputClass} h-10 w-full rounded border px-3`}><option value="online">Online</option><option value="offline">Offline</option></select></label></>}
    {action==='delete'&&<><div className="rounded border border-red-500/30 bg-red-950/10 p-3 text-sm text-red-300">Deletion is permanent. Assigned active servers must be unassigned first.</div><label className="flex gap-2 text-xs text-slate-400"><input name="confirmed" type="checkbox" required/>I confirm deletion of this unused server.</label></>}
    {error&&<div className="flex gap-2 rounded border border-red-500/30 bg-red-950/10 p-3 text-xs text-red-300"><AlertTriangle size={15}/>{error}</div>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving||(action==='assign'&&!matches.length)} variant={action==='delete'?'destructive':'default'}>{saving?'Saving…':action==='delete'?'Delete server':'Save change'}</Button></DialogFooter></form>}</DialogContent></Dialog>
}
