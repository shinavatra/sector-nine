import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Copy, KeyRound, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { AdminDashboard } from '../components/admin/AdminDashboard'
import { AdminSidebar } from '../components/admin/AdminSidebar'
import { AdminSectionActions, type AdminSectionAction } from '../components/admin/AdminSectionActions'
import { AdminSystem } from '../components/admin/AdminSystem'
import { AdminTable, type AdminBanAction, type AdminHostAction, type AdminMatchAction, type AdminReportAction, type AdminServerAction, type AdminStoreAction, type AdminTournamentAction, type AdminUserAction } from '../components/admin/AdminTable'
import { AdminMatchManagement } from '../components/admin/AdminMatchManagement'
import { AdminNewsManagement } from '../components/admin/AdminNewsManagement'
import { AdminModerationManagement } from '../components/admin/AdminModerationManagement'
import { AdminServerManagement } from '../components/admin/AdminServerManagement'
import { AdminStoreManagement, type CatalogType } from '../components/admin/AdminStoreManagement'
import { AdminTournamentManagement } from '../components/admin/AdminTournamentManagement'
import { AdminUserManagement } from '../components/admin/AdminUserManagement'
import { AdminTopbar } from '../components/admin/AdminTopbar'
import { formatAdminValue, type AdminRow, type AdminSection } from '../components/admin/adminTypes'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { useUser } from '../contexts/UserContext'
import { SUPPORTED_REGIONS } from '../shared/regions'
import { AdminApiError, adminAPI } from '../utils/adminApi'
import { displayPlayerName } from '../utils/displayName'
import '../styles/admin-layout.css'

type Confirmation={title:string;description:string;run:()=>Promise<void>}
type LogFilters={admin:string;action:string;target:string;dateFrom:string;dateTo:string}
type VipDetailResponse={user:AdminRow}
type LogDetailResponse={log:AdminRow}
type TournamentDetailResponse={tournament:AdminRow;participants:AdminRow[];availableUsers:AdminRow[];auditHistory:AdminRow[]}
const emptyLogFilters:LogFilters={admin:'',action:'',target:'',dateFrom:'',dateTo:''}

const adminSections:AdminSection[]=['dashboard','news','users','hosts','servers','matchmaking','matches','tournaments','reports','support','bans','store','vip','badges','frames','logs','system']
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

