import { useEffect, useState } from "react";
import { Crown, Loader2, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useUser } from "../contexts/UserContext";
import { storeAPI, userAPI } from "../utils/api";

interface StoreProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

type StoreProduct={
  id:string
  product_type:'vip'|'cosmetic'
  name:string
  description:string
  price_points:number|null
  price_eur_cents:number|null
  billing_period:string|null
  vip_only:boolean
  featured:boolean
  metadata?:{benefits?:string[]}
}
type StoreFrame={
  id:string
  name:string
  description:string|null
  style:string|null
  rarity:string
  price_points:number
  vip_only:boolean
  featured:boolean
}
export function Store({ onNavigate, isPremium = false }: StoreProps) {
  const {user,adoptProfile}=useUser()
  const [products,setProducts]=useState<StoreProduct[]>([])
  const [frames,setFrames]=useState<StoreFrame[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [purchasing,setPurchasing]=useState<string|null>(null)
  const [success,setSuccess]=useState('')

  const load=async()=>{
    setLoading(true);setError('')
    try{
      const response:any=await storeAPI.getCatalog()
      setProducts(Array.isArray(response?.products)?response.products:[])
      setFrames(Array.isArray(response?.frames)?response.frames:[])
    }catch(reason:unknown){
      setError(reason instanceof Error?reason.message:'Unable to load the Store catalog.')
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const buyFrame=async(frame:StoreFrame)=>{
    setPurchasing(frame.id);setSuccess('')
    try{
      const response:any=await userAPI.purchaseFrame(frame.id)
      if(!response?.profile)throw new Error('The server did not return the updated profile.')
      adoptProfile(response.profile)
      setSuccess(`${frame.name} was added to your frame collection.`)
      toast.success('Frame purchased',{description:`${frame.name} is now owned.`})
    }catch(reason:unknown){
      const message=reason instanceof Error?reason.message:'Unable to purchase this frame.'
      setError(message)
      toast.error('Purchase failed',{description:message})
    }finally{setPurchasing(null)}
  }

  const vipProducts=products.filter(product=>product.product_type==='vip')
  const ownedFrames=new Set(user?.ownedFrames||[])
  const userPoints=Number(user?.points||0)
  const vipActive=Boolean(isPremium||user?.isPremium)

  return <div className="container mx-auto px-4 py-8">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-mono text-3xl font-bold text-orange-400">EQUIPMENT ARMORY</h1><p className="mt-1 font-mono text-gray-400">VIP access and profile frames</p></div>
      <Card className="border-yellow-900/30 bg-gradient-to-r from-yellow-900/20 to-orange-900/20"><CardContent className="p-4 text-center"><p className="font-mono text-xs text-gray-400">AVAILABLE POINTS</p><p className="font-mono text-3xl font-bold text-yellow-400">{userPoints.toLocaleString()}</p></CardContent></Card>
    </div>

    {error&&<div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200"><span>{error}</span><Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-2 size-4"/>Retry</Button></div>}
    {success&&<div className="mb-5 rounded border border-green-900/40 bg-green-950/20 p-4 text-sm text-green-200">{success}</div>}

    {loading?<div className="grid min-h-[50vh] place-items-center"><div className="flex items-center gap-3 font-mono text-gray-400"><Loader2 className="size-6 animate-spin text-orange-400"/>Loading PostgreSQL catalog...</div></div>
      :<Tabs defaultValue="vip" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 border border-orange-900/20 bg-black/40">
          <TabsTrigger value="vip" className="font-mono data-[state=active]:bg-yellow-900/20 data-[state=active]:text-yellow-400">VIP</TabsTrigger>
          <TabsTrigger value="frames" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">PROFILE FRAMES</TabsTrigger>
        </TabsList>

        <TabsContent value="vip" className="space-y-5">
          <div className={`rounded-lg border p-4 font-mono text-sm ${vipActive?'border-green-800/40 bg-green-950/20 text-green-300':'border-yellow-800/40 bg-yellow-950/20 text-yellow-200'}`}><Crown className="mr-2 inline size-4"/>{vipActive?'VIP access is active on this account.':'VIP unlocks premium tournament access and configured account benefits.'}</div>
          {vipProducts.length?vipProducts.map(product=><Card key={product.id} className="overflow-hidden border-yellow-900/30 bg-gradient-to-br from-yellow-900/25 via-orange-950/20 to-black/40 shadow-lg shadow-yellow-950/20">
            <CardHeader><div className="text-center"><div className="mx-auto mb-3 grid size-16 place-items-center rounded-full border border-yellow-700/30 bg-yellow-950/40"><Crown className="size-9 text-yellow-400"/></div><CardTitle className="font-mono text-2xl text-yellow-400">{product.name}</CardTitle><p className="mx-auto mt-2 max-w-2xl text-gray-300">{product.description}</p>{product.featured&&<Badge className="mt-3 bg-yellow-500 text-black">FEATURED</Badge>}</div></CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="rounded border border-yellow-900/20 bg-black/30 p-5"><h3 className="mb-3 font-mono text-yellow-300">BENEFITS</h3>{product.metadata?.benefits?.length?<ul className="space-y-2 text-sm text-gray-300">{product.metadata.benefits.map(benefit=><li key={benefit} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-400"/><span>{benefit}</span></li>)}</ul>:<p className="text-sm text-gray-500">Benefit details have not been configured for this offer.</p>}</div>
              <div className="flex flex-col justify-center rounded border border-yellow-900/20 bg-black/30 p-5 text-center">
                <p className="font-mono text-4xl font-bold text-yellow-400">{product.price_points==null?'Unavailable':`${product.price_points.toLocaleString()} PTS`}</p>
                {product.billing_period&&<p className="mt-1 text-sm text-gray-500">per {product.billing_period}</p>}
                {vipActive?<Badge className="mx-auto mt-5 bg-green-950 text-green-300">VIP ACTIVE</Badge>:<Button className="mt-5 bg-gradient-to-r from-yellow-400 to-orange-400 text-black" onClick={()=>onNavigate?.('vip-subscription')}>VIEW VIP ACCESS</Button>}
              </div>
            </CardContent>
          </Card>):<EmptyState title="No VIP products available" description="No active VIP offer is currently configured in PostgreSQL."/>}
        </TabsContent>

        <TabsContent value="frames">
          {frames.length?<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{frames.map(frame=>{
            const owned=ownedFrames.has(frame.id)
            const unavailable=frame.vip_only&&!vipActive
            const insufficient=userPoints<Number(frame.price_points)
            return <Card key={frame.id} className="border-orange-900/20 bg-black/40">
              <CardHeader className="text-center"><div className={`mx-auto mb-3 grid size-20 place-items-center rounded-lg bg-black/40 ${frame.style||'border-2 border-orange-900/30'}`}><ShoppingBag className="size-7 text-orange-300"/></div><CardTitle className="text-base text-orange-300">{frame.name}</CardTitle><div className="flex justify-center gap-2"><Badge variant="outline">{frame.rarity}</Badge>{frame.featured&&<Badge className="bg-orange-950 text-orange-300">Featured</Badge>}</div></CardHeader>
              <CardContent><p className="mb-4 min-h-10 text-center text-sm text-gray-400">{frame.description||'Profile frame'}</p>
                <Button className="w-full" disabled={owned||unavailable||insufficient||purchasing===frame.id} onClick={()=>buyFrame(frame)}>
                  {purchasing===frame.id?<><Loader2 className="mr-2 size-4 animate-spin"/>Purchasing...</>:owned?'Owned':unavailable?'VIP required':insufficient?`${frame.price_points.toLocaleString()} PTS`:frame.price_points===0?'Claim':`${frame.price_points.toLocaleString()} PTS`}
                </Button>
              </CardContent>
            </Card>
          })}</div>:<EmptyState title="No frames available" description="There are no active profile frames in PostgreSQL."/>}
        </TabsContent>

      </Tabs>}
  </div>
}

function EmptyState({title,description}:{title:string;description:string}){
  return <Card className="border-dashed border-orange-900/30 bg-black/30"><CardContent className="p-10 text-center"><ShoppingBag className="mx-auto mb-3 size-8 text-gray-600"/><p className="text-gray-300">{title}</p><p className="mt-1 text-sm text-gray-500">{description}</p></CardContent></Card>
}
