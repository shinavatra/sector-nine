import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { storeAPI } from '../utils/api'

type FrameVisual={style:string;assetUrl:string|null}
let frameStyleCache:Map<string,FrameVisual>|null=null
let frameStyleRequest:Promise<Map<string,FrameVisual>>|null=null
const loadFrameStyles=()=>{
  if(frameStyleCache)return Promise.resolve(frameStyleCache)
  if(!frameStyleRequest)frameStyleRequest=storeAPI.getCatalog().then((response:any)=>{
    frameStyleCache=new Map((Array.isArray(response?.frames)?response.frames:[]).map((frame:any)=>[
      String(frame.id),
      {style:String(frame.style||''),assetUrl:typeof frame.metadata?.assetUrl==='string'?frame.metadata.assetUrl:null},
    ]))
    return frameStyleCache
  }).catch(()=>{
    frameStyleRequest=null
    return new Map<string,FrameVisual>()
  })
  return frameStyleRequest
}

export function FramedAvatar({frameId,children,className=''}:{frameId:string|null|undefined;children:ReactNode;className?:string}) {
  const [visual,setVisual]=useState<FrameVisual>(()=>frameId&&frameStyleCache?.get(frameId)||{style:'',assetUrl:null})
  useEffect(()=>{
    let active=true
    if(!frameId){setVisual({style:'',assetUrl:null});return()=>{active=false}}
    void loadFrameStyles().then(styles=>{if(active)setVisual(styles.get(frameId)||{style:'',assetUrl:null})})
    return()=>{active=false}
  },[frameId])
  const hasFrame=Boolean(frameId&&frameId!=='fr_basic')
  return <div className={`relative inline-flex shrink-0 ${hasFrame&&!visual.assetUrl?(visual.style||'ring-2 ring-orange-400 shadow-lg shadow-orange-500/30'):''} ${className}`}>
    <div className="h-full w-full overflow-hidden rounded-[18%]">{children}</div>
    {hasFrame&&visual.assetUrl&&<img src={visual.assetUrl} alt="" aria-hidden="true" className="pointer-events-none absolute -inset-[12%] z-10 h-[124%] w-[124%] max-w-none object-fill" />}
  </div>
}