export function Admin({onNavigate,onPlatformSettingsSaved}:{onNavigate:(page:string)=>void;onPlatformSettingsSaved?:()=>Promise<void>}) {
  const {user,logout,refreshProfile}=useUser()
  const [section,setSection]=useState<AdminSection>(()=>sectionFromPath(window.location.pathname))
  const [data,setData]=useState<any>(null)
  const [dataSection,setDataSection]=useState<AdminSection|null>(null)
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState<AdminApiError|null>(null)
  const [errorSection,setErrorSection]=useState<AdminSection|null>(null)
  const [search,setSearch]=useState('')
  const [logFilters,setLogFilters]=useState<LogFilters>(emptyLogFilters)
  const [page,setPage]=useState(1)
  const [selected,setSelected]=useState<AdminRow|null>(null)
  const [selectedUserId,setSelectedUserId]=useState<string|null>(null)
  const [selectedVipId,setSelectedVipId]=useState<string|null>(null)
  const [vipDetail,setVipDetail]=useState<VipDetailResponse|null>(null)
  const [vipDetailLoading,setVipDetailLoading]=useState(false)
  const [vipDetailError,setVipDetailError]=useState<AdminApiError|null>(null)
  const [selectedLogId,setSelectedLogId]=useState<string|null>(null)
  const [logDetail,setLogDetail]=useState<LogDetailResponse|null>(null)
  const [logDetailLoading,setLogDetailLoading]=useState(false)
  const [logDetailError,setLogDetailError]=useState<AdminApiError|null>(null)
  const [selectedTournamentId,setSelectedTournamentId]=useState<string|null>(null)
  const [tournamentDetail,setTournamentDetail]=useState<TournamentDetailResponse|null>(null)
  const [tournamentDetailLoading,setTournamentDetailLoading]=useState(false)
  const [tournamentDetailError,setTournamentDetailError]=useState<AdminApiError|null>(null)
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null)
  const [forceMatchOpen,setForceMatchOpen]=useState(false)
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [createType,setCreateType]=useState<'user'|'host'|'server'|'tournament'|null>(null)
  const [hostPairing,setHostPairing]=useState<{hostId:string;hostName:string;pairingCode:string;expiresAt:string}|null>(null)
  const cache=useRef<Record<string,any>>({})
  const requestId=useRef(0)
  const vipDetailRequestId=useRef(0)
  const logDetailRequestId=useRef(0)
  const tournamentDetailRequestId=useRef(0)
  const [detail,setDetail]=useState<any>(null)
  const [detailLoading,setDetailLoading]=useState(false)
  const [detailError,setDetailError]=useState<AdminApiError|null>(null)
  const [userManagement,setUserManagement]=useState<{row:AdminRow;action:Exclude<AdminUserAction,'view'>}|null>(null)
  const [serverManagement,setServerManagement]=useState<{row:AdminRow;action:Exclude<AdminServerAction,'view'|'copy'>}|null>(null)
  const [matchManagement,setMatchManagement]=useState<{row:AdminRow;action:Exclude<AdminMatchAction,'view'>}|null>(null)
  const [tournamentManagement,setTournamentManagement]=useState<{row:AdminRow;action:Exclude<AdminTournamentAction,'view'>}|null>(null)
  const [storeManagement,setStoreManagement]=useState<{row:AdminRow|null;type:CatalogType;action:AdminStoreAction}|null>(null)
  const [moderationManagement,setModerationManagement]=useState<{kind:'report'|'ban';row:AdminRow|null;action:AdminReportAction|AdminBanAction}|null>(null)

  const logQuery=new URLSearchParams({page:String(page),q:search,...logFilters}).toString()
  const endpoint:Record<AdminSection,string>={dashboard:'/dashboard',news:`/news?page=${page}&q=${encodeURIComponent(search)}`,users:`/users?page=${page}&includeDeleted=true&q=${encodeURIComponent(search)}`,hosts:'/hosts',servers:'/servers',matchmaking:'/queue',matches:'/matches',tournaments:'/tournaments',reports:'/reports',support:`/support-tickets?page=${page}&q=${encodeURIComponent(search)}`,bans:`/bans?page=${page}&q=${encodeURIComponent(search)}`,store:'/catalog',vip:`/users?page=${page}&q=${encodeURIComponent(search)}`,badges:'/catalog',frames:'/catalog',logs:`/logs?${logQuery}`,system:'/system'}
  const load=useCallback(async()=>{const id=++requestId.current,key=`${section}:${endpoint[section]}`,cached=cache.current[key];if(cached){setData(cached);setDataSection(section)}else{setDataSection(null)}setLoading(!cached);setLoadError(null);setErrorSection(null);try{const value=assertAdminPayload(section,await adminAPI.get(endpoint[section]));if(id!==requestId.current)return;cache.current[key]=value;setData(value);setDataSection(section)}catch(error:any){if(id!==requestId.current)return;setDataSection(null);const apiError=error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unknown administration error',0,'CLIENT_ERROR');setLoadError(apiError);setErrorSection(section);toast.error('Unable to load administration data',{description:`${apiError.code}: ${apiError.message}`})}finally{if(id===requestId.current)setLoading(false)}},[endpoint[section],section])
  const refresh=useCallback(async()=>{cache.current={};await load()},[load])
  useEffect(()=>{const timer=window.setTimeout(load,['news','users','vip','support','bans','logs'].includes(section)?250:0);return()=>window.clearTimeout(timer)},[load,section])
  useEffect(()=>{vipDetailRequestId.current+=1;logDetailRequestId.current+=1;tournamentDetailRequestId.current+=1;setPage(1);setSelected(null);setSelectedUserId(null);setSelectedVipId(null);setVipDetail(null);setVipDetailLoading(false);setVipDetailError(null);setSelectedLogId(null);setLogDetail(null);setLogDetailLoading(false);setLogDetailError(null);setSelectedTournamentId(null);setTournamentDetail(null);setTournamentDetailLoading(false);setTournamentDetailError(null);setSearch('');setLogFilters(emptyLogFilters)},[section])
  useEffect(()=>setPage(1),[search,logFilters])
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
  useEffect(()=>{if(!sidebarOpen)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSidebarOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[sidebarOpen])
  useEffect(()=>{document.body.classList.add('admin-panel-open');return()=>document.body.classList.remove('admin-panel-open')},[])

  if(!user||user.role!=='admin')return <main className="grid min-h-screen place-items-center bg-[#080809] p-6"><div className="w-full max-w-lg rounded-lg border border-red-500/30 bg-red-950/10 p-8 text-center"><Shield className="mx-auto text-red-400"/><h1 className="mt-4 font-mono text-2xl text-slate-100">ACCESS DENIED</h1><p className="mt-2 text-sm text-slate-400">Administrator clearance is required.</p><Button variant="outline" className="mt-6 border-orange-900/30" onClick={()=>onNavigate('hub')}>Return to Hub</Button></div></main>

  const sectionData=dataSection===section?data:null
  const sectionError=errorSection===section?loadError:null
  const rows:AdminRow[]=!sectionData?[]:section==='badges'?sectionData.badges:section==='frames'?sectionData.frames:section==='store'?sectionData.frames.map((item:AdminRow)=>({...item,catalog:'frame'})):sectionData.items
  const visibleRows=search.trim()?rows.filter(row=>Object.values(row).some(value=>String(value??'').toLowerCase().includes(search.trim().toLowerCase()))):rows
  const mutate=async(path:string,method:'post'|'patch'|'delete',body?:any)=>{try{await(method==='delete'?adminAPI.delete(path):adminAPI[method](path,body));toast.success('Administrative action completed');setSelected(null);await refresh();return true}catch(error:any){toast.error('Action failed',{description:error.message});return false}}
  const destructive=(title:string,description:string,run:()=>Promise<void>)=>setConfirmation({title,description,run})
  const selectSection=(next:AdminSection,replace=false)=>{
    const path=pathForSection(next)
    if(window.location.pathname!==path)window.history[replace?'replaceState':'pushState']({page:'admin',section:next},'',path)
    setSection(next)
    setSidebarOpen(false)
  }
  const sectionAction=(action:AdminSectionAction)=>{if(action==='clear_queue')return destructive('Clear full queue','Every currently queued player will be removed.',async()=>{await mutate('/queue','delete')});if(action==='force_match')return setForceMatchOpen(true);if(action==='create_ban')return setModerationManagement({kind:'ban',row:null,action:'create'});if(action==='create_badge'||action==='create_frame')return setStoreManagement({row:null,type:action==='create_badge'?'badges':'frames',action:'create'});if(action==='clear_cache')destructive('Clear Steam profile cache','Cached Steam check timestamps will be cleared and refreshed through normal profile checks.',async()=>{await mutate('/system/cache/clear','post')})}
  const openDetails=async(row:AdminRow)=>{setSelected(row);if(section==='users')setSelectedUserId(String(row.id));setDetail(null);setDetailError(null);const path=section==='users'?`/users/${row.id}`:section==='hosts'?`/hosts/${row.id}`:section==='servers'?`/servers/${row.id}`:section==='matches'?`/matches/${row.id}`:null;if(!path)return setDetail(row);setDetailLoading(true);try{setDetail(await adminAPI.get(path))}catch(error:any){setDetailError(error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unable to load details',0,'CLIENT_ERROR'))}finally{setDetailLoading(false)}}
  const loadVipDetails=async(id:string)=>{const request=++vipDetailRequestId.current;setVipDetail(null);setVipDetailError(null);setVipDetailLoading(true);try{const response=await adminAPI.get<VipDetailResponse>(`/users/${encodeURIComponent(id)}`);if(!response?.user||String(response.user.id)!==id)throw new AdminApiError('Backend returned an invalid VIP detail response',502,'INVALID_VIP_DETAIL_RESPONSE');if(request===vipDetailRequestId.current)setVipDetail(response)}catch(error:any){if(request===vipDetailRequestId.current)setVipDetailError(error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unable to load VIP details',0,'CLIENT_ERROR'))}finally{if(request===vipDetailRequestId.current)setVipDetailLoading(false)}}
  const openVipDetails=(row:AdminRow)=>{const id=String(row.id);setSelectedVipId(id);void loadVipDetails(id)}
  const closeVipDetails=()=>{vipDetailRequestId.current+=1;setSelectedVipId(null);setVipDetail(null);setVipDetailLoading(false);setVipDetailError(null)}
  const loadLogDetails=async(id:string)=>{const request=++logDetailRequestId.current;setLogDetail(null);setLogDetailError(null);setLogDetailLoading(true);try{const response=await adminAPI.get<LogDetailResponse>(`/logs/${encodeURIComponent(id)}`);if(!response?.log||String(response.log.id)!==id)throw new AdminApiError('Backend returned an invalid audit log detail response',502,'INVALID_LOG_DETAIL_RESPONSE');if(request===logDetailRequestId.current)setLogDetail(response)}catch(error:any){if(request===logDetailRequestId.current)setLogDetailError(error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unable to load audit log details',0,'CLIENT_ERROR'))}finally{if(request===logDetailRequestId.current)setLogDetailLoading(false)}}
  const openLogDetails=(row:AdminRow)=>{const id=String(row.id);setSelectedLogId(id);void loadLogDetails(id)}
  const closeLogDetails=()=>{logDetailRequestId.current+=1;setSelectedLogId(null);setLogDetail(null);setLogDetailLoading(false);setLogDetailError(null)}
  const loadTournamentDetails=async(id:string)=>{const request=++tournamentDetailRequestId.current;setTournamentDetail(null);setTournamentDetailError(null);setTournamentDetailLoading(true);try{const response=await adminAPI.get<TournamentDetailResponse>(`/tournaments/${encodeURIComponent(id)}`);if(!response?.tournament||String(response.tournament.id)!==id||!Array.isArray(response.participants))throw new AdminApiError('Backend returned an invalid tournament detail response',502,'INVALID_TOURNAMENT_DETAIL_RESPONSE');if(request===tournamentDetailRequestId.current)setTournamentDetail(response)}catch(error:any){if(request===tournamentDetailRequestId.current)setTournamentDetailError(error instanceof AdminApiError?error:new AdminApiError(error?.message||'Unable to load tournament details',0,'CLIENT_ERROR'))}finally{if(request===tournamentDetailRequestId.current)setTournamentDetailLoading(false)}}
  const openTournamentDetails=(row:AdminRow)=>{const id=String(row.id);setSelectedTournamentId(id);void loadTournamentDetails(id)}
  const closeTournamentDetails=()=>{tournamentDetailRequestId.current+=1;setSelectedTournamentId(null);setTournamentDetail(null);setTournamentDetailLoading(false);setTournamentDetailError(null)}
  const queueVipDetails=(row:AdminRow)=>window.setTimeout(()=>openVipDetails(row),0)
  const queueLogDetails=(row:AdminRow)=>window.setTimeout(()=>openLogDetails(row),0)
  const userAction=(row:AdminRow,action:AdminUserAction)=>{if(action==='view')window.setTimeout(()=>void openDetails(row),0);else setUserManagement({row,action})}
  const updateUserRow=(updated:AdminRow)=>{const normalized={...updated,active_ban:updated.activeBan};setData((current:any)=>current&&dataSection===section&&Array.isArray(current.items)?{...current,items:current.items.map((item:AdminRow)=>item.id===updated.id?{...item,...normalized}:item)}:current);setSelected(current=>current?.id===updated.id?{...current,...normalized}:current);setDetail((current:any)=>current?.user?.id===updated.id?{...current,user:{...current.user,...updated}}:current);cache.current={};if(updated.id===user.id)void refreshProfile().catch(()=>onNavigate('auth'))}
  const removeUserRow=(id:string)=>{setData((current:any)=>current&&dataSection==='users'&&Array.isArray(current.items)?{...current,items:current.items.filter((item:AdminRow)=>item.id!==id),total:Math.max(0,(current.total??current.items.length)-1)}:current);setSelected(current=>current?.id===id?null:current);setDetail((current:any)=>current?.user?.id===id?null:current);cache.current={};if(id===user.id){logout();onNavigate('auth')}}
  const updateServerRow=(updated:AdminRow|null)=>{const id=serverManagement?.row.id;setData((current:any)=>current&&dataSection==='servers'&&Array.isArray(current.items)?{...current,items:updated?current.items.map((item:AdminRow)=>item.id===updated.id?{...item,...updated}:item):current.items.filter((item:AdminRow)=>item.id!==id),total:updated?current.total:Math.max(0,(current.total??current.items.length)-1)}:current);setSelected(current=>current?.id===id?(updated?{...current,...updated}:null):current);setDetail((current:any)=>current?.server?.id===id?(updated?{...current,server:{...current.server,...updated}}:null):current);cache.current={}}
  const serverAction=async(row:AdminRow,action:AdminServerAction)=>{if(action==='view')return void openDetails(row);if(action==='copy'){try{await navigator.clipboard.writeText(`connect ${row.public_host}:${row.public_port}`);toast.success('Connect command copied')}catch(error:any){toast.error('Unable to copy connect command',{description:error.message})}return}setServerManagement({row,action})}
  const generateHostPairing=(host:AdminRow)=>destructive('Generiši novi pairing kod','Prethodni neiskorišteni kod odmah prestaje da važi. Novi kod važi 20 minuta i može se koristiti samo jednom.',async()=>{const result:any=await adminAPI.post(`/hosts/${host.id}/pairing-code`,{});if(!result?.pairingCode||!result?.expiresAt)throw new Error('Backend nije vratio pairing kod');setHostPairing({hostId:String(host.id),hostName:String(host.name),pairingCode:String(result.pairingCode),expiresAt:String(result.expiresAt)})})
  const hostAction=async(row:AdminRow,action:AdminHostAction)=>{
    if(action==='view')return void openDetails(row)
    if(action==='pair')return generateHostPairing(row)
    if(action==='toggle')return destructive(row.enabled?'Disable host':'Enable host',`${row.name} će biti ${row.enabled?'onemogućen i označen kao offline':'ponovo omogućen'}. Ova promjena se bilježi u admin audit log.`,async()=>{await mutate(`/hosts/${encodeURIComponent(String(row.id))}/enabled`,'post',{enabled:!row.enabled})})
    try{
      const response:any=await adminAPI.get(`/hosts/${encodeURIComponent(String(row.id))}`)
      const linkedServers=Array.isArray(response?.servers)?response.servers.length:0
      const profiles=Array.isArray(response?.host?.profiles)?response.host.profiles.length:Array.isArray(row.profiles)?row.profiles.length:0
      const associations=[linkedServers?`${linkedServers} povezanih game servera`:null,profiles?`${profiles} lokalnih profila`:null].filter(Boolean).join(' i ')
      destructive('Delete host',associations?`${row.name} ima ${associations}. Brisanje je nepovratno; backend će odbiti operaciju dok postoje povezani game serveri.`:`Trajno obriši host ${row.name}. Ova radnja je nepovratna i biće zabilježena u admin audit logu.`,async()=>{await mutate(`/hosts/${encodeURIComponent(String(row.id))}`,'delete')})
    }catch(error:any){toast.error('Unable to inspect host before deletion',{description:error.message})}
  }
  const updateMatchRow=(updated:AdminRow|null)=>{const id=matchManagement?.row.id;setData((current:any)=>current&&dataSection==='matches'&&Array.isArray(current.items)?{...current,items:updated?current.items.map((item:AdminRow)=>item.id===updated.id?{...item,...updated}:item):current.items.filter((item:AdminRow)=>item.id!==id),total:updated?current.total:Math.max(0,(current.total??current.items.length)-1)}:current);setSelected(current=>current?.id===id?(updated?{...current,...updated}:null):current);setDetail((current:any)=>current?.match?.id===id?(updated?{...current,match:{...current.match,...updated}}:null):current);cache.current={}}
  const matchAction=(row:AdminRow,action:AdminMatchAction)=>{if(action==='view')return void openDetails(row);setMatchManagement({row,action})}
  const updateTournamentRow=(updated:AdminRow|null)=>{const id=tournamentManagement?.row.id;setData((current:any)=>current&&dataSection==='tournaments'&&Array.isArray(current.items)?{...current,items:updated?current.items.map((item:AdminRow)=>item.id===updated.id?{...item,...updated}:item):current.items.filter((item:AdminRow)=>item.id!==id),total:updated?current.total:Math.max(0,(current.total??current.items.length)-1)}:current);setSelected(current=>current?.id===id?(updated?{...current,...updated}:null):current);setDetail((current:any)=>current?.tournament?.id===id?(updated?{...current,tournament:{...current.tournament,...updated}}:null):current);cache.current={}}
  const tournamentAction=(row:AdminRow,action:AdminTournamentAction)=>{if(action==='view')return void window.setTimeout(()=>openTournamentDetails(row),0);setTournamentManagement({row,action})}
  const storeAction=(row:AdminRow,action:Exclude<AdminStoreAction,'create'>)=>setStoreManagement({row,type:section==='badges'?'badges':section==='frames'?'frames':row.catalog==='frame'?'frames':'badges',action})
  const updateStoreRow=(type:CatalogType,item:AdminRow|null,id?:string)=>{const key=type;setData((current:any)=>{if(!current||!['store','badges','frames'].includes(String(dataSection))||!Array.isArray(current[key]))return current;const exists=item&&current[key].some((entry:AdminRow)=>entry.id===item.id);return{...current,[key]:item?(exists?current[key].map((entry:AdminRow)=>entry.id===item.id?{...entry,...item}:entry):[...current[key],item].sort((a:AdminRow,b:AdminRow)=>String(a.name).localeCompare(String(b.name)))):current[key].filter((entry:AdminRow)=>entry.id!==id)}});setSelected(current=>current&&current.id===(item?.id||id)?item:null);setDetail(current=>current&&current.id===(item?.id||id)?item:null);cache.current={}}
  const reportAction=(row:AdminRow,action:AdminReportAction)=>setModerationManagement({kind:'report',row,action})
  const banAction=(row:AdminRow,action:Exclude<AdminBanAction,'create'>)=>setModerationManagement({kind:'ban',row,action})
  const updateReportRow=(report:AdminRow)=>{setData((current:any)=>current&&dataSection==='reports'&&Array.isArray(current.items)?{...current,items:current.items.map((item:AdminRow)=>item.id===report.id?{...item,...report}:item)}:current);setSelected(current=>current?.id===report.id?{...current,...report}:current);setDetail((current:any)=>current?.report?.id===report.id?{...current,report:{...current.report,...report}}:current);cache.current={}}
  const updateBanRow=(ban:AdminRow|null,id?:string)=>{setData((current:any)=>{if(!current||dataSection!=='bans'||!Array.isArray(current.items))return current;const exists=ban&&current.items.some((item:AdminRow)=>item.id===ban.id);return{...current,items:ban?(exists?current.items.map((item:AdminRow)=>item.id===ban.id?{...item,...ban}:item):[ban,...current.items]):current.items.filter((item:AdminRow)=>item.id!==id),total:ban&&!exists?(current.total??current.items.length)+1:current.total}});setSelected(current=>current?.id===(ban?.id||id)?ban:current);setDetail(current=>current&&current.id===(ban?.id||id)?ban:current);cache.current={}}
  const updateNewsRow=(article:AdminRow|null,id?:string)=>{setData((current:any)=>{if(!current||dataSection!=='news'||!Array.isArray(current.items))return current;const exists=article&&current.items.some((item:AdminRow)=>item.id===article.id);return{...current,items:article?(exists?current.items.map((item:AdminRow)=>item.id===article.id?{...item,...article}:item):[article,...current.items]):current.items.filter((item:AdminRow)=>item.id!==id),total:article&&!exists?(current.total??current.items.length)+1:article?current.total:Math.max(0,(current.total??current.items.length)-1)}});cache.current={}}

  return <div className="admin-root flex min-h-screen w-full bg-[#080809] font-mono text-slate-200">
    {sidebarOpen&&<button aria-label="Close navigation" className="admin-backdrop fixed inset-0 z-40 bg-black/70" onClick={()=>setSidebarOpen(false)}/>}
    <AdminSidebar section={section} onSelect={selectSection} open={sidebarOpen} onClose={()=>setSidebarOpen(false)} onHub={()=>onNavigate('hub')} onLogout={()=>{logout();onNavigate('auth')}}/>
    <div className="admin-main flex min-w-0 flex-1 flex-col"><AdminTopbar section={section} user={user} search={search} onSearch={setSearch} onMenu={()=>setSidebarOpen(true)} onRefresh={refresh} onCreate={setCreateType} loading={loading}/>
      <main className="admin-content mx-auto w-full max-w-[1800px] flex-1 p-6">
        <AdminSectionActions section={section} onAction={sectionAction}/>
        {sectionError?<AdminLoadError error={sectionError} onRetry={load}/>
          :loading||!sectionData?<div className="grid h-[60vh] place-items-center"><div className="flex items-center gap-3 text-sm text-slate-500"><Activity size={18} className="animate-spin text-orange-400"/>Loading live administration data…</div></div>
          :section==='dashboard'?<AdminDashboard data={sectionData}/>
          :section==='system'?<AdminSystem data={sectionData} onRefresh={refresh} onToggleGame={async(gameId,enabled)=>{try{const result:any=await adminAPI.patch(`/system/games/${gameId}`,{enabled});setData((current:any)=>current&&dataSection==='system'?{...current,games:(current.games||[]).map((game:any)=>game.game_id===gameId?result.game:game)}:current);cache.current={};window.dispatchEvent(new Event('sector-nine:games-changed'));toast.success(`${result.game.name} ${enabled?'enabled':'disabled'}`)}catch(error:any){toast.error('Game availability update failed',{description:error.message})}}} onSave={async settings=>{try{const result:any=await adminAPI.put('/system/settings',{settings});if(!Array.isArray(result?.settings))throw new Error('Backend did not return saved settings');setData((current:any)=>current&&dataSection==='system'?{...current,settings:result.settings}:current);cache.current={};await onPlatformSettingsSaved?.();toast.success('Platform settings saved to PostgreSQL');return result.settings}catch(error:any){toast.error('Setting update failed',{description:error.message});throw error}}}/>
          :section==='news'?<AdminNewsManagement data={sectionData} onChanged={updateNewsRow} onPage={setPage}/>
          :<>{section==='logs'&&<AdminLogFilters value={logFilters} options={sectionData.filters} onChange={setLogFilters}/>}<AdminTable section={section} rows={visibleRows} onSelect={section==='vip'?queueVipDetails:section==='logs'?queueLogDetails:section==='tournaments'?(row=>window.setTimeout(()=>openTournamentDetails(row),0)):['users','hosts','servers','matchmaking','matches','support','bans','badges','frames','store'].includes(section)?openDetails:section==='reports'?(row=>reportAction(row,'view')):undefined} onUserAction={section==='users'?userAction:undefined} onHostAction={section==='hosts'?hostAction:undefined} onServerAction={section==='servers'?serverAction:undefined} onMatchAction={section==='matches'?matchAction:undefined} onTournamentAction={section==='tournaments'?tournamentAction:undefined} onStoreAction={['store','badges','frames'].includes(section)?storeAction:undefined} onReportAction={section==='reports'?reportAction:undefined} onBanAction={section==='bans'?banAction:undefined} page={page} total={sectionData?.total} limit={sectionData?.limit} onPage={setPage}/></>}
      </main>
    </div>
    {section==='users'?<UserDetailsDialog userId={selectedUserId} row={selected} detail={detail} loading={detailLoading} error={detailError} onRetry={()=>selected&&openDetails(selected)} onClose={()=>{setSelectedUserId(null);setSelected(null);setDetail(null);setDetailError(null)}}/>:!['news','vip','logs','tournaments'].includes(section)?<DetailDrawer section={section} row={selected} detail={detail} loading={detailLoading} error={detailError} onRetry={()=>selected&&openDetails(selected)} onClose={()=>{setSelected(null);setDetail(null)}} mutate={mutate} destructive={destructive} onGenerateHostPairing={generateHostPairing}/>:null}
    <VipDetailsDialog userId={selectedVipId} detail={vipDetail} loading={vipDetailLoading} error={vipDetailError} onRetry={()=>selectedVipId&&loadVipDetails(selectedVipId)} onClose={closeVipDetails}/>
    <LogDetailsDialog logId={selectedLogId} detail={logDetail} loading={logDetailLoading} error={logDetailError} onRetry={()=>selectedLogId&&loadLogDetails(selectedLogId)} onClose={closeLogDetails}/>
    <TournamentDetailsDialog tournamentId={selectedTournamentId} detail={tournamentDetail} loading={tournamentDetailLoading} error={tournamentDetailError} onRetry={()=>selectedTournamentId&&loadTournamentDetails(selectedTournamentId)} onClose={closeTournamentDetails}/>
    <AdminUserManagement row={userManagement?.row||null} action={userManagement?.action||null} currentUserId={user.id} onClose={()=>setUserManagement(null)} onSaved={updateUserRow} onDeleted={removeUserRow}/>
    <AdminServerManagement row={serverManagement?.row||null} action={serverManagement?.action||null} onClose={()=>setServerManagement(null)} onSaved={updateServerRow}/>
    <AdminMatchManagement row={matchManagement?.row||null} action={matchManagement?.action||null} onClose={()=>setMatchManagement(null)} onSaved={updateMatchRow}/>
    <AdminTournamentManagement row={tournamentManagement?.row||null} action={tournamentManagement?.action||null} onClose={()=>setTournamentManagement(null)} onSaved={updateTournamentRow}/>
    <AdminStoreManagement row={storeManagement?.row||null} type={storeManagement?.type||null} action={storeManagement?.action||null} onClose={()=>setStoreManagement(null)} onSaved={updateStoreRow}/>
    <AdminModerationManagement kind={moderationManagement?.kind||null} row={moderationManagement?.row||null} action={moderationManagement?.action||null} users={sectionData?.users||[]} onClose={()=>setModerationManagement(null)} onReportSaved={updateReportRow} onBanSaved={updateBanRow}/>
    {forceMatchOpen&&<ForceMatchDialog players={section==='matchmaking'?rows:[]} onClose={()=>setForceMatchOpen(false)} onSubmit={async userIds=>{if(await mutate('/queue/force-match','post',{userIds}))setForceMatchOpen(false)}}/>}
    <CreateDialog type={createType} availableGames={section==='tournaments'?sectionData?.games:undefined} modeCatalog={section==='servers'?sectionData?.modeCatalog:undefined} hostCatalog={section==='servers'?sectionData?.hosts:undefined} onClose={()=>setCreateType(null)} onCreated={async(type)=>{const next=type==='user'?'users':type==='host'?'hosts':type==='server'?'servers':'tournaments';setCreateType(null);cache.current={};if(next===section)await load();else selectSection(next)}}/>
    <HostPairingDialog value={hostPairing} onClose={()=>setHostPairing(null)}/>
    <AlertDialog open={Boolean(confirmation)} onOpenChange={open=>!open&&setConfirmation(null)}><AlertDialogContent className="admin-dialog border-red-500/40 bg-[#111113]"><AlertDialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full border border-red-500/30 bg-red-950/40"><AlertTriangle className="size-5 text-red-400"/></div><AlertDialogTitle className="text-red-200">{confirmation?.title}</AlertDialogTitle><AlertDialogDescription className="leading-relaxed text-slate-400">{confirmation?.description}</AlertDialogDescription></AlertDialogHeader><div className="rounded border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-200">Review the target and consequences carefully. This action is audited and may not be reversible.</div><AlertDialogFooter className="gap-2"><AlertDialogCancel>Keep current state</AlertDialogCancel><AlertDialogAction className="bg-red-700 font-semibold text-white hover:bg-red-600" onClick={async()=>{const run=confirmation?.run;setConfirmation(null);if(run)await run()}}>Yes, confirm action</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function AdminLoadError({error,onRetry}:{error:AdminApiError;onRetry:()=>void}) {
  const title=error.status===401?'Authentication required':error.status===403?'Permission denied':error.code==='DATABASE_MIGRATION_REQUIRED'?'Database migration required':'Backend request failed'
  return <div className="grid min-h-[55vh] place-items-center"><div className="w-full max-w-2xl rounded-lg border border-red-500/30 bg-red-950/10 p-7"><AlertTriangle className="text-red-400"/><h2 className="mt-4 text-lg text-slate-100">{title}</h2><p className="mt-2 text-sm text-slate-400">This section could not load. The rest of the admin panel remains available, and no empty or default values have been substituted.</p><pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded border border-red-900/30 bg-black/30 p-3 text-xs text-red-300">{error.code} (HTTP {error.status||'network'}){`\n`}{error.message}</pre><Button className="mt-5" variant="outline" onClick={onRetry}>Retry request</Button></div></div>
}

function ForceMatchDialog({players,onClose,onSubmit}:{players:AdminRow[];onClose:()=>void;onSubmit:(userIds:string[])=>Promise<void>}) {
  const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[saving,setSaving]=useState(false)
  const submit=async(event:React.FormEvent)=>{event.preventDefault();if(!first||!second||first===second)return;setSaving(true);try{await onSubmit([first,second])}finally{setSaving(false)}}
  const options=(excluded:string)=>players.filter(player=>String(player.user_id)!==excluded)
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="admin-dialog border-orange-900/30"><DialogHeader><DialogTitle>Force match</DialogTitle><DialogDescription>Select two different players from the current PostgreSQL matchmaking queue.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><label className="block text-xs text-slate-400">First player<select required value={first} onChange={event=>setFirst(event.target.value)} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="">Select queued player</option>{options(second).map(player=><option key={player.user_id} value={player.user_id}>{displayPlayerName({display_name:player.display_name,username:player.username},'Player')} · {player.user_id}</option>)}</select></label><label className="block text-xs text-slate-400">Second player<select required value={second} onChange={event=>setSecond(event.target.value)} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="">Select queued player</option>{options(first).map(player=><option key={player.user_id} value={player.user_id}>{displayPlayerName({display_name:player.display_name,username:player.username},'Player')} · {player.user_id}</option>)}</select></label>{players.length<2&&<p className="rounded border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">At least two queued players are required.</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving||players.length<2||!first||!second||first===second}>{saving?'Creating match…':'Create match'}</Button></DialogFooter></form></DialogContent></Dialog>
}

function AdminLogFilters({value,options,onChange}:{value:LogFilters;options?:{admins:{id:string;username:string}[];actions:string[]};onChange:(value:LogFilters)=>void}) {
  const set=(key:keyof LogFilters,next:string)=>onChange({...value,[key]:next})
  return <div className="mb-4 grid gap-3 rounded-lg border border-orange-900/25 bg-[#101011] p-4 md:grid-cols-2 xl:grid-cols-5">
    <label className="text-xs text-slate-500">Admin<select value={value.admin} onChange={event=>set('admin',event.target.value)} className="mt-1 h-9 w-full rounded border border-orange-900/30 bg-black/30 px-3 text-slate-200"><option value="">All administrators</option>{options?.admins?.map(admin=><option key={admin.id} value={admin.id}>{admin.username}</option>)}</select></label>
    <label className="text-xs text-slate-500">Action<select value={value.action} onChange={event=>set('action',event.target.value)} className="mt-1 h-9 w-full rounded border border-orange-900/30 bg-black/30 px-3 text-slate-200"><option value="">All actions</option>{options?.actions?.map(action=><option key={action} value={action}>{action}</option>)}</select></label>
    <label className="text-xs text-slate-500">Target<Input value={value.target} onChange={event=>set('target',event.target.value)} placeholder="Type or ID" className="mt-1 h-9 border-orange-900/30 bg-black/30"/></label>
    <label className="text-xs text-slate-500">From<Input type="date" value={value.dateFrom} onChange={event=>set('dateFrom',event.target.value)} className="mt-1 h-9 border-orange-900/30 bg-black/30"/></label>
    <label className="text-xs text-slate-500">To<Input type="date" value={value.dateTo} onChange={event=>set('dateTo',event.target.value)} className="mt-1 h-9 border-orange-900/30 bg-black/30"/></label>
    {Object.values(value).some(Boolean)&&<Button variant="outline" size="sm" onClick={()=>onChange(emptyLogFilters)} className="md:col-span-2 xl:col-span-5">Clear log filters</Button>}
  </div>
}

function HostPairingDialog({value,onClose}:{value:{hostId:string;hostName:string;pairingCode:string;expiresAt:string}|null;onClose:()=>void}){
  const [copied,setCopied]=useState(false)
  useEffect(()=>setCopied(false),[value?.pairingCode])
  if(!value)return null
  const remaining=Math.max(0,Math.ceil((new Date(value.expiresAt).getTime()-Date.now())/60_000))
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="border-orange-900/30 bg-[#111113]"><DialogHeader><div className="mb-2 grid size-11 place-items-center rounded-full border border-orange-500/30 bg-orange-950/30"><KeyRound className="size-5 text-orange-400"/></div><DialogTitle>PAIRING KOD</DialogTitle><DialogDescription>{value.hostName} · važi još približno {remaining} min.</DialogDescription></DialogHeader><code className="block rounded border border-orange-500/30 bg-black/40 p-5 text-center text-2xl tracking-[.25em] text-orange-300">{value.pairingCode}</code><p className="text-sm text-slate-400">Ističe: <span className="text-slate-200">{new Date(value.expiresAt).toLocaleString()}</span></p><p className="text-sm text-slate-400">Ovaj kod je jednokratan. Nakon uspješnog pairinga ili isteka vremena više se ne može koristiti.</p><DialogFooter><Button variant="outline" onClick={async()=>{await navigator.clipboard.writeText(value.pairingCode);setCopied(true)}}><Copy size={15}/>{copied?'Kopirano':'Kopiraj kod'}</Button><Button onClick={onClose}>Završeno</Button></DialogFooter></DialogContent></Dialog>
}

function CreateDialog({type,availableGames,modeCatalog,hostCatalog,onClose,onCreated}:{type:'user'|'host'|'server'|'tournament'|null;availableGames?:AdminRow[];modeCatalog?:Array<{game_id:string;modes:string[]}>;hostCatalog?:AdminRow[];onClose:()=>void;onCreated:(type:'user'|'host'|'server'|'tournament')=>Promise<void>}) {
  const [saving,setSaving]=useState(false)
  const [serverGameId,setServerGameId]=useState('hl1')
  const gameNames:Record<string,string>={hl1:'Half-Life 1',cs16:'Counter-Strike 1.6',l4d2:'Left 4 Dead 2',cod4:'Call of Duty 4 Promod'}
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!type)return;const values=Object.fromEntries(new FormData(event.currentTarget).entries());setSaving(true);try{if(type==='user')await adminAPI.post('/users',values);if(type==='host')await adminAPI.post('/hosts',values);if(type==='server')await adminAPI.post('/servers',{...values,publicPort:Number(values.publicPort),rconPort:Number(values.rconPort),slots:Number(values.slots)});if(type==='tournament')await adminAPI.post('/tournaments',{...values,maxParticipants:Number(values.maxParticipants),entryFeePoints:Number(values.entryFeePoints),prizePoolPoints:Number(values.prizePoolPoints)});toast.success(`${type[0].toUpperCase()+type.slice(1)} created`);await onCreated(type)}catch(error:any){toast.error(`Unable to create ${type}`,{description:error.message})}finally{setSaving(false)}}
  const field=(name:string,label:string,typeName='text',required=true)=>{
    const input=<label className="block text-xs text-slate-400">{label}<Input name={name} type={typeName} required={required} className="mt-2 border-orange-900/30 bg-black/30"/></label>
    if(type==='server'&&name==='name')return <div className="space-y-4"><label className="block text-xs text-slate-400">Game<select name="gameId" required value={serverGameId} onChange={event=>setServerGameId(event.target.value)} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3">{Object.entries(gameNames).map(([id,text])=><option key={id} value={id}>{text} ({id})</option>)}</select></label><input type="hidden" name="game" value={gameNames[serverGameId]}/><label className="block text-xs text-slate-400">Game mode<select name="gameMode" required key={serverGameId} defaultValue="" className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="">Select configured mode</option>{(modeCatalog?.find(entry=>entry.game_id===serverGameId)?.modes||[]).map(mode=><option key={mode} value={mode}>{mode}</option>)}</select></label><label className="block text-xs text-slate-400">Host / local profile<select name="hostSelection" defaultValue="" onChange={event=>{const [hostId,profileId]=event.target.value.split('|');const form=event.currentTarget.form;if(form){(form.elements.namedItem('hostId') as HTMLInputElement).value=hostId||'';(form.elements.namedItem('hostProfileId') as HTMLInputElement).value=profileId||''}}} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="">Legacy standalone server</option>{hostCatalog?.flatMap(host=>(Array.isArray(host.profiles)?host.profiles:[]).filter((profile:any)=>profile.gameId===serverGameId).map((profile:any)=><option key={`${host.id}|${profile.id}`} value={`${host.id}|${profile.id}`}>{String(host.name)} / {String(profile.name)}</option>))}</select></label><input type="hidden" name="hostId"/><input type="hidden" name="hostProfileId"/>{input}<label className="block text-xs text-slate-400">Public Game Address<Input name="publicHost" required className="mt-2 border-orange-900/30 bg-black/30"/></label><label className="block text-xs text-slate-400">Public Game Port<Input name="publicPort" type="number" min="1" max="65535" required className="mt-2 border-orange-900/30 bg-black/30"/></label><label className="block text-xs text-slate-400">RCON Address<Input name="rconHost" required className="mt-2 border-orange-900/30 bg-black/30"/></label><label className="block text-xs text-slate-400">RCON Port<Input name="rconPort" type="number" min="1" max="65535" required className="mt-2 border-orange-900/30 bg-black/30"/></label><label className="block text-xs text-slate-400">RCON Password<Input name="rconPassword" type="password" className="mt-2 border-orange-900/30 bg-black/30"/></label></div>
    if(type==='server'&&['game','ip','port'].includes(name))return null
    if(type==='tournament'&&name==='id')return <div className="space-y-4">{input}<label className="block text-xs text-slate-400">Game<select name="gameId" required defaultValue="hl1" className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3">{(availableGames?.length?availableGames:[{game_id:'hl1'}]).map(game=><option key={String(game.game_id)} value={String(game.game_id)}>{({hl1:'Half-Life 1',cs16:'Counter-Strike 1.6',l4d2:'Left 4 Dead 2',cod4:'Call of Duty 4 Promod'} as Record<string,string>)[String(game.game_id)]}</option>)}</select></label></div>
    return input
  }
  const regionSelect=<label className="block text-xs text-slate-400">Region<select name="region" required defaultValue={SUPPORTED_REGIONS[0].id} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3">{SUPPORTED_REGIONS.map(region=><option key={region.id} value={region.id}>{region.label}</option>)}</select></label>
  if(type==='host')return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="admin-dialog border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>Dodaj host</DialogTitle><DialogDescription>Kreirajte fizički Host Agent računar. Pairing kod se generiše nakon kreiranja.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">{field('name','Naziv hosta')}{regionSelect}{field('description','Opis','text',false)}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Otkaži</Button><Button type="submit" disabled={saving}>{saving?'Kreiranje…':'Kreiraj host'}</Button></DialogFooter></form></DialogContent></Dialog>
  return <Dialog open={Boolean(type)} onOpenChange={open=>!open&&onClose()}><DialogContent className="admin-dialog border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>Create {type}</DialogTitle><DialogDescription>This record will be written to PostgreSQL and added to the admin audit log.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">{type==='user'&&<>{field('username','Username')}{field('email','Email','email')}{field('password','Temporary password','password')}<label className="block text-xs text-slate-400">Role<select name="role" className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="user">User</option><option value="admin">Administrator</option></select></label></>}{type==='server'&&<>{field('name','Server name')}{field('game','Game')}{regionSelect}{field('ip','IP address')}{field('port','Port','number')}{field('slots','Slots','number')}{field('playitTunnel','Playit tunnel','text',false)}</>}{type==='tournament'&&<>{field('id','Tournament ID')}{field('name','Tournament name')}{field('description','Description','text',false)}{field('maxParticipants','Maximum participants','number')}{field('entryFeePoints','Entry fee points','number',false)}{field('prizePoolPoints','Prize pool points','number',false)}{field('startDate','Start date','datetime-local',false)}</>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Creating…':'Create'}</Button></DialogFooter></form></DialogContent></Dialog>
}

function UserDetailsDialog({userId,row,detail,loading,error,onRetry,onClose}:{userId:string|null;row:AdminRow|null;detail:any;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void}) {
  const user=(detail?.user||detail||row) as AdminRow|null
  const fields:[string,unknown,string?][] = user ? [
    ['ID',user.id],
    ['Username',user.username],
    ['Display name',user.display_name],
    ['Email',user.email],
    ['Role',user.role],
    ['Points',user.points],
    ['XP',user.experience],
    ['Level',user.level],
    ['Wins / losses',`${user.wins??0} / ${user.losses??0}`],
    ['VIP',user.is_premium],
    ['VIP since',user.vip_since,'vip_since'],
    ['VIP expiration',user.vip_expires_at,'vip_expires_at'],
    ['VIP method',user.vip_method],
    ['Steam ID',user.steam_id],
    ['Steam verified',user.steam_verified],
    ['Owns HL1',user.owns_hl1],
    ['VAC banned',user.vac_banned],
    ['Game banned',user.game_banned],
    ['Badges',user.owned_badges],
    ['Equipped badge',user.equipped_badge],
    ['Frames',user.owned_frames],
    ['Equipped frame',user.equipped_frame],
    ['Bio',user.bio],
    ['Created',user.created_at,'created_at'],
    ['Last seen',user.last_seen,'last_seen'],
    ['Deactivated',user.deleted_at,'deleted_at'],
    ['Profile visibility',user.profile_visibility],
    ['Online visibility',user.show_online_status],
    ['Active ban',user.activeBan?`${user.activeBan.reason} · ${user.activeBan.expires_at?formatAdminValue(user.activeBan.expires_at,'expires_at'):'Permanent'}`:'None'],
  ] : []

  return <Dialog open={Boolean(userId)} onOpenChange={open=>!open&&onClose()}>
    <DialogContent className="admin-user-details-dialog admin-dialog border-orange-500/60 bg-[#0b0b0d] text-slate-100 shadow-2xl">
      <DialogHeader>
        <DialogTitle>User details</DialogTitle>
        <DialogDescription>Real account data for user ID {userId}</DialogDescription>
      </DialogHeader>
      {loading&&<div className="grid min-h-64 place-items-center rounded-lg border border-orange-900/30 bg-[#101012]"><div className="flex items-center gap-3 text-sm text-slate-300"><Activity size={18} className="animate-spin text-orange-400"/>Loading user details…</div></div>}
      {!loading&&error&&<div className="rounded-lg border border-red-500/50 bg-[#160b0d] p-5"><AlertTriangle className="text-red-400"/><p className="mt-3 text-sm font-semibold text-red-200">{error.code}</p><p className="mt-2 break-words text-sm text-red-100">{error.message}</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onRetry}>Retry</Button></div></div>}
      {!loading&&!error&&user&&<div className="space-y-4 overflow-y-auto pr-1"><div className="overflow-hidden rounded-lg border border-orange-900/35 bg-[#101012]"><dl className="grid min-w-0 sm:grid-cols-[170px_minmax(0,1fr)]">{fields.map(([label,value,key])=><div key={label} className="contents"><dt className="border-b border-orange-900/20 px-4 py-3 text-xs font-medium text-slate-400">{label}</dt><dd className="min-w-0 break-words border-b border-orange-900/20 px-4 py-3 text-sm text-slate-100">{formatAdminValue(value,key||label.toLowerCase().replaceAll(' ','_'))}</dd></div>)}</dl></div><UserHistorySection title="Login history" items={detail?.loginHistory} empty="No login history." render={(item:any)=>`${formatAdminValue(item.created_at,'created_at')} · ${item.method} · ${item.success?'success':'failed'}`}/><UserHistorySection title="Recent matches" items={detail?.matches} empty="No match history." render={(item:any)=>`${formatAdminValue(item.created_at,'created_at')} · ${item.status} · ${item.score_p1??0}:${item.score_p2??0}`}/><UserHistorySection title="Reports received" items={detail?.reports} empty="No reports received." render={(item:any)=>`${formatAdminValue(item.created_at,'created_at')} · ${item.status} · ${item.reason}`}/><UserHistorySection title="Administrative audit history" items={detail?.auditHistory} empty="No administrative actions recorded." render={(item:any)=>`${formatAdminValue(item.created_at,'created_at')} · ${item.action}`}/></div>}
      {!loading&&!error&&!user&&<div className="rounded-lg border border-red-500/50 bg-[#160b0d] p-5 text-sm text-red-100">No user detail response was returned.</div>}
      {!error&&<DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>}
    </DialogContent>
  </Dialog>
}

function TournamentDetailsDialog({tournamentId,detail,loading,error,onRetry,onClose}:{tournamentId:string|null;detail:TournamentDetailResponse|null;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void}) {
  const tournament=detail?.tournament
  const fields:[string,unknown,string?][]=tournament?[
    ['ID',tournament.id],
    ['Name',tournament.name],
    ['Description',tournament.description],
    ['Format',tournament.tournament_type],
    ['Game mode',tournament.game_mode],
    ['Status',tournament.status],
    ['Maps',tournament.maps],
    ['Maximum participants',tournament.max_participants],
    ['Current participants',tournament.current_participants],
    ['Registration deadline',tournament.registration_deadline,'registration_deadline'],
    ['Start date',tournament.start_date,'start_date'],
    ['End date',tournament.end_date,'end_date'],
    ['VIP requirement',tournament.requires_vip],
    ['Entry fee',tournament.entry_fee_points],
    ['Prize pool',tournament.prize_pool_points],
    ['First-place reward',tournament.prize_1st],
    ['Second-place reward',tournament.prize_2nd],
    ['Third-place reward',tournament.prize_3rd],
    ['Created',tournament.created_at,'created_at'],
    ['Updated',tournament.updated_at,'updated_at'],
  ]:[]
  return <Dialog open={Boolean(tournamentId)} onOpenChange={open=>!open&&onClose()}>
    <DialogContent className="admin-user-details-dialog admin-dialog border-orange-500/60 bg-[#0b0b0d] text-slate-100 shadow-2xl">
      <DialogHeader><DialogTitle>Tournament details</DialogTitle><DialogDescription>Live PostgreSQL tournament data for ID {tournamentId}</DialogDescription></DialogHeader>
      {loading&&<div className="grid min-h-64 place-items-center rounded-lg border border-orange-900/30 bg-[#101012]"><div className="flex items-center gap-3 text-sm text-slate-300"><Activity size={18} className="animate-spin text-orange-400"/>Loading tournament details…</div></div>}
      {!loading&&error&&<DetailErrorState error={error} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&tournament&&<div className="space-y-4 overflow-y-auto pr-1">
        <div className="overflow-hidden rounded-lg border border-orange-900/35 bg-[#101012]"><dl className="grid min-w-0 sm:grid-cols-[180px_minmax(0,1fr)]">{fields.map(([label,value,key])=><div key={label} className="contents"><dt className="border-b border-orange-900/20 px-4 py-3 text-xs font-medium text-slate-400">{label}</dt><dd className="min-w-0 break-words border-b border-orange-900/20 px-4 py-3 text-sm text-slate-100">{formatAdminValue(value,key||label.toLowerCase().replaceAll(' ','_'))}</dd></div>)}</dl></div>
        <section className="rounded-lg border border-orange-900/25 bg-[#101012] p-4"><h3 className="mb-3 text-xs uppercase tracking-wide text-orange-400">Participants ({detail.participants.length})</h3>{detail.participants.length?<div className="divide-y divide-orange-900/15">{detail.participants.map((participant:any)=><div key={participant.user_id} className="py-3 text-xs text-slate-200"><p>{displayPlayerName({display_name:participant.display_name,username:participant.username},'Player')}</p><p className="mt-1 text-slate-500">{participant.username} · {participant.email} · Level {participant.level??0} · Registered {formatAdminValue(participant.registered_at,'registered_at')}</p></div>)}</div>:<p className="text-xs text-slate-500">No participants registered.</p>}</section>
      </div>}
      {!loading&&!error&&!tournament&&<DetailErrorState error={new AdminApiError('No tournament detail response was returned',502,'EMPTY_TOURNAMENT_DETAIL_RESPONSE')} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&tournament&&<DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>}
    </DialogContent>
  </Dialog>
}

function VipDetailsDialog({userId,detail,loading,error,onRetry,onClose}:{userId:string|null;detail:VipDetailResponse|null;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void}) {
  const user=detail?.user
  const expiresAt=user?.vip_expires_at?new Date(user.vip_expires_at):null
  const vipState=!user?.is_premium?'Inactive':expiresAt&&!Number.isNaN(expiresAt.getTime())&&expiresAt.getTime()<=Date.now()?'Expired':'Active'
  const fields:[string,unknown,string?][]=user?[
    ['User ID',user.id],
    ['Username',user.username],
    ['Email',user.email],
    ['Current VIP state',vipState],
    ['VIP since',user.vip_since,'vip_since'],
    ['VIP expiration',user.vip_expires_at,'vip_expires_at'],
    ['VIP method',user.vip_method],
    ['Points',user.points],
    ['Role',user.role],
    ['Equipped badge',user.equipped_badge],
    ['Equipped frame',user.equipped_frame],
    ['Created',user.created_at,'created_at'],
    ['Last seen',user.last_seen,'last_seen'],
  ]:[]
  return <Dialog open={Boolean(userId)} onOpenChange={open=>!open&&onClose()}>
    <DialogContent className="admin-user-details-dialog admin-dialog border-orange-500/60 bg-[#0b0b0d] text-slate-100 shadow-2xl">
      <DialogHeader><DialogTitle>VIP details</DialogTitle><DialogDescription>Live account and premium data for user ID {userId}</DialogDescription></DialogHeader>
      {loading&&<div className="grid min-h-64 place-items-center rounded-lg border border-orange-900/30 bg-[#101012]"><div className="flex items-center gap-3 text-sm text-slate-300"><Activity size={18} className="animate-spin text-orange-400"/>Loading VIP details…</div></div>}
      {!loading&&error&&<DetailErrorState error={error} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&user&&<div className="overflow-hidden rounded-lg border border-orange-900/35 bg-[#101012]"><dl className="grid min-w-0 sm:grid-cols-[170px_minmax(0,1fr)]">{fields.map(([label,value,key])=><div key={label} className="contents"><dt className="border-b border-orange-900/20 px-4 py-3 text-xs font-medium text-slate-400">{label}</dt><dd className="min-w-0 break-words border-b border-orange-900/20 px-4 py-3 text-sm text-slate-100">{formatAdminValue(value,key||label.toLowerCase().replaceAll(' ','_'))}</dd></div>)}</dl></div>}
      {!loading&&!error&&!user&&<DetailErrorState error={new AdminApiError('No VIP detail response was returned',502,'EMPTY_VIP_DETAIL_RESPONSE')} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&user&&<DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>}
    </DialogContent>
  </Dialog>
}

function LogDetailsDialog({logId,detail,loading,error,onRetry,onClose}:{logId:string|null;detail:LogDetailResponse|null;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void}) {
  const log=detail?.log
  const fields:[string,unknown,string?][]=log?[
    ['Log ID',log.id],
    ['Admin username',log.admin_username],
    ['Admin ID',log.admin_id],
    ['Action',log.action],
    ['Target type',log.target_type],
    ['Target ID',log.target_id],
    ['IP',log.ip],
    ['Created',log.created_at,'created_at'],
  ]:[]
  return <Dialog open={Boolean(logId)} onOpenChange={open=>!open&&onClose()}>
    <DialogContent className="admin-user-details-dialog admin-dialog border-orange-500/60 bg-[#0b0b0d] text-slate-100 shadow-2xl">
      <DialogHeader><DialogTitle>Audit log details</DialogTitle><DialogDescription>Immutable administration record {logId}</DialogDescription></DialogHeader>
      {loading&&<div className="grid min-h-64 place-items-center rounded-lg border border-orange-900/30 bg-[#101012]"><div className="flex items-center gap-3 text-sm text-slate-300"><Activity size={18} className="animate-spin text-orange-400"/>Loading audit log details…</div></div>}
      {!loading&&error&&<DetailErrorState error={error} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&log&&<div className="space-y-4 overflow-y-auto pr-1"><div className="overflow-hidden rounded-lg border border-orange-900/35 bg-[#101012]"><dl className="grid min-w-0 sm:grid-cols-[170px_minmax(0,1fr)]">{fields.map(([label,value,key])=><div key={label} className="contents"><dt className="border-b border-orange-900/20 px-4 py-3 text-xs font-medium text-slate-400">{label}</dt><dd className="min-w-0 break-words border-b border-orange-900/20 px-4 py-3 text-sm text-slate-100">{formatAdminValue(value,key||label.toLowerCase().replaceAll(' ','_'))}</dd></div>)}</dl></div><section className="rounded-lg border border-orange-900/25 bg-[#101012] p-4"><h3 className="mb-3 text-xs uppercase tracking-wide text-orange-400">Details JSON</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-orange-900/15 bg-black/40 p-4 text-xs leading-relaxed text-slate-200">{JSON.stringify(log.details??{},null,2)}</pre></section></div>}
      {!loading&&!error&&!log&&<DetailErrorState error={new AdminApiError('No audit log detail response was returned',502,'EMPTY_LOG_DETAIL_RESPONSE')} onRetry={onRetry} onClose={onClose}/>}
      {!loading&&!error&&log&&<DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>}
    </DialogContent>
  </Dialog>
}

function DetailErrorState({error,onRetry,onClose}:{error:AdminApiError;onRetry:()=>void;onClose:()=>void}) {
  return <div className="rounded-lg border border-red-500/50 bg-[#160b0d] p-5"><AlertTriangle className="text-red-400"/><p className="mt-3 text-sm font-semibold text-red-200">{error.code}</p><p className="mt-2 break-words text-sm text-red-100">{error.message}</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={onRetry}>Retry</Button></div></div>
}

function UserHistorySection({title,items,empty,render}:{title:string;items:any[]|undefined;empty:string;render:(item:any)=>string}) {
  return <section className="rounded-lg border border-orange-900/25 bg-[#101012] p-4"><h3 className="mb-2 text-xs uppercase tracking-wide text-orange-400">{title}</h3>{items?.length?<div className="divide-y divide-orange-900/15">{items.map((item,index)=><p key={item.id||`${title}-${index}`} className="break-words py-2 text-xs text-slate-300">{render(item)}</p>)}</div>:<p className="text-xs text-slate-500">{empty}</p>}</section>
}

function DetailDrawer({section,row,detail,loading,error,onRetry,onClose,mutate,destructive,onGenerateHostPairing}:{section:AdminSection;row:AdminRow|null;detail:any;loading:boolean;error:AdminApiError|null;onRetry:()=>void;onClose:()=>void;mutate:(p:string,m:'post'|'patch'|'delete',b?:any)=>Promise<unknown>;destructive:(t:string,d:string,r:()=>Promise<void>)=>void;onGenerateHostPairing:(host:AdminRow)=>void}) {
  if(!row)return <Sheet open={false}/>
  const hostDrawerClass=section==='hosts'?'admin-host-details-drawer':''
  if(loading)return <Sheet open onOpenChange={open=>!open&&onClose()}><SheetContent className={`${hostDrawerClass} w-full border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl`}><div className="grid h-full place-items-center text-slate-400"><Activity className="mr-2 animate-spin"/>Loading real PostgreSQL details...</div></SheetContent></Sheet>
  if(error)return <Sheet open onOpenChange={open=>!open&&onClose()}><SheetContent className={`${hostDrawerClass} w-full border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl`}><AdminLoadError error={error} onRetry={onRetry}/></SheetContent></Sheet>
  const response=detail
  row=(detail?.user||detail?.host||detail?.server||detail?.match||detail?.tournament||detail||row) as AdminRow
  const drawerTitle=displayPlayerName({display_name:row.display_name as string|undefined,displayName:row.displayName as string|undefined,username:row.username as string|undefined},String(row.name||'Record details'))
  const playerOne=displayPlayerName({display_name:row.player1_display_name as string|undefined,username:row.player1_username as string|undefined},'Player one')
  const playerTwo=displayPlayerName({display_name:row.player2_display_name as string|undefined,username:row.player2_username as string|undefined},'Player two')
  const winnerName=displayPlayerName({display_name:row.winner_display_name as string|undefined,username:row.winner_username as string|undefined},String(row.winner_id||'Not recorded'))
  const hostProfiles=Array.isArray(row.profiles)?row.profiles:[]
  const hostServers=Array.isArray(response?.servers)?response.servers:[]
  const activeHostInstances=hostServers.filter((server:any)=>server.current_match_id||server.status==='online'||server.status==='in_use')
  if(['users','vip'].includes(section)){row={...row,account_status:row.deleted_at?'deactivated':'active'};delete row.steam_avatar;delete row.custom_avatar_url;delete row.steam_profile_url;delete row.resolved_avatar;delete row.avatar_source;delete row.social_links}
  return <Sheet open={Boolean(row)} onOpenChange={open=>!open&&onClose()}><SheetContent className={`${hostDrawerClass} w-full overflow-y-auto border-orange-900/30 bg-[#0d0d0f] sm:max-w-xl`}><SheetHeader className="border-b border-orange-900/20 px-6 py-5"><SheetTitle className="text-orange-300">{drawerTitle}</SheetTitle><SheetDescription>{section.toUpperCase()} · {row.id||'catalog record'}</SheetDescription></SheetHeader><div className="space-y-6 p-6">{section!=='hosts'&&<dl className="grid gap-x-5 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)]">{Object.entries(row).slice(0,24).map(([key,value])=><div className="contents" key={key}><dt className="border-b border-orange-900/10 py-2 text-xs text-slate-600">{key.split('_').join(' ')}</dt><dd className="break-words border-b border-orange-900/10 py-2 text-xs text-slate-300">{formatAdminValue(value,key)}</dd></div>)}</dl>}{section==='hosts'&&<><section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Host Agent</h3><dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[145px_minmax(0,1fr)]"><dt>Host name</dt><dd className="text-slate-200">{String(row.name||'—')}</dd><dt>Host UUID</dt><dd className="break-all font-mono text-slate-200">{String(row.id||'—')}</dd><dt>Region</dt><dd className="text-slate-200">{String(row.region||'—')}</dd><dt>Availability</dt><dd className="text-slate-200">{row.enabled?'Enabled':'Disabled'}</dd><dt>Runtime status</dt><dd className="text-slate-200">{String(row.status||'offline').toUpperCase()}</dd><dt>Pairing</dt><dd className="text-slate-200">{row.credential_configured?'Paired':'Not configured'}</dd><dt>Agent version</dt><dd className="text-slate-200">{formatAdminValue(row.agent_version)}</dd><dt>Last seen</dt><dd className="text-slate-200">{formatAdminValue(row.last_seen_at,'last_seen_at')}</dd></dl><div className="mt-4 flex flex-wrap gap-2"><Button onClick={()=>onGenerateHostPairing(row)}>{row.credential_configured?'Re-pair / Generate new pairing code':'Generiši pairing kod'}</Button>{row.credential_configured&&<Button variant="outline" onClick={()=>destructive('Revoke host credential','Host Agent će odmah izgubiti pristup dok se ponovo ne poveže.',async()=>{await mutate(`/hosts/${row.id}/revoke`,'post',{})})}>Revoke credential</Button>}<Button variant="outline" onClick={()=>destructive(row.enabled?'Disable host':'Enable host',`${row.name} će biti ${row.enabled?'onemogućen i označen kao offline':'ponovo omogućen'}.`,async()=>{await mutate(`/hosts/${row.id}/enabled`,'post',{enabled:!row.enabled})})}>{row.enabled?'Disable host':'Enable host'}</Button></div></section><section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Capabilities / profiles</h3>{hostProfiles.length?<div className="space-y-2">{hostProfiles.map((profile:any,index:number)=><div key={String(profile.id||index)} className="rounded border border-orange-900/15 bg-black/20 p-3"><p className="text-slate-200">{String(profile.name||profile.id||`Profile ${index+1}`)}</p><p>{String(profile.gameId||profile.game_id||'Unknown game')} · {String(profile.mode||profile.gameMode||profile.game_mode||'No mode')}</p></div>)}</div>:<p>No local server profiles reported.</p>}<pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-3 text-[11px] text-slate-500">{JSON.stringify(row.capabilities??{},null,2)}</pre></section><section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Active instances</h3>{activeHostInstances.length?<div className="space-y-2">{activeHostInstances.map((server:any)=><div key={String(server.id)} className="rounded border border-orange-900/15 bg-black/20 p-3"><p className="text-slate-200">{String(server.name||server.id)}</p><p>{String(server.game_id||server.game||'Unknown game')} · {String(server.game_mode||'No mode')} · {String(server.status||'unknown')}</p>{server.current_match_id&&<p className="break-all text-orange-300">Match: {String(server.current_match_id)}</p>}</div>)}</div>:<p>No active game-server instances.</p>}<p className="mt-3 text-slate-600">{hostServers.length} total linked game server(s).</p></section></>}
    {section==='servers'&&<><section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Connection and security</h3><p>Public game endpoint: {row.public_host}:{row.public_port}</p><p>RCON endpoint: {row.rcon_host}:{row.rcon_port}</p><p>Playit tunnel: {formatAdminValue(row.playit_tunnel)}</p><p>RCON password: {row.has_rcon?'Configured (write-only)':'Not configured'}</p><p className="mt-2 text-slate-600">The encrypted RCON secret is never included in administration responses.</p></section><section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Match assignment</h3>{row.current_match_id?<p className="text-xs text-slate-300">Current match: {row.current_match_id}</p>:<p className="text-xs text-slate-500">No current match assigned.</p>}<p className="mt-2 text-xs text-slate-500">{response?.activeMatches?.length??0} compatible active match(es) available.</p></section></>}
    {response?.loginHistory&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Login history</h3>{response.loginHistory.length?response.loginHistory.map((item:any,index:number)=><p key={index} className="border-t border-orange-900/10 py-2 text-xs text-slate-400">{formatAdminValue(item.created_at,'created_at')} · {item.method} · {item.success?'success':'failed'}</p>):<p className="text-xs text-slate-500">No login history.</p>}</section>}
    {['users','vip'].includes(section)&&<section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Account access and cosmetics</h3><p>Account status: {row.deleted_at?'Deactivated':'Active'}</p><p>Steam linked: {row.steam_id?'Yes':'No'}</p><p>Owned badges: {formatAdminValue(row.owned_badges)}</p><p>Equipped badge: {formatAdminValue(row.equipped_badge)}</p><p>Owned frames: {formatAdminValue(row.owned_frames)}</p><p>Equipped frame: {formatAdminValue(row.equipped_frame)}</p><p>Created: {formatAdminValue(row.created_at,'created_at')}</p><p>Last seen: {formatAdminValue(row.last_seen,'last_seen')}</p><p>Profile visibility: {formatAdminValue(row.profile_visibility)}</p><p>Show online status: {formatAdminValue(row.show_online_status)}</p>{row.activeBan&&<div className="mt-3 rounded border border-red-500/30 bg-red-950/10 p-3 text-red-300">Active platform ban: {row.activeBan.reason} ({row.activeBan.expires_at?formatAdminValue(row.activeBan.expires_at,'expires_at'):'permanent'})</div>}</section>}
    {response?.matches&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Match history</h3><p className="text-xs text-slate-400">{response.matches.length} recent matches loaded from PostgreSQL.</p></section>}
    {response?.auditHistory&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Administrative history</h3>{response.auditHistory.length?response.auditHistory.map((item:any,index:number)=><p key={index} className="border-t border-orange-900/10 py-2 text-xs text-slate-400">{formatAdminValue(item.created_at,'created_at')} · {item.action}</p>):<p className="text-xs text-slate-500">No administrative actions recorded.</p>}</section>}
    {section==='matches'&&<section className="rounded-lg border border-orange-900/20 p-4 text-xs text-slate-400"><h3 className="mb-3 uppercase text-orange-400">Match administration</h3><p>Players: {playerOne} vs {playerTwo}</p><p>Winner: {winnerName}</p><p>Score: {row.score_p1??0} : {row.score_p2??0}</p><p>Server: {row.server_name||formatAdminValue(row.server_id)}</p><p className="mt-2 text-slate-600">Use the row action menu to edit this match.</p></section>}
    {section==='logs'&&<section className="rounded-lg border border-orange-900/20 p-4"><h3 className="mb-3 text-xs uppercase text-orange-400">Audit payload</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(row.details??{},null,2)}</pre></section>}
    {section==='reports'&&<p className="rounded border border-orange-900/20 p-3 text-xs text-slate-500">Use the report row action menu for audited moderation decisions and admin notes.</p>}
    {section==='support'&&<SupportTicketEditor ticket={row} onSave={(status,response)=>mutate(`/support-tickets/${row.id}`,'patch',{status,response})}/>}
    {section==='bans'&&<p className="rounded border border-orange-900/20 p-3 text-xs text-slate-500">Use the ban row action menu to edit duration or remove the restriction.</p>}
  </div></SheetContent></Sheet>
}

function SupportTicketEditor({ticket,onSave}:{ticket:AdminRow;onSave:(status:string,response:string)=>Promise<unknown>}) {
  const [status,setStatus]=useState(String(ticket.status||'open'))
  const [response,setResponse]=useState(String(ticket.admin_response||''))
  const [saving,setSaving]=useState(false)
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setSaving(true);try{await onSave(status,response.trim())}finally{setSaving(false)}}
  return <form onSubmit={submit} className="space-y-4 rounded-lg border border-orange-900/25 bg-black/20 p-4"><h3 className="text-xs uppercase tracking-wide text-orange-400">Support response</h3><label className="block text-xs text-slate-400">Status<select value={status} onChange={event=>setStatus(event.target.value)} className="mt-2 h-10 w-full rounded border border-orange-900/30 bg-black/30 px-3"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="block text-xs text-slate-400">Response<textarea aria-label="Support response" value={response} maxLength={5000} onChange={event=>setResponse(event.target.value)} className="mt-2 min-h-32 w-full rounded border border-orange-900/30 bg-black/30 p-3 text-sm text-slate-200"/></label><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-600">{response.length}/5000</span><Button type="submit" disabled={saving||(['resolved','closed'].includes(status)&&!response.trim())}>{saving?'Saving...':'Save response'}</Button></div></form>
}
