export type HostAgentPlayer={name:string;steamId:string}
export type HostAgentStats={score_p1:number;score_p2:number;p1_kills:number;p1_deaths:number;p2_kills:number;p2_deaths:number}
export type HostAgentReport=
  |{type:'heartbeat';playerCount:number;players:HostAgentPlayer[];map:string|null;observedAt:string|null}
  |{type:'player_snapshot';playerCount:number;players:HostAgentPlayer[];map:string|null;observedAt:string|null}
  |{type:'match_running';playerCount:number;players:HostAgentPlayer[];map:string;observedAt:string|null;demoUrl:string|null}
  |{type:'match_completed';reportId:string;winnerId:string;stats:HostAgentStats;playerCount:number;players:HostAgentPlayer[];map:string|null;observedAt:string|null;demoUrl:string|null}

export class HostAgentProtocolError extends Error{
  constructor(public code:string,message:string,public status=400){super(message)}
}

const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const exact=(value:Record<string,unknown>,allowed:string[])=>{
  const unexpected=Object.keys(value).filter(key=>!allowed.includes(key))
  if(unexpected.length)throw new HostAgentProtocolError('UNSUPPORTED_FIELD',`Unsupported field: ${unexpected[0]}`)
}
const integer=(value:unknown,name:string,max=100000)=>{
  if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>max)throw new HostAgentProtocolError('INVALID_FIELD',`${name} must be an integer between 0 and ${max}`)
  return value
}
const optionalText=(value:unknown,name:string,max:number,required=false)=>{
  if(value===undefined||value===null){if(required)throw new HostAgentProtocolError('INVALID_FIELD',`${name} is required`);return null}
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HostAgentProtocolError('INVALID_FIELD',`${name} must be a non-empty string no longer than ${max} characters`)
  return value.trim()
}
const uuid=(value:unknown,name:string)=>{
  const text=optionalText(value,name,36,true)!
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text))throw new HostAgentProtocolError('INVALID_FIELD',`${name} must be a UUID`)
  return text.toLowerCase()
}
const observedAt=(value:unknown)=>{
  if(value===undefined||value===null)return null
  if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))throw new HostAgentProtocolError('INVALID_FIELD','observedAt must be an ISO-8601 timestamp')
  const milliseconds=Date.parse(value),now=Date.now()
  if(milliseconds>now+5*60_000||milliseconds<now-24*60*60_000)throw new HostAgentProtocolError('STALE_TIMESTAMP','observedAt must be within the last 24 hours and no more than 5 minutes in the future')
  return new Date(milliseconds).toISOString()
}
const demoUrl=(value:unknown)=>{
  if(value===undefined||value===null)return null
  const text=optionalText(value,'demoUrl',2000,true)!
  let parsed:URL
  try{parsed=new URL(text)}catch{throw new HostAgentProtocolError('INVALID_FIELD','demoUrl must be a valid HTTP(S) URL')}
  if(!['http:','https:'].includes(parsed.protocol))throw new HostAgentProtocolError('INVALID_FIELD','demoUrl must be a valid HTTP(S) URL')
  return parsed.toString()
}
const players=(value:unknown,required:boolean)=>{
  if(value===undefined&&!required)return []
  if(!Array.isArray(value)||value.length>128)throw new HostAgentProtocolError('INVALID_PLAYERS','players must be an array with at most 128 entries')
  return value.map((entry,index)=>{
    if(!object(entry)){throw new HostAgentProtocolError('INVALID_PLAYERS',`players[${index}] must be an object`)}
    exact(entry,['name','steamId'])
    const name=optionalText(entry.name,`players[${index}].name`,100,true)!
    const steamId=optionalText(entry.steamId,`players[${index}].steamId`,40,true)!
    if(!/^(STEAM_[0-5]:[01]:\d{1,20}|\[U:1:\d{1,20}\]|7656119\d{10})$/.test(steamId))throw new HostAgentProtocolError('INVALID_PLAYERS',`players[${index}].steamId is not a supported Steam ID`)
    return{name,steamId}
  })
}
const stats=(value:unknown):HostAgentStats=>{
  if(!object(value))throw new HostAgentProtocolError('INVALID_STATS','stats must be an object')
  const keys=['score_p1','score_p2','p1_kills','p1_deaths','p2_kills','p2_deaths']
  exact(value,keys)
  return Object.fromEntries(keys.map(key=>[key,integer(value[key],`stats.${key}`)])) as HostAgentStats
}

export const parseHostAgentReport=(input:unknown):HostAgentReport=>{
  if(!object(input))throw new HostAgentProtocolError('INVALID_BODY','Request body must be an object')
  if(!['heartbeat','player_snapshot','match_running','match_completed'].includes(String(input.type||'')))throw new HostAgentProtocolError('INVALID_REPORT_TYPE','type must be heartbeat, player_snapshot, match_running, or match_completed')
  const type=input.type as HostAgentReport['type']
  const common=['type','playerCount','players','map','observedAt']
  exact(input,type==='match_completed'?[...common,'reportId','winnerId','stats','demoUrl']:type==='match_running'?[...common,'demoUrl']:common)
  const parsedPlayers=players(input.players,type!=='heartbeat')
  const playerCount=integer(input.playerCount,'playerCount',256)
  if(parsedPlayers.length>playerCount)throw new HostAgentProtocolError('INVALID_PLAYERS','players cannot contain more entries than playerCount')
  const map=optionalText(input.map,'map',100,type==='match_running')
  const time=observedAt(input.observedAt)
  if(type==='match_completed')return{type,reportId:uuid(input.reportId,'reportId'),winnerId:uuid(input.winnerId,'winnerId'),stats:stats(input.stats),playerCount,players:parsedPlayers,map,observedAt:time,demoUrl:demoUrl(input.demoUrl)}
  if(type==='match_running')return{type,playerCount,players:parsedPlayers,map:map!,observedAt:time,demoUrl:demoUrl(input.demoUrl)}
  return{type,playerCount,players:parsedPlayers,map:map as any,observedAt:time} as HostAgentReport
}
