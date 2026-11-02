import crypto from 'crypto'
import type { Request,Response } from 'express'

export type RealtimeEventType='connected'|'chat.message'|'notification.changed'|'party.invite'|'party.changed'|'presence.changed'|'presence.snapshot'
export type RealtimeEvent={id:string;type:RealtimeEventType;createdAt:string;payload:Record<string,unknown>}

type Client={id:string;response:Response;heartbeat:ReturnType<typeof setInterval>}
type ConnectionOptions={validate?:()=>Promise<boolean>;onConnected?:(connectionId:string)=>Promise<void>|void;onHeartbeat?:(connectionId:string)=>Promise<void>|void;onClosed?:(connectionId:string)=>Promise<void>|void}

export class RealtimeHub{
  private clients=new Map<string,Map<string,Client>>()

  connect(userId:string,request:Request,response:Response,options:ConnectionOptions={}){
    response.status(200)
    response.setHeader('Content-Type','text/event-stream; charset=utf-8')
    response.setHeader('Cache-Control','no-cache, no-transform')
    response.setHeader('Connection','keep-alive')
    response.setHeader('X-Accel-Buffering','no')
    response.flushHeaders()
    response.write('retry: 3000\n\n')
    let validationRunning=false
    const id=crypto.randomUUID(),heartbeat=setInterval(async()=>{
      if(response.writableEnded||validationRunning)return
      validationRunning=true
      try{
        if(options.validate&&!(await options.validate())){close();return}
        await options.onHeartbeat?.(id)
        response.write(': heartbeat\n\n')
      }catch{close()}finally{validationRunning=false}
    },25_000)
    heartbeat.unref?.()
    const client={id,response,heartbeat},userClients=this.clients.get(userId)||new Map<string,Client>()
    userClients.set(id,client);this.clients.set(userId,userClients)
    this.send(client,this.event('connected',{connectionId:id}))
    void Promise.resolve(options.onConnected?.(id)).catch(()=>close())
    let closed=false
    const close=()=>{if(closed)return;closed=true;clearInterval(heartbeat);const current=this.clients.get(userId);current?.delete(id);if(!current?.size)this.clients.delete(userId);void Promise.resolve(options.onClosed?.(id)).catch(()=>undefined);if(!response.writableEnded)response.end()}
    request.once('close',close);response.once('close',close)
    return close
  }

  publish(userIds:Iterable<string>,type:Exclude<RealtimeEventType,'connected'>,payload:Record<string,unknown>={}){
    const event=this.event(type,payload)
    for(const userId of new Set(Array.from(userIds,String))){for(const client of this.clients.get(userId)?.values()||[])this.send(client,event)}
    return event
  }

  connectionCount(userId?:string){if(userId)return this.clients.get(userId)?.size||0;return Array.from(this.clients.values()).reduce((sum,clients)=>sum+clients.size,0)}
  ownsConnection(userId:string,connectionId:string){return this.clients.get(userId)?.has(connectionId)||false}

  publishConnection(userId:string,connectionId:string,type:Exclude<RealtimeEventType,'connected'>,payload:Record<string,unknown>={}){const client=this.clients.get(userId)?.get(connectionId);if(!client)return null;const event=this.event(type,payload);this.send(client,event);return event}

  private event(type:RealtimeEventType,payload:Record<string,unknown>):RealtimeEvent{return{id:crypto.randomUUID(),type,createdAt:new Date().toISOString(),payload}}
  private send(client:Client,event:RealtimeEvent){if(client.response.writableEnded)return;client.response.write(`id: ${event.id}\nevent: sector-nine\ndata: ${JSON.stringify(event)}\n\n`)}
}

export const realtimeHub=new RealtimeHub()
