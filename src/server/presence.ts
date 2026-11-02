export type PresenceState='online'|'away'|'in_match'|'offline'

export const PRESENCE_LEASE_SECONDS=Math.max(45,Number.parseInt(process.env.PRESENCE_LEASE_SECONDS||'75',10)||75)
export const PRESENCE_AWAY_SECONDS=Math.max(60,Number.parseInt(process.env.PRESENCE_AWAY_SECONDS||'300',10)||300)

export const presenceStatusSql=(alias='u')=>`CASE
  WHEN ${alias}.deleted_at IS NOT NULL OR ${alias}.show_online_status IS NOT TRUE THEN 'offline'
  WHEN EXISTS(SELECT 1 FROM matches presence_match WHERE presence_match.status='in_progress' AND (${alias}.id=presence_match.player1_id OR ${alias}.id=presence_match.player2_id)) THEN 'in_match'
  WHEN EXISTS(SELECT 1 FROM player_presence_leases presence_lease WHERE presence_lease.user_id=${alias}.id AND presence_lease.expires_at>NOW() AND presence_lease.last_activity>NOW()-INTERVAL '${PRESENCE_AWAY_SECONDS} seconds') THEN 'online'
  WHEN EXISTS(SELECT 1 FROM player_presence_leases presence_lease WHERE presence_lease.user_id=${alias}.id AND presence_lease.expires_at>NOW()) THEN 'away'
  ELSE 'offline' END`

export const onlineUserPredicate=(alias='u')=>`(${presenceStatusSql(alias)}) IN ('online','in_match')`

export const isPresenceOnline=(state:PresenceState)=>state==='online'||state==='in_match'

export const derivePresenceState=({visible=true,inMatch=false,now=Date.now(),leases=[]}:{visible?:boolean;inMatch?:boolean;now?:number;leases?:Array<{expiresAt:number;lastActivity:number}>}):PresenceState=>{
  if(!visible)return'offline'
  if(inMatch)return'in_match'
  const active=leases.filter(lease=>lease.expiresAt>now)
  if(active.some(lease=>lease.lastActivity>now-PRESENCE_AWAY_SECONDS*1000))return'online'
  return active.length?'away':'offline'
}
