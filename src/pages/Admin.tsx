import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { AdminDashboard } from '../components/admin/AdminDashboard'
import { AdminSidebar } from '../components/admin/AdminSidebar'
import { AdminSectionActions, type AdminSectionAction } from '../components/admin/AdminSectionActions'
import { AdminSystem } from '../components/admin/AdminSystem'
import { AdminTable, type AdminServerAction, type AdminUserAction } from '../components/admin/AdminTable'
import { AdminServerManagement } from '../components/admin/AdminServerManagement'
import { AdminUserManagement } from '../components/admin/AdminUserManagement'
import { AdminTopbar } from '../components/admin/AdminTopbar'
import { formatAdminValue, type AdminRow, type AdminSection } from '../components/admin/adminTypes'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { useUser } from '../contexts/UserContext'
import { AdminApiError, adminAPI } from '../utils/adminApi'
import '../styles/admin-layout.css'

type Confirmation={title:string;description:string;run:()=>Promise<void>}

const adminSections:AdminSection[]=['dashboard','users','servers','matchmaking','matches','tournaments','reports','bans','store','vip','badges','frames','logs','system']
const sectionFromPath=(pathname:string):AdminSection=>{
  const segment=pathname.replace(/^\/admin\/?/,'').split('/')[0]
  return adminSections.includes(segment as AdminSection)?segment as AdminSection:'dashboard'
}
const pathForSection=(section:AdminSection)=>section==='dashboard'?'/admin':`/admin/${section}`

function assertAdminPayload(section:AdminSection,value:any) {
  const valid=section==='dashboard' ? value?.cards&&value?.charts : section==='system' ? value?.database&&value?.api&&value?.cache&&Array.isArray(value?.settings) : ['store','badges','frames'].includes(section) ? Array.isArray(value?.badges)&&Array.isArray(value?.frames) : Array.isArray(value?.items)
  if(!valid)throw new AdminApiError(`Invalid response contract for /admin/${section}`,502,'INVALID_ADMIN_RESPONSE')
  return value
}

