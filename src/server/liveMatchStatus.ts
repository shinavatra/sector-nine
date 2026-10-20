export type LiveMatchStatus='waiting'|'accepting'|'veto'|'assigned'|'starting'|'running'|'finished'|'cancelled'|'error'

export function deriveLiveMatchStatus(match:any,now=Date.now()):LiveMatchStatus {
  if(match.status==='completed')return'finished'
  if(match.status==='cancelled')return'cancelled'
  if(match.server_error)return'error'
  const serverStale=!match.server_last_heartbeat||now-new Date(match.server_last_heartbeat).getTime()>30_000
  const hostStale=match.host_id&&(!match.host_enabled||!match.host_last_seen_at||now-new Date(match.host_last_seen_at).getTime()>30_000)
  if(match.status==='in_progress')return serverStale||hostStale?'error':'running'
  if(match.server_id){
    if(hostStale)return'error'
    if(match.profile_lifecycle_status==='starting')return'starting'
    return'assigned'
  }
  const accepted=Number(match.accepted_count||0)
  if(accepted<2)return accepted===0?'waiting':'accepting'
  if(!match.selected_map)return'veto'
  return'assigned'
}

export function liveMatchDurationSeconds(match:any,now=Date.now()):number|null {
  if(!match.started_at)return null
  const end=match.completed_at?new Date(match.completed_at).getTime():now
  return Math.max(0,Math.floor((end-new Date(match.started_at).getTime())/1000))
}
