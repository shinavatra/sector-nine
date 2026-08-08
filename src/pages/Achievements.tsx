import { useEffect,useMemo,useState } from 'react'
import { Award,Lock,Loader2 } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Card,CardContent,CardHeader,CardTitle } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { useUser } from '../contexts/UserContext'
import { achievementAPI } from '../utils/api'

type CatalogBadge={id:string;name:string;description?:string;icon?:string;rarity?:string;vip_only?:boolean;metadata?:Record<string,any>}

const rarityClass=(rarity:string)=>({
  COMMON:'border-gray-700 text-gray-300',UNCOMMON:'border-green-700 text-green-300',
  RARE:'border-blue-700 text-blue-300',EPIC:'border-purple-700 text-purple-300',
  LEGENDARY:'border-orange-600 text-orange-300',VIP_EXCLUSIVE:'border-yellow-600 text-yellow-300',
}[rarity]||'border-gray-700 text-gray-300')

export function Achievements(){
  const {user}=useUser()
  const [badges,setBadges]=useState<CatalogBadge[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;achievementAPI.getBadges().then((data:any)=>{if(active){setBadges(Array.isArray(data?.badges)?data.badges:[]);setError('')}}).catch((reason:any)=>active&&setError(reason?.message||'Unable to load achievements')).finally(()=>active&&setLoading(false));return()=>{active=false}},[])
  const owned=useMemo(()=>new Set(user?.ownedBadges||[]),[user?.ownedBadges])
  const progressFor=(badge:CatalogBadge)=>{
    if(owned.has(badge.id))return 100
    const stat=String(badge.metadata?.progressStat||'')
    const target=Number(badge.metadata?.progressTarget)
    const current=Number((user?.stats as any)?.[stat]??(user as any)?.[stat])
    return stat&&Number.isFinite(target)&&target>0&&Number.isFinite(current)?Math.min(99,Math.max(0,Math.round(current/target*100))):0
  }
  const requirementFor=(badge:CatalogBadge)=>String(badge.metadata?.unlockRule||badge.metadata?.requirements||(badge.vip_only?'Maintain active VIP status':'Complete the listed achievement requirements'))
  if(loading)return <div className="grid min-h-[60vh] place-items-center"><div className="flex items-center gap-3 font-mono text-gray-400"><Loader2 className="animate-spin text-orange-400"/>Loading achievements…</div></div>
  return <div className="container mx-auto px-4 py-8"><div className="mb-8"><h1 className="text-3xl font-bold text-orange-400 font-mono">ACHIEVEMENTS</h1><p className="mt-1 text-gray-400 font-mono">Earned and locked badge progression from the live catalog</p></div>
    {error?<Card className="border-red-700/40 bg-red-950/20"><CardContent className="p-6 font-mono text-red-200">{error}</CardContent></Card>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{badges.map(badge=>{const earned=owned.has(badge.id),progress=progressFor(badge),rarity=String(badge.rarity||'COMMON').toUpperCase();return <Card key={badge.id} className={`border-orange-900/25 ${earned?'bg-[#12100d]':'bg-black/50 opacity-75'}`}><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="grid size-12 place-items-center rounded-lg border border-orange-900/30 bg-black/30 text-2xl">{badge.icon||<Award className="text-orange-400"/>}</div><div><CardTitle className="text-base text-orange-300">{badge.name}</CardTitle><Badge variant="outline" className={`mt-2 ${rarityClass(rarity)}`}>{rarity.replace(/_/g,' ')}</Badge></div></div>{earned?<Badge className="bg-green-900/30 text-green-300">EARNED</Badge>:<Lock className="text-gray-500"/>}</div></CardHeader><CardContent className="space-y-4"><p className="min-h-10 text-sm text-gray-300">{badge.description||'No description provided.'}</p><div><div className="mb-2 flex justify-between text-xs font-mono text-gray-400"><span>PROGRESS</span><span>{progress}%</span></div><Progress value={progress} className="h-2 bg-gray-800"/></div><dl className="space-y-2 text-xs"><div><dt className="text-gray-500">Requirements</dt><dd className="mt-1 text-gray-300">{requirementFor(badge)}</dd></div><div><dt className="text-gray-500">Date earned</dt><dd className="mt-1 text-gray-300">{earned?'Not recorded for legacy ownership':'Locked'}</dd></div></dl></CardContent></Card>})}</div>}
  </div>
}