export function Admin({onNavigate}:{onNavigate:(page:string)=>void}) {
  const {user,logout}=useUser()
  const [section,setSection]=useState<AdminSection>(()=>sectionFromPath(window.location.pathname))
  const [data,setData]=useState<any>(null)
  const [dataSection,setDataSection]=useState<AdminSection|null>(null)
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState<AdminApiError|null>(null)
  const [errorSection,setErrorSection]=useState<AdminSection|null>(null)
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(1)
  const [selected,setSelected]=useState<AdminRow|null>(null)
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null)
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [createType,setCreateType]=useState<'user'|'server'|'tournament'|null>(null)
  const cache=useRef<Record<string,any>>({})
  const requestId=useRef(0)
  const [detail,setDetail]=useState<any>(null)
  const [detailLoading,setDetailLoading]=useState(false)
  const [detailError,setDetailError]=useState<AdminApiError|null>(null)
  const [userManagement,setUserManagement]=useState<{row:AdminRow;action:Exclude<AdminUserAction,'view'>}|null>(null)
  const [serverManagement,setServerManagement]=useState<{row:AdminRow;action:Exclude<AdminServerAction,'view'|'copy'>}|null>(null)

  const endpoint:Record<AdminSection,string>={dashboard:'/dashboard',users:`/users?page=${page}&includeDeleted=true&q=${encodeURIComponent(search)}`,servers:'/servers',matchmaking:'/queue',matches:'/matches',tournaments:'/tournaments',reports:'/reports',bans:'/bans',store:'/catalog',vip:`/users?page=${page}&q=${encodeURIComponent(search)}`,badges:'/catalog',frames:'/catalog',logs:`/logs?page=${page}&q=${encodeURIComponent(search)}`,system:'/system'}
  const load=useCallback(async()=>{const id=++requestId.current,key=`${section}:${endpoint[section]}`,cached=cache.current[key];if(cached){setData(cached);setDataSection(section)}else{setDataSection(null)}setLoading(!cached);setLoadError(null);setErrorSection(null);try{const value=assertAdminPayload(section,await adminAPI.get(endpoint[section]));if(id!==requestId.current)return;cache.current[key]=value;setData(value);setDataSection(section)}catch(error:any){if(id!==requestId.current)return;setDataSection(null);const apiError=error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unknown administration error',0,'CLIENT_ERROR');setLoadError(apiError);setErrorSection(section);toast.error('Unable to load administration data',{description:`${apiError.code}: ${apiError.message}`})}finally{if(id===requestId.current)setLoading(false)}},[endpoint[section],section])
  useEffect(()=>{const timer=window.setTimeout(load,['users','vip'].includes(section)?250:0);return()=>window.clearTimeout(timer)},[load,section])
  useEffect(()=>{setPage(1);setSelected(null);setSearch('')},[section])
  useEffect(()=>{
    const handlePopState=()=>{
      const next=sectionFromPath(window.location.pathname)
      const canonicalPath=pathForSection(next)
      if(window.location.pathname!==canonicalPath)window.history.replaceState({page:'admin',section:next},'',canonicalPath)
      setSection(next)
    }
    handlePopState()
    window.addEventListener('popstate',handlePopState)
    return()=>window.removeEventListener('popstate',handlePopState)
  },[])

  if(!user||user.role!=='admin')return <main className="grid min-h-screen place-items-center bg-[#080809] p-6"><div className="w-full max-w-lg rounded-lg border border-red-500/30 bg-red-950/10 p-8 text-center"><Shield className="mx-auto text-red-400"/><h1 className="mt-4 font-mono text-2xl text-slate-100">ACCESS DENIED</h1><p className="mt-2 text-sm text-slate-400">Administrator clearance is required.</p><Button variant="outline" className="mt-6 border-orange-900/30" onClick={()=>onNavigate('hub')}>Return to Hub</Button></div></main>

  const sectionData=dataSection===section?data:null
  const sectionError=errorSection===section?loadError:null
  const rows:AdminRow[]=!sectionData?[]:section==='badges'?sectionData.badges:section==='frames'?sectionData.frames:section==='store'?[...sectionData.badges.map((item:AdminRow)=>({...item,catalog:'badge'})),...sectionData.frames.map((item:AdminRow)=>({...item,catalog:'frame'}))]:sectionData.items
  const visibleRows=search.trim()?rows.filter(row=>Object.values(row).some(value=>String(value??'').toLowerCase().includes(search.trim().toLowerCase()))):rows
  const mutate=async(path:string,method:'post'|'patch'|'delete',body?:any)=>{try{await(method==='delete'?adminAPI.delete(path):adminAPI[method](path,body));toast.success('Administrative action completed');setSelected(null);await load()}catch(error:any){toast.error('Action failed',{description:error.message})}}
  const destructive=(title:string,description:string,run:()=>Promise<void>)=>setConfirmation({title,description,run})
  const selectSection=(next:AdminSection,replace=false)=>{
    const path=pathForSection(next)
    if(window.location.pathname!==path)window.history[replace?'replaceState':'pushState']({page:'admin',section:next},'',path)
    setSection(next)
    setSidebarOpen(false)
  }
  const sectionAction=(action:AdminSectionAction)=>{if(action==='clear_queue')return destructive('Clear full queue','Every currently queued player will be removed.',()=>mutate('/queue','delete'));if(action==='force_match'){const first=window.prompt('First queued user UUID'),second=window.prompt('Second queued user UUID');if(first&&second)void mutate('/queue/force-match','post',{userIds:[first,second]});return}if(action==='create_ban'){const userId=window.prompt('User UUID'),reason=window.prompt('Ban reason'),minutes=window.prompt('Duration minutes (empty for permanent)','1440');if(userId&&reason&&minutes!==null)void mutate('/bans','post',{userId,reason,durationMinutes:minutes?Number(minutes):null,permanent:!minutes});return}if(action==='create_badge'||action==='create_frame'){const type=action==='create_badge'?'badges':'frames',id=window.prompt(`${type.slice(0,-1)} ID`),name=window.prompt('Name');if(id&&name)void mutate(`/catalog/${type}`,'post',{id,name});return}if(action==='clear_cache')destructive('Clear Steam profile cache','Cached Steam check timestamps will be cleared and refreshed through normal profile checks.',()=>mutate('/system/cache/clear','post'))}
  const openDetails=async(row:AdminRow)=>{setSelected(row);setDetail(null);setDetailError(null);const path=['users','vip'].includes(section)?`/users/${row.id}`:section==='servers'?`/servers/${row.id}`:section==='tournaments'?`/tournaments/${row.id}`:null;if(!path)return setDetail(row);setDetailLoading(true);try{setDetail(await adminAPI.get(path))}catch(error:any){setDetailError(error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unable to load details',0,'CLIENT_ERROR'))}finally{setDetailLoading(false)}}
  const userAction=(row:AdminRow,action:AdminUserAction)=>{if(action==='view')void openDetails(row);else setUserManagement({row,action})}
  const updateUserRow=(updated:AdminRow)=>{setData((current:any)=>current&&dataSection===section&&Array.isArray(current.items)?{...current,items:current.items.map((item:AdminRow)=>item.id===updated.id?{...item,...updated,active_ban:updated.activeBan}:item)}:current);cache.current={}}
  const removeUserRow=(id:string)=>{setData((current:any)=>current&&dataSection==='users'&&Array.isArray(current.items)?{...current,items:current.items.filter((item:AdminRow)=>item.id!==id),total:Math.max(0,(current.total??current.items.length)-1)}:current);cache.current={}}
  const updateServerRow=(updated:AdminRow|null)=>{const id=serverManagement?.row.id;setData((current:any)=>current&&dataSection==='servers'&&Array.isArray(current.items)?{...current,items:updated?current.items.map((item:AdminRow)=>item.id===updated.id?updated:item):current.items.filter((item:AdminRow)=>item.id!==id),total:updated?current.total:Math.max(0,(current.total??current.items.length)-1)}:current);cache.current={}}
  const serverAction=async(row:AdminRow,action:AdminServerAction)=>{if(action==='view')return void openDetails(row);if(action==='copy'){try{await navigator.clipboard.writeText(`connect ${row.public_host}:${row.port}`);toast.success('Connect command copied')}catch(error:any){toast.error('Unable to copy connect command',{description:error.message})}return}setServerManagement({row,action})}

  return <div className="admin-root flex min-h-screen w-full bg-[#080809] font-mono text-slate-200">
    {sidebarOpen&&<button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={()=>setSidebarOpen(false)}/>} 
    <AdminSidebar section={section} onSelect={selectSection} onCreate={setCreateType} open={sidebarOpen} onClose={()=>setSidebarOpen(false)} onHub={()=>onNavigate('hub')} onLogout={()=>{logout();onNavigate('auth')}}/>
    <div className="admin-main flex min-w-0 flex-1 flex-col"><AdminTopbar section={section} user={user} search={search} onSearch={setSearch} onMenu={()=>setSidebarOpen(true)} onRefresh={load} onCreate={setCreateType} loading={loading}/>
      <main className="admin-content mx-auto w-full max-w-[1800px] flex-1 p-6">
        <AdminSectionActions section={section} onAction={sectionAction}/>
        {sectionError?<AdminLoadError error={sectionError} onRetry={load}/>
          :loading||!sectionData?<div className="grid h-[60vh] place-items-center"><div className="flex items-center gap-3 text-sm text-slate-500"><Activity size={18} className="animate-spin text-orange-400"/>Loading live administration data…</div></div>
          :section==='dashboard'?<AdminDashboard data={sectionData}/>
          :section==='system'?<AdminSystem data={sectionData} onRefresh={load} onSetting={async(key,value)=>{try{await adminAPI.put(`/system/settings/${key}`,{value});toast.success('Platform setting updated');await load()}catch(error:any){toast.error('Setting update failed',{description:error.message})}}}/>
          :<AdminTable section={section} rows={visibleRows} onSelect={['users','vip','servers','matchmaking','matches','reports','bans','badges','frames','store','tournaments','logs'].includes(section)?openDetails:undefined} onUserAction={section==='users'?userAction:undefined} onServerAction={section==='servers'?serverAction:undefined} page={page} total={sectionData?.total} limit={sectionData?.limit} onPage={setPage}/>} 
      </main>
    </div>
    <DetailDrawer section={section} row={selected} detail={detail} loading={detailLoading} error={detailError} onRetry={()=>selected&&openDetails(selected)} onClose={()=>{setSelected(null);setDetail(null)}} mutate={mutate} destructive={destructive}/>
    <AdminUserManagement row={userManagement?.row||null} action={userManagement?.action||null} currentUserId={user.id} onClose={()=>setUserManagement(null)} onSaved={updateUserRow} onDeleted={removeUserRow}/>
    <AdminServerManagement row={serverManagement?.row||null} action={serverManagement?.action||null} onClose={()=>setServerManagement(null)} onSaved={updateServerRow}/>
    <CreateDialog type={createType} onClose={()=>setCreateType(null)} onCreated={async(type)=>{setCreateType(null);selectSection(type==='user'?'users':type==='server'?'servers':'tournaments')}}/>
    <AlertDialog open={Boolean(confirmation)} onOpenChange={open=>!open&&setConfirmation(null)}><AlertDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-red-500/30 bg-[#111113]"><AlertDialogHeader><AlertDialogTitle className="text-red-300">{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>{confirmation?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-700 text-white hover:bg-red-600" onClick={async()=>{const run=confirmation?.run;setConfirmation(null);if(run)await run()}}>Confirm action</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function AdminLoadError({error,onRetry}:{error:AdminApiError;onRetry:()=>void}) {
  const title=error.status===401?'Authentication required':error.status===403?'Permission denied':error.code==='DATABASE_MIGRATION_REQUIRED'?'Database migration required':'Backend request failed'
  return <div className="grid min-h-[55vh] place-items-center"><div className="w-full max-w-2xl rounded-lg border border-red-500/30 bg-red-950/10 p-7"><AlertTriangle className="text-red-400"/><h2 className="mt-4 text-lg text-slate-100">{title}</h2><p className="mt-2 text-sm text-slate-400">This section could not load. The rest of the admin panel remains available, and no empty or default values have been substituted.</p><pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-red-900/30 bg-black/30 p-3 text-xs text-red-300">{error.code} (HTTP {error.status||'network'}){`\n`}{error.message}</pre><Button className="mt-5" variant="outline" onClick={onRetry}>Retry request</Button></div></div>
}

function CreateDialog({type,onClose,onCreated}:{type:'user'|'server'|'tournament'|null;onClose:()=>void;onCreated:(type:'user'|'server'|'tournament')=>Promise<void>}) {
  const [saving,setSaving]=useState(false)
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!type)return;const values=Object.fromEntries(new FormData(event.currentTarget).entries());setSaving(true);try{if(type==='user')await adminAPI.post('/users',values);if(type==='server')await adminAPI.post('/servers',{...values,port:Number(values.port),slots:Number(values.slots)});if(type==='tournament')await adminAPI.post('/tournaments',{...values,maxParticipants:Number(values.maxParticipants),entryFeePoints:Number(values.entryFeePoints),prizePoolPoints:Number(values.prizePoolPoints)});toast.success(`${type[0].toUpperCase()+type.slice(1)} created`);await onCreated(type)}catch(error:any){toast.error(`Unable to create ${type}`,{description:error.message})}finally{setSaving(false)}}
  const field=(name:string,label:string,typeName='text',required=true)=><label className="block text-xs text-slate-400">{label}<Input name={name} type={typeName} required={required} className="mt-2 border-orange-900/30 bg-black/30"/></label>
  return <Dialog open={Boolean(type)} onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>Create {type}</DialogTitle><DialogDescription>This record will be written to PostgreSQL and added to the admin audit log.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">{type==='user'&&<>{field('username','Username')}{field('email','Email','email')}{field('password','Temporary password','password')}<label className="block text-xs text-slate-400">Role<select name="role" className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="user">User</option><option value="admin">Administrator</option></select></label></>}{type==='server'&&<>{field('name','Server name')}{field('game','Game')}{field('region','Region')}{field('ip','IP address')}{field('port','Port','number')}{field('slots','Slots','number')}{field('playitTunnel','Playit tunnel','text',false)}</>}{type==='tournament'&&<>{field('id','Tournament ID')}{field('name','Tournament name')}{field('description','Description','text',false)}{field('maxParticipants','Maximum participants','number')}{field('entryFeePoints','Entry fee points','number',false)}{field('prizePoolPoints','Prize pool points','number',false)}{field('startDate','Start date','datetime-local',false)}</>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Creating…':'Create'}</Button></DialogFooter></form></DialogContent></Dialog>
}

function DetailDrawer({section,row,detail,loading,error,onRetry,onClose,mutate,destructive}:{section:AdminSection;row:AdminRow|null;detail:any;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void;mutate:(p:string,m:'post'|'patch'|'delete',b?:any)=>Promise<void>;destructive:(t:string,d:string,r:()=>Promise<void>)=>void}) {
  if(!row)return <Sheet open={false}/>
  if(loading)return <Sheet open onOpenChange={open=>!open&&onClose()}><SheetContent className="w-full border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl"><div className="grid h-full place-items-center text-slate-400"><Activity className="mr-2 animate-spin"/>Loading real PostgreSQL details...</div></SheetContent></Sheet>
  if(error)return <Sheet open onOpenChange={open=>!open&&onClose()}><SheetContent className="w-full border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl"><AdminLoadError error={error} onRetry={onRetry}/></SheetContent></Sheet>
  const response=detail
  row=(detail?.user||detail?.server||detail?.tournament||detail||row) as AdminRow
  return <Sheet open={Boolean(row)} onOpenChange={open=>!open&&onClose()}><SheetContent className="w-full overflow-y-auto border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl"><SheetHeader className="border-b border-orange-900/20 px-6 py-5"><SheetTitle className="text-orange-300">{row.username||row.name||'Record details'}</SheetTitle><SheetDescription>{section.toUpperCase()} · {row.id||'catalog record'}</SheetDescription></SheetHeader><div className="space-y-6 p-6"><dl className="grid gap-x-5 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)]">{Object.entries(row).slice(0,24).map(([key,value])=><div className="contents" key={key}><dt className="border-b border-orange-900/10 py-2 text-xs text-slate-600">{key.split('_').join(' ')}</dt><dd className="break-words border-b border-orange-900/10 py-2 text-xs text-slate-300">{formatAdminValue(value,key)}</dd></div>)}</dl>
    {response?.loginHistory&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Login history</h3>{response.loginHistory.length?response.loginHistory.map((item:any,index:number)=><p key={index} className="border-t border-orange-900/10 py-2 text-xs text-slate-400">{formatAdminValue(item.created_at,'created_at')} · {item.method} · {item.success?'success':'failed'}</p>):<p className="text-xs text-slate-500">No login history.</p>}</section>}
    {['users','vip'].includes(section)&&<section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Account access and cosmetics</h3><p>Owned badges: {formatAdminValue(row.owned_badges)}</p><p>Owned frames: {formatAdminValue(row.owned_frames)}</p><p>Profile visibility: {formatAdminValue(row.profile_visibility)}</p><p>Show online status: {formatAdminValue(row.show_online_status)}</p>{row.activeBan&&<div className="mt-3 rounded border border-red-500/30 bg-red-950/10 p-3 text-red-300">Active platform ban: {row.activeBan.reason} ({row.activeBan.expires_at?formatAdminValue(row.activeBan.expires_at,'expires_at'):'permanent'})</div>}</section>}
    {response?.matches&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Match history</h3><p className="text-xs text-slate-400">{response.matches.length} recent matches loaded from PostgreSQL.</p></section>}
    {response?.auditHistory&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Administrative history</h3>{response.auditHistory.length?response.auditHistory.map((item:any,index:number)=><p key={index} className="border-t border-orange-900/10 py-2 text-xs text-slate-400">{formatAdminValue(item.created_at,'created_at')} · {item.action}</p>):<p className="text-xs text-slate-500">No administrative actions recorded.</p>}</section>}
    {section==='matches'&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>mutate(`/matches/${row.id}`,'patch',{status:'in_progress'})}>Start / reopen</Button><Button variant="outline" onClick={()=>{const p1=window.prompt('Player one score',String(row.score_p1??0)),p2=window.prompt('Player two score',String(row.score_p2??0));if(p1!==null&&p2!==null)void mutate(`/matches/${row.id}`,'patch',{scoreP1:Number(p1),scoreP2:Number(p2)})}}>Edit score</Button><Button variant="outline" onClick={()=>{const map=window.prompt(`Selected map (${(row.maps||[]).join(', ')})`,String(row.selected_map??''));if(map)void mutate(`/matches/${row.id}`,'patch',{selectedMap:map})}}>Change map</Button><Button variant="outline" onClick={()=>{const serverId=window.prompt('Server UUID (empty to unassign)',String(row.server_id??''));if(serverId!==null)void mutate(`/matches/${row.id}`,'patch',{serverId:serverId||null})}}>Reassign server</Button><Button variant="outline" onClick={()=>{const winnerId=window.prompt('Winner user UUID',String(row.player1_id??''));if(winnerId)destructive('Force match result','This completes the match with the selected winner and current scores.',()=>mutate(`/matches/${row.id}`,'patch',{status:'completed',winnerId,reason:'Forced admin result'}))}}>Force result</Button><Button variant="destructive" onClick={()=>destructive('Cancel match','Players will be released from this match.',()=>mutate(`/matches/${row.id}`,'patch',{status:'cancelled',reason:'Administrative cancellation'}))}>Cancel match</Button></div>}
    {section==='reports'&&<div className="grid gap-2 sm:grid-cols-2">{['resolve','warning','mute','temporary_ban','permanent_ban','dismiss'].map(action=><Button variant={action.includes('ban')?'destructive':'outline'} key={action} onClick={()=>{const notes=window.prompt('Required admin notes / reason');if(notes)destructive(`${action.split('_').join(' ')} report`,'This moderation decision is recorded in the audit log.',()=>mutate(`/reports/${row.id}/action`,'post',{action,notes,durationMinutes:1440}))}}>{action.split('_').join(' ')}</Button>)}</div>}
    {section==='bans'&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{const reason=window.prompt('Ban reason',String(row.reason??''));if(reason)void mutate(`/bans/${row.id}`,'patch',{reason})}}>Edit reason</Button><Button variant="outline" onClick={()=>{const expiresAt=window.prompt('Expiration (ISO timestamp, empty for permanent)',row.expires_at?new Date(row.expires_at).toISOString():'');if(expiresAt!==null)void mutate(`/bans/${row.id}`,'patch',{expiresAt})}}>Edit expiration</Button><Button variant="outline" onClick={()=>void mutate(`/bans/${row.id}`,'patch',{isActive:!row.is_active})}>{row.is_active?'Deactivate':'Reactivate'}</Button>{row.is_active&&<Button variant="destructive" onClick={()=>destructive('Lift ban','The player will regain access immediately.',()=>mutate(`/bans/${row.id}`,'delete'))}>Remove ban</Button>}</div>}
    {section==='tournaments'&&<section className="space-y-3"><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{const name=window.prompt('Tournament name',String(row.name??'')),fee=window.prompt('Entry fee',String(row.entry_fee_points??0)),prize=window.prompt('Prize pool',String(row.prize_pool_points??0));if(name&&fee!==null&&prize!==null)void mutate(`/tournaments/${row.id}`,'patch',{name,entryFeePoints:Number(fee),prizePoolPoints:Number(prize)})}}>Edit</Button><Button variant="outline" onClick={()=>{const userId=window.prompt('Participant user UUID');if(userId)void mutate(`/tournaments/${row.id}/participants`,'post',{userId})}}>Add participant</Button><Button variant="outline" onClick={()=>mutate(`/tournaments/${row.id}`,'patch',{status:'in_progress'})}>Start</Button><Button variant="outline" onClick={()=>destructive('Finish tournament','This marks the tournament completed.',()=>mutate(`/tournaments/${row.id}`,'patch',{status:'completed'}))}>Finish</Button><Button variant="outline" onClick={()=>destructive('Cancel tournament','This marks the tournament cancelled.',()=>mutate(`/tournaments/${row.id}`,'patch',{status:'cancelled'}))}>Cancel</Button><Button variant="destructive" onClick={()=>destructive('Delete tournament','The tournament and participant rows will be permanently removed.',()=>mutate(`/tournaments/${row.id}`,'delete'))}>Delete</Button></div><div className="rounded border border-orange-900/20 p-3"><h3 className="mb-2 text-xs uppercase text-orange-400">Participants</h3>{response?.participants?.length?response.participants.map((participant:any)=><div key={participant.user_id} className="flex items-center justify-between border-t border-orange-900/10 py-2 text-xs"><span>{participant.display_name||participant.username}</span><Button size="sm" variant="outline" onClick={()=>destructive('Remove participant',`Remove ${participant.username} from this tournament?`,()=>mutate(`/tournaments/${row.id}/participants/${participant.user_id}`,'delete'))}>Remove</Button></div>):<p className="text-xs text-slate-500">No participants registered.</p>}</div></section>}
  </div></SheetContent></Sheet>
}
