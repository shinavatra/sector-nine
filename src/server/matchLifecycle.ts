import { hl1EngineMapName } from './hl1MatchContract'

export type ParticipantMatchLifecycle='waiting_for_server'|'server_starting'|'ready'|'waiting_for_players'|'in_progress'|'server_error'

export function deriveParticipantMatchLifecycle(match:any,now=Date.now()):{phase:ParticipantMatchLifecycle;serverReady:boolean;failureReason:string|null}{
  if(!match.server_id)return{phase:'waiting_for_server',serverReady:false,failureReason:null}
  const serverFresh=Boolean(match.server_last_heartbeat)&&now-new Date(match.server_last_heartbeat).getTime()<=30_000
  const hostFresh=!match.host_id||Boolean(match.host_enabled&&match.host_last_seen_at)&&now-new Date(match.host_last_seen_at).getTime()<=30_000
  const profileFresh=!match.host_id||Boolean(match.profile_last_seen_at)&&now-new Date(match.profile_last_seen_at).getTime()<=30_000
  const expectedMap=match.game_id==='hl1'?hl1EngineMapName(match.selected_map):match.selected_map
  const mapReady=Boolean(expectedMap&&match.server_current_map&&String(match.server_current_map).toLowerCase()===String(expectedMap).toLowerCase())
  const assignmentAcknowledged=!match.host_id||(String(match.profile_reported_match_id||'')===String(match.id)&&match.profile_reported_state==='running')
  const explicitFailure=Boolean(match.server_last_error)||['failed','offline'].includes(String(match.profile_reported_state||''))||match.profile_lifecycle_status==='server_error'
  if(explicitFailure)return{phase:'server_error',serverReady:false,failureReason:String(match.server_last_error||'Host Agent reported a server startup failure.')}
  if(match.status==='in_progress')return serverFresh&&hostFresh?{phase:'in_progress',serverReady:true,failureReason:null}:{phase:'server_error',serverReady:false,failureReason:'Live server telemetry is stale.'}
  const serverReady=serverFresh&&hostFresh&&profileFresh&&assignmentAcknowledged&&mapReady
  if(!serverReady)return{phase:'server_starting',serverReady:false,failureReason:null}
  return Number(match.server_current_players||0)>0?{phase:'waiting_for_players',serverReady:true,failureReason:null}:{phase:'ready',serverReady:true,failureReason:null}
}
