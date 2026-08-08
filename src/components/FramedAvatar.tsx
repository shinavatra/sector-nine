import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { storeAPI } from '../utils/api'

let frameStyleCache:Map<string,string>|null=null
let frameStyleRequest:Promise<Map<string,string>>|null=null
const loadFrameStyles=()=>{
  if(frameStyleCache)return Promise.resolve(frameStyleCache)
  if(!frameStyleRequest)frameStyleRequest=storeAPI.getCatalog().then((response:any)=>{
    frameStyleCache=new Map((Array.isArray(response?.frames)?response.frames:[]).map((frame:any)=>[String(frame.id),String(frame.style||'')]))
    return frameStyleCache
  }).catch(()=>{
    frameStyleRequest=null
    return new Map<string,string>()
  })
  return frameStyleRequest
}

export function FramedAvatar({frameId,children,className=''}:{frameId:string|null|undefined;children:ReactNode;className?:string}) {
  const [style,setStyle]=useState(()=>frameId&&frameStyleCache?.get(frameId)||'')
  useEffect(()=>{
    let active=true
    if(!frameId){setStyle('');return()=>{active=false}}
    void loadFrameStyles().then(styles=>{if(active)setStyle(styles.get(frameId)||'')})
    return()=>{active=false}
  },[frameId])
  const hasFrame=Boolean(frameId&&frameId!=='fr_basic')
  return <div className={`relative inline-flex shrink-0 rounded-full ${hasFrame?(style||'ring-2 ring-orange-400 shadow-lg shadow-orange-500/30'):''} ${className}`}>{children}</div>
}
