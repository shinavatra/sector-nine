import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Coins, Crown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useUser } from "../contexts/UserContext";
import { storeAPI, userAPI } from "../utils/api";

interface VIPSubscriptionProps { onNavigate: (page: string) => void }
type VipProduct={id:string;name:string;description:string;price_points:number|null;price_eur_cents:number|null;billing_period:string|null;metadata?:{benefits?:string[]}}
type VipHistory={id:string;source:string;starts_at:string;expires_at:string;created_at:string}

export function VIPSubscription({onNavigate}:VIPSubscriptionProps){
  const {user,adoptProfile}=useUser()
  const [plan,setPlan]=useState<VipProduct|null>(null)
  const [history,setHistory]=useState<VipHistory[]>([])
  const [loading,setLoading]=useState(true)
  const [processing,setProcessing]=useState(false)
  const [confirming,setConfirming]=useState(false)
  const [error,setError]=useState('')
  const [completed,setCompleted]=useState(false)
  const requestKey=useRef<string|null>(null)

  const load=async()=>{
    setLoading(true);setError('')
    try{
      const [catalog,purchases]:any[]=await Promise.all([storeAPI.getCatalog(),storeAPI.getPurchaseHistory()])
      const vip=(Array.isArray(catalog?.products)?catalog.products:[]).find((product:any)=>product.product_type==='vip')
      if(!vip)throw new Error('No active VIP product is currently available.')
      setPlan(vip);setHistory(Array.isArray(purchases?.vipHistory)?purchases.vipHistory:[])
    }catch(reason:unknown){setError(reason instanceof Error?reason.message:'Unable to load VIP information.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const purchase=async()=>{
    if(!plan||plan.price_points==null)return
    setProcessing(true);setError('')
    try{
      const key=requestKey.current||crypto.randomUUID();requestKey.current=key
      const response:any=await userAPI.upgradeToVIP(plan.id,key)
      if(!response?.profile)throw new Error('The server did not return the updated profile.')
      adoptProfile(response.profile);requestKey.current=null;setConfirming(false);setCompleted(true)
      toast.success(user?.isPremium?'VIP extended':'VIP activated',{description:`Valid until ${formatDate(response.vipExpiresAt||response.profile.vipExpiresAt)}.`})
      void load()
    }catch(reason:unknown){const message=reason instanceof Error?reason.message:'VIP redemption failed.';setError(message);toast.error('VIP redemption failed',{description:message})}
    finally{setProcessing(false)}
  }

  const points=Number(user?.points||0)
  const active=Boolean(user?.isPremium)
  const price=plan?.price_points??null
  return <div className="page-container container mx-auto px-4 py-8">
    <Button variant="ghost" onClick={()=>onNavigate('store')} className="mb-6"><ArrowLeft className="mr-2 size-4"/>Back to Store</Button>
    <div className="mb-8 text-center"><Crown className="mx-auto size-12 text-yellow-400"/><h1 className="mt-3 font-mono text-4xl font-bold text-yellow-400">VIP MEMBERSHIP</h1><p className="mt-2 text-gray-400">One month costs 5 EUR or 5,000 FL Points. Online payments are not active yet.</p></div>
    {completed&&<div className="mx-auto mb-5 max-w-4xl rounded border border-green-900/40 bg-green-950/20 p-4 text-green-200">VIP is active until <strong>{formatDate(user?.vipExpiresAt)}</strong>. New FL balance: <strong>{Number(user?.points||0).toLocaleString()}</strong>.</div>}
    {error&&<div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded border border-red-900/40 bg-red-950/20 p-4 text-red-200"><span>{error}</span><Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-2 size-4"/>Retry</Button></div>}
    {loading?<div className="grid min-h-[45vh] place-items-center"><div className="flex items-center gap-3 text-gray-400"><Loader2 className="size-6 animate-spin text-yellow-400"/>Loading VIP account...</div></div>:plan?<div className="mx-auto grid max-w-4xl gap-6">
      <Card className="border-yellow-900/30 bg-gradient-to-br from-yellow-950/30 via-black/50 to-orange-950/20">
        <CardHeader className="text-center"><Badge className={`mx-auto mb-3 ${active?'bg-green-950 text-green-300':'bg-gray-900 text-gray-300'}`}>{active?'ACTIVE':'INACTIVE / EXPIRED'}</Badge><CardTitle className="font-mono text-2xl text-yellow-300">{plan.name}</CardTitle><p className="text-gray-300">{active?`Current period ends ${formatDate(user?.vipExpiresAt)}.`:plan.description}</p></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-yellow-900/20 bg-black/30 p-5"><h2 className="mb-4 font-mono text-yellow-300">CONFIGURED BENEFITS</h2>{plan.metadata?.benefits?.length?<ul className="space-y-3">{plan.metadata.benefits.map(benefit=><li key={benefit} className="flex gap-3 text-sm text-gray-300"><ShieldCheck className="size-5 shrink-0 text-green-400"/><span>{benefit}</span></li>)}</ul>:<p className="text-sm text-gray-500">No benefits are configured for this offer.</p>}</section>
          <section className="flex flex-col justify-center rounded-lg border border-yellow-900/20 bg-black/30 p-6 text-center"><Coins className="mx-auto size-9 text-yellow-400"/><p className="mt-3 font-mono text-4xl font-bold text-yellow-300">{price==null?'Unavailable':`${price.toLocaleString()} FL`}</p><p className="mt-1 text-sm text-gray-500">{plan.price_eur_cents==null?'Card price unavailable':`${(plan.price_eur_cents/100).toFixed(2)} EUR`} per {plan.billing_period||'period'}</p><div className="mt-5 rounded border border-orange-900/20 bg-black/30 p-3 text-sm"><span className="text-gray-400">Your balance: </span><strong className={points>=(price??Infinity)?'text-green-300':'text-red-300'}>{points.toLocaleString()} FL</strong></div><Button className="mt-5 bg-gradient-to-r from-yellow-400 to-orange-400 text-black" disabled={processing||price==null||points<price} onClick={()=>setConfirming(true)}>{points<(price??Infinity)?'Insufficient FL Points':active?'Extend VIP by one month':'Activate VIP for one month'}</Button><p className="mt-3 text-xs text-gray-500">Price, balance, expiry and replay protection are validated by the server.</p></section>
        </CardContent>
      </Card>
      <Card className="border-yellow-900/20 bg-black/40"><CardHeader><CardTitle className="font-mono text-yellow-300">VIP HISTORY</CardTitle></CardHeader><CardContent>{history.length?<div className="space-y-2">{history.map(entry=><div key={entry.id} className="rounded border border-yellow-900/20 bg-black/30 p-3 text-sm"><p className="font-mono text-gray-200">{entry.source==='points'?'FL Points redemption':entry.source}</p><p className="text-gray-500">{formatDate(entry.starts_at)} — {formatDate(entry.expires_at)}</p></div>)}</div>:<p className="text-sm text-gray-500">No VIP membership history.</p>}</CardContent></Card>
    </div>:null}
    <AlertDialog open={confirming} onOpenChange={open=>{if(!processing)setConfirming(open)}}><AlertDialogContent className="border-yellow-900/40 bg-[#0b0b0b]"><AlertDialogHeader><AlertDialogTitle className="font-mono text-yellow-300">CONFIRM VIP REDEMPTION</AlertDialogTitle><AlertDialogDescription>Spend {Number(price||0).toLocaleString()} FL Points to {active?'extend':'activate'} VIP for one month? Your balance will be updated atomically.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={processing}>CANCEL</AlertDialogCancel><AlertDialogAction disabled={processing||price==null} onClick={event=>{event.preventDefault();void purchase()}}>{processing?<><Loader2 className="mr-2 size-4 animate-spin"/>PROCESSING...</>:'CONFIRM REDEMPTION'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function formatDate(value?:string|null){if(!value)return 'not available';const date=new Date(value);return Number.isNaN(date.getTime())?'not available':date.toLocaleString()}
