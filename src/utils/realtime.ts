import{getApiBaseUrl,getSessionToken,refreshSessionAccessToken}from'./api'

export type RealtimeStatus='connecting'|'connected'|'reconnecting'|'disconnected'
export type SectorRealtimeEvent={id:string;type:'connected'|'chat.message'|'notification.changed'|'party.invite'|'party.changed'|'presence.changed'|'presence.snapshot'|'server.status'|'match.changed';createdAt:string;payload:Record<string,any>}
type EventListener=(event:SectorRealtimeEvent)=>void
type StatusListener=(status:RealtimeStatus)=>void

export const decodeRealtimeFrame=(frame:string):SectorRealtimeEvent|null=>{
  const data=frame.replace(/\r\n/g,'\n').split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n')
  if(!data)return null
  try{const parsed=JSON.parse(data);return parsed&&typeof parsed.id==='string'&&typeof parsed.type==='string'&&parsed.payload&&typeof parsed.payload==='object'?parsed:null}catch{return null}
}

class RealtimeConnection{
  private eventListeners=new Set<EventListener>()
  private statusListeners=new Set<StatusListener>()
  private controller:AbortController|null=null
  private reconnectTimer:ReturnType<typeof setTimeout>|null=null
  private status:RealtimeStatus='disconnected'
  private attempts=0
  private generation=0
  private seenIds=new Set<string>()
  private seenOrder:string[]=[]
  private connectionId:string|null=null
  private readonly maxAttempts=6

  subscribe(listener:EventListener,onStatus?:StatusListener){this.eventListeners.add(listener);if(onStatus){this.statusListeners.add(onStatus);onStatus(this.status)}if(this.eventListeners.size===1)this.connect(false);return()=>{this.eventListeners.delete(listener);if(onStatus)this.statusListeners.delete(onStatus);if(!this.eventListeners.size)this.stop()}}
  reconnect(){if(!this.eventListeners.size)return;this.attempts=0;this.stopTransport();this.connect(true)}
  getConnectionId(){return this.connectionId}

  private setStatus(status:RealtimeStatus){if(this.status===status)return;this.status=status;for(const listener of this.statusListeners)listener(status)}
  private connect(reconnecting:boolean){if(this.controller||this.reconnectTimer||!this.eventListeners.size)return;const token=getSessionToken();if(!token){this.setStatus('disconnected');return}this.setStatus(reconnecting?'reconnecting':'connecting');const generation=++this.generation,controller=new AbortController();this.controller=controller;void this.open(token,controller.signal,generation)}
  private async open(token:string,signal:AbortSignal,generation:number){try{let response=await fetch(`${getApiBaseUrl()}/events`,{headers:{Accept:'text/event-stream',Authorization:`Bearer ${token}`},credentials:'include',cache:'no-store',signal});if(response.status===401){const refreshed=await refreshSessionAccessToken();if(!refreshed)throw new Error('REALTIME_AUTH_REQUIRED');response=await fetch(`${getApiBaseUrl()}/events`,{headers:{Accept:'text/event-stream',Authorization:`Bearer ${refreshed}`},credentials:'include',cache:'no-store',signal})}if(!response.ok||!response.body)throw new Error(`REALTIME_HTTP_${response.status}`);if(generation!==this.generation)return;this.attempts=0;this.setStatus('connected');const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';while(true){const result=await reader.read();if(result.done)break;buffer=(buffer+decoder.decode(result.value,{stream:true})).replace(/\r\n/g,'\n');let boundary=buffer.indexOf('\n\n');while(boundary>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const event=decodeRealtimeFrame(frame);if(event)this.dispatch(event);boundary=buffer.indexOf('\n\n')}}if(!signal.aborted)throw new Error('REALTIME_STREAM_ENDED')}catch{if(!signal.aborted&&generation===this.generation)this.scheduleReconnect()}finally{if(generation===this.generation)this.controller=null}}
  private dispatch(event:SectorRealtimeEvent){if(this.seenIds.has(event.id))return;if(event.type==='connected')this.connectionId=String(event.payload.connectionId||'')||null;this.seenIds.add(event.id);this.seenOrder.push(event.id);if(this.seenOrder.length>500){const oldest=this.seenOrder.shift();if(oldest)this.seenIds.delete(oldest)}for(const listener of this.eventListeners)listener(event)}
  private scheduleReconnect(){this.controller=null;this.attempts+=1;if(this.attempts>this.maxAttempts){this.setStatus('disconnected');return}this.setStatus('reconnecting');const delay=Math.min(1000*2**(this.attempts-1),15000);this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.connect(true)},delay)}
  private stopTransport(){this.generation+=1;this.connectionId=null;this.controller?.abort();this.controller=null;if(this.reconnectTimer)clearTimeout(this.reconnectTimer);this.reconnectTimer=null}
  private stop(){this.stopTransport();this.attempts=0;this.setStatus('disconnected')}
}

const connection=new RealtimeConnection()
export const subscribeRealtime=(listener:EventListener,onStatus?:StatusListener)=>connection.subscribe(listener,onStatus)
export const reconnectRealtime=()=>connection.reconnect()
export const getRealtimeConnectionId=()=>connection.getConnectionId()
