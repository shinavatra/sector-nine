export interface PlayerResultContext {
  isParticipant: boolean
  matchStatus: string
  enabled: boolean
}

export interface PlayerResultRejection {
  status: 403 | 409
  code: 'MATCH_RESULT_FORBIDDEN' | 'TRUSTED_RESULT_REQUIRED' | 'MATCH_ALREADY_COMPLETED' | 'MATCH_NOT_IN_PROGRESS'
  error: string
}

export const isDevelopmentPlayerResultEnabled=(env:NodeJS.ProcessEnv=process.env)=>
  env.NODE_ENV!=='production'&&env.ALLOW_PLAYER_RESULT_SUBMISSION==='true'

export const playerResultRejection=({isParticipant,matchStatus,enabled}:PlayerResultContext):PlayerResultRejection|null=>{
  if(!isParticipant)return{status:403,code:'MATCH_RESULT_FORBIDDEN',error:'Only match participants may access development result submission'}
  if(matchStatus==='completed')return{status:409,code:'MATCH_ALREADY_COMPLETED',error:'This match has already been completed'}
  if(matchStatus!=='in_progress')return{status:409,code:'MATCH_NOT_IN_PROGRESS',error:'Only an in-progress match can receive a result'}
  if(!enabled)return{status:403,code:'TRUSTED_RESULT_REQUIRED',error:'Ranked match results must be submitted by the assigned game server or an administrator'}
  return null
}
