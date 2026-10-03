export type HostAgentKillEvent={
  type:'kill'
  eventId:string
  sequence:number
  occurredAt:string
  actorUserId:string|null
  targetUserId:string
  weapon:string|null
}

export class HostAgentEventError extends Error{
  constructor(public code:string,message:string,public status=400){super(message)}
}

const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const uuid=(value:unknown,name:string,nullable=false)=>{
  if(nullable&&value===null)return null
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new HostAgentEventError('INVALID_EVENT',`${name} must be a UUID${nullable?' or null':''}`)
  return value.toLowerCase()
}

export const parseHostAgentEvent=(input:unknown):HostAgentKillEvent=>{
  if(!object(input))throw new HostAgentEventError('INVALID_EVENT','Event body must be an object')
  const allowed=['type','eventId','sequence','occurredAt','actorUserId','targetUserId','weapon']
  const unexpected=Object.keys(input).find(key=>!allowed.includes(key))
  if(unexpected)throw new HostAgentEventError('UNSUPPORTED_EVENT_FIELD',`Unsupported event field: ${unexpected}`)
  if(input.type!=='kill')throw new HostAgentEventError('UNSUPPORTED_EVENT_TYPE','Only normalized HL1 kill events are supported')
  if(typeof input.sequence!=='number'||!Number.isInteger(input.sequence)||input.sequence<1||input.sequence>1_000_000)throw new HostAgentEventError('INVALID_EVENT_SEQUENCE','sequence must be an integer between 1 and 1000000')
  if(typeof input.occurredAt!=='string'||input.occurredAt.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input.occurredAt)||!Number.isFinite(Date.parse(input.occurredAt)))throw new HostAgentEventError('INVALID_EVENT_TIMESTAMP','occurredAt must be a UTC ISO-8601 timestamp')
  const occurred=Date.parse(input.occurredAt),now=Date.now()
  if(occurred<now-24*60*60_000||occurred>now+5*60_000)throw new HostAgentEventError('INVALID_EVENT_TIMESTAMP','occurredAt must be within the last 24 hours and no more than 5 minutes in the future')
  let weapon:string|null=null
  if(input.weapon!==undefined&&input.weapon!==null){if(typeof input.weapon!=='string'||!/^[A-Za-z0-9_.-]{1,64}$/.test(input.weapon))throw new HostAgentEventError('INVALID_EVENT_WEAPON','weapon contains unsupported characters or length');weapon=input.weapon}
  return{type:'kill',eventId:uuid(input.eventId,'eventId')!,sequence:input.sequence,occurredAt:new Date(occurred).toISOString(),actorUserId:uuid(input.actorUserId,'actorUserId',true),targetUserId:uuid(input.targetUserId,'targetUserId')!,weapon}
}
