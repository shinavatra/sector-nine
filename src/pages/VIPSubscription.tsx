import { useEffect, useState } from "react";
import { ArrowLeft, Check, Coins, Crown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useUser } from "../contexts/UserContext";
import { storeAPI, userAPI } from "../utils/api";

interface VIPSubscriptionProps {
  onNavigate: (page: string) => void;
}

type VipProduct={
  id:string
  name:string
  description:string
  price_points:number|null
  price_eur_cents:number|null
  billing_period:string|null
  metadata?:{benefits?:string[]}
}

export function VIPSubscription({onNavigate}:VIPSubscriptionProps){
  const {user,adoptProfile}=useUser()
  const [plan,setPlan]=useState<VipProduct|null>(null)
  const [loading,setLoading]=useState(true)
  const [processing,setProcessing]=useState(false)
  const [error,setError]=useState('')
  const [completed,setCompleted]=useState(false)

  const load=async()=>{
    setLoading(true);setError('')
    try{
      const response:any=await storeAPI.getCatalog()
      const vip=(Array.isArray(response?.products)?response.products:[]).find((product:any)=>product.product_type==='vip')
      if(!vip)throw new Error('No active VIP product is currently available.')
      setPlan(vip)
    }catch(reason:unknown){setError(reason instanceof Error?reason.message:'Unable to load VIP pricing.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const purchase=async()=>{
    if(!plan||plan.price_points==null)return
    setProcessing(true);setError('')
    try{
      const response:any=await userAPI.upgradeToVIP(plan.id)
      if(!response?.profile)throw new Error('The server did not return the updated profile.')
      adoptProfile(response.profile)
      setCompleted(true)
      toast.success('VIP activated',{description:'Your updated account is available immediately.'})
    }catch(reason:unknown){
      const message=reason instanceof Error?reason.message:'VIP purchase failed.'
      setError(message);toast.error('VIP purchase failed',{description:message})
    }finally{setProcessing(false)}
  }

  const points=Number(user?.points||0)
  if(completed)return <div className="container mx-auto px-4 py-8"><Card className="mx-auto max-w-2xl border-green-900/40 bg-green-950/20"><CardContent className="p-10 text-center"><Crown className="mx-auto size-14 text-yellow-400"/><h1 className="mt-5 font-mono text-3xl text-yellow-300">VIP ACTIVE</h1><p className="mt-2 text-gray-300">Your PostgreSQL profile has been updated.</p><Button className="mt-6" onClick={()=>onNavigate('store')}>Return to Store</Button></CardContent></Card></div>

  return <div className="container mx-auto px-4 py-8">
    <Button variant="ghost" onClick={()=>onNavigate('store')} className="mb-6"><ArrowLeft className="mr-2 size-4"/>Back to Store</Button>
    <div className="mb-8 text-center"><Crown className="mx-auto size-12 text-yellow-400"/><h1 className="mt-3 font-mono text-4xl font-bold text-yellow-400">VIP SUBSCRIPTION</h1><p className="mt-2 text-gray-400">Current availability and pricing load directly from PostgreSQL.</p></div>
    {error&&<div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded border border-red-900/40 bg-red-950/20 p-4 text-red-200"><span>{error}</span><Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-2 size-4"/>Retry</Button></div>}
    {loading?<div className="grid min-h-[45vh] place-items-center"><div className="flex items-center gap-3 text-gray-400"><Loader2 className="size-6 animate-spin text-yellow-400"/>Loading VIP product...</div></div>
      :plan?<Card className="mx-auto max-w-4xl border-yellow-900/30 bg-gradient-to-br from-yellow-950/30 via-black/50 to-orange-950/20">
        <CardHeader className="text-center"><CardTitle className="font-mono text-2xl text-yellow-300">{plan.name}</CardTitle><p className="text-gray-300">{plan.description}</p></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-yellow-900/20 bg-black/30 p-5"><h2 className="mb-4 font-mono text-yellow-300">VIP BENEFITS</h2><ul className="space-y-3">{(plan.metadata?.benefits||[]).map(benefit=><li key={benefit} className="flex gap-3 text-sm text-gray-300"><ShieldCheck className="size-5 shrink-0 text-green-400"/><span>{benefit}</span></li>)}</ul></section>
          <section className="flex flex-col justify-center rounded-lg border border-yellow-900/20 bg-black/30 p-6 text-center">
            <Coins className="mx-auto size-9 text-yellow-400"/>
            <p className="mt-3 font-mono text-4xl font-bold text-yellow-300">{plan.price_points==null?'Unavailable':`${plan.price_points.toLocaleString()} Points`}</p>
            {plan.billing_period&&<p className="mt-1 text-sm text-gray-500">per {plan.billing_period}</p>}
            <div className="mt-5 rounded border border-orange-900/20 bg-black/30 p-3 text-sm"><span className="text-gray-400">Your balance: </span><strong className={points>=(plan.price_points??Infinity)?'text-green-300':'text-red-300'}>{points.toLocaleString()} points</strong></div>
            {user?.isPremium?<Badge className="mx-auto mt-5 bg-green-950 px-4 py-2 text-green-300"><Check className="mr-2 size-4"/>VIP already active</Badge>:<Button className="mt-5 bg-gradient-to-r from-yellow-400 to-orange-400 text-black" disabled={processing||plan.price_points==null||points<plan.price_points} onClick={purchase}>{processing?<><Loader2 className="mr-2 size-4 animate-spin"/>Activating...</>:points<(plan.price_points??Infinity)?'Insufficient points':'Activate VIP'}</Button>}
            <p className="mt-3 text-xs text-gray-500">The final price and eligibility are validated by the server. Online card payments remain unavailable until a verified payment provider callback is configured.</p>
          </section>
        </CardContent>
      </Card>:null}
  </div>
}
