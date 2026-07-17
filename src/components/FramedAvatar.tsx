import type { ReactNode } from 'react'
import { profileFrames } from '../utils/badgeData'

export function FramedAvatar({frameId,children,className=''}:{frameId:string|null|undefined;children:ReactNode;className?:string}) {
  const frame=frameId?profileFrames.find(item=>item.id===frameId):null
  const tone=frame?.rarity==='LEGENDARY'?'ring-yellow-300 shadow-yellow-400/40':frame?.rarity==='EPIC'?'ring-purple-400 shadow-purple-500/40':frame?.rarity==='RARE'?'ring-blue-400 shadow-blue-500/40':frame?.rarity==='VIP'?'ring-amber-300 shadow-amber-400/40':'ring-orange-400 shadow-orange-500/30'
  return <div className={`relative inline-flex shrink-0 rounded-full ${frame?`ring-2 shadow-lg ${tone}`:''} ${className}`}>{children}</div>
}
