import { isIP } from 'net'
import { normalizePublicServerEndpoint } from '../shared/serverEndpoint'

export const SERVER_HEARTBEAT_STALE_SECONDS=Math.max(30,Math.min(300,Number(process.env.SERVER_HEARTBEAT_STALE_SECONDS)||60))

export type LiveServerStatus='online'|'offline'|'starting'|'in_match'
export type ServerAvailability='reachable'|'idle'|'reserved'|'active_match'|'offline'

export interface ServerBrowserRow {
  id:string
  name:string
  game_id:string
  game_mode?:string|null
  region:string
  public_host?:string|null
  public_port?:number|null
  max_slots?:number|null
  status?:string|null
  current_players?:number|null
  current_map?:string|null
  last_heartbeat?:string|Date|null
  current_match_id?:string|null
  current_match_status?:string|null
  profile_matchmaking_enabled?:boolean|null
  has_host_profile?:boolean|null
}

const privateIpv4=(host:string)=>{
  const octets=host.split('.').map(Number)
  return octets[0]===0||octets[0]===10||octets[0]===127||octets[0]>=224||
    (octets[0]===100&&octets[1]>=64&&octets[1]<=127)||(octets[0]===169&&octets[1]===254)||
    (octets[0]===172&&octets[1]>=16&&octets[1]<=31)||(octets[0]===192&&[0,168].includes(octets[1]))||
    (octets[0]===198&&[18,19].includes(octets[1]))||(octets[0]===198&&octets[1]===51&&octets[2]===100)||
    (octets[0]===203&&octets[1]===0&&octets[2]===113)
}

export const isSafePublicServerHost=(value:unknown)=>{
  const host=typeof value==='string'?value.trim().toLowerCase():''
  if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal'))return false
  const version=isIP(host)
  if(version===4)return !privateIpv4(host)
  if(version===6)return !(host==='::'||host==='::1'||host.startsWith('fc')||host.startsWith('fd')||host.startsWith('fe8')||host.startsWith('fe9')||host.startsWith('fea')||host.startsWith('feb'))
  return host.includes('.')
}

export function mapServerBrowserRow(row:ServerBrowserRow,now=new Date(),staleSeconds=SERVER_HEARTBEAT_STALE_SECONDS){
  const heartbeat=row.last_heartbeat?new Date(row.last_heartbeat):null
  const heartbeatTime=heartbeat?.getTime()||0
  const stale=!heartbeatTime||now.getTime()-heartbeatTime>staleSeconds*1000
  const storedStatus=String(row.status||'offline').toLowerCase()
  const unhealthy=['offline','error','unhealthy','disabled','maintenance'].includes(storedStatus)
  const hasMatch=Boolean(row.current_match_id)
  const activeMatch=hasMatch&&String(row.current_match_status||'').toLowerCase()==='in_progress'
  const liveStatus:LiveServerStatus=stale||unhealthy?'offline':activeMatch||hasMatch?'in_match':storedStatus==='starting'?'starting':'online'
  const availability:ServerAvailability=liveStatus==='offline'?'offline':activeMatch?'active_match':hasMatch?'reserved':row.profile_matchmaking_enabled?'idle':'reachable'
  const endpoint=normalizePublicServerEndpoint(row.public_host,row.public_port)
  const protectedCompetitive=Boolean(row.has_host_profile||row.profile_matchmaking_enabled||hasMatch)
  const publicEndpoint=endpoint&&isSafePublicServerHost(endpoint.host)&&!protectedCompetitive?endpoint:null
  const currentPlayers=Math.max(0,Number(row.current_players)||0)
  const maxPlayers=Math.max(0,Number(row.max_slots)||0)
  return {
    id:String(row.id),name:String(row.name||'Game server'),gameId:String(row.game_id),modeId:row.game_mode?String(row.game_mode):null,
    region:String(row.region||'unknown'),status:liveStatus,availability,stale,currentMap:row.current_map?String(row.current_map):null,
    currentPlayers,maxPlayers,lastHeartbeat:heartbeatTime?heartbeat!.toISOString():null,
    address:publicEndpoint?.endpoint||null,canCopyAddress:Boolean(publicEndpoint),protectedCompetitive,
  }
}
