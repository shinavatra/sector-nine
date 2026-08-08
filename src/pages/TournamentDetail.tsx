import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Loader2, ShieldCheck, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { TournamentCountdown } from "../components/TournamentCountdown";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useUser } from "../contexts/UserContext";
import { tournamentAPI } from "../utils/api";

interface Props { tournamentId:string; onNavigate:(page:string)=>void; isPremium:boolean }

export function TournamentDetail({tournamentId,onNavigate,isPremium}:Props){
  const {user}=useUser();
  const [tournament,setTournament]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const load=async()=>{const data=await tournamentAPI.getById(tournamentId);setTournament(data.tournament)};

  useEffect(()=>{let active=true;setLoading(true);setError("");tournamentAPI.getById(tournamentId).then(data=>active&&setTournament(data.tournament)).catch(reason=>active&&setError(reason instanceof Error?reason.message:"Unable to load tournament")).finally(()=>active&&setLoading(false));return()=>{active=false}},[tournamentId]);

  const participants=Array.isArray(tournament?.participants)?tournament.participants:[];
  const registered=useMemo(()=>participants.some((participant:any)=>String(participant.user_id)===String(user?.id)),[participants,user?.id]);
  const deadlineOpen=!tournament?.registration_deadline||new Date(tournament.registration_deadline).getTime()>Date.now();
  const registrationOpen=tournament?.status==='registration'&&deadlineOpen;

  const changeRegistration=async()=>{setBusy(true);try{if(registered){await tournamentAPI.unregister(tournamentId);toast.success("Tournament registration cancelled")}else{await tournamentAPI.register(tournamentId);toast.success("Tournament registration confirmed")}await load()}catch(reason){toast.error("Registration could not be updated",{description:reason instanceof Error?reason.message:undefined})}finally{setBusy(false)}};

  if(loading)return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-8 animate-spin text-orange-400"/></div>;
  if(error||!tournament)return <div className="container mx-auto px-4 py-8"><Button variant="ghost" onClick={()=>onNavigate('tournament')}><ArrowLeft className="mr-2 size-4"/>TOURNAMENTS</Button><Card className="mt-6 border-red-900/40 bg-red-950/30"><CardContent className="p-10 text-center font-mono text-red-300">{error||'Tournament not found'}</CardContent></Card></div>;

  return <div className="container mx-auto max-w-6xl px-4 py-8">
    <Button variant="ghost" onClick={()=>onNavigate('tournament')}><ArrowLeft className="mr-2 size-4"/>TOURNAMENTS</Button>
    <header className="mt-5 border-b border-orange-900/25 pb-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 flex flex-wrap gap-2"><Badge>{String(tournament.game_id).toUpperCase()}</Badge><Badge variant="outline">{tournament.status}</Badge>{tournament.requires_vip&&<Badge className="bg-yellow-900/30 text-yellow-300">VIP</Badge>}</div><h1 className="font-mono text-3xl font-bold text-orange-400">{tournament.name}</h1><p className="mt-3 max-w-3xl text-gray-400">{tournament.description||'Competitive Sector Nine tournament.'}</p></div><TournamentCountdown tournament={tournament}/></div></header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card className="border-orange-900/25 bg-black/40"><CardHeader><CardTitle className="font-mono text-orange-300">FORMAT & RULES</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info icon={Trophy} label="FORMAT" value={tournament.game_mode||'To be announced'}/><Info icon={Calendar} label="START" value={tournament.start_date?new Date(tournament.start_date).toLocaleString():'To be announced'}/><Info icon={ShieldCheck} label="ELIGIBILITY" value={tournament.requires_vip?'Verified game ownership and VIP':'Verified game ownership'}/><Info icon={Trophy} label="PRIZE" value={`${Number(tournament.prize_pool_points||0).toLocaleString()} Research Points`}/>{tournament.rules&&<p className="sm:col-span-2 whitespace-pre-line border-t border-orange-900/20 pt-4 text-sm leading-6 text-gray-300">{tournament.rules}</p>}</CardContent></Card>
        <Card className="border-orange-900/25 bg-black/40"><CardHeader><CardTitle className="font-mono text-orange-300">PARTICIPANTS</CardTitle></CardHeader><CardContent>{participants.length===0?<p className="py-8 text-center font-mono text-gray-500">NO REGISTERED PLAYERS</p>:<div className="grid gap-2 sm:grid-cols-2">{participants.map((participant:any,index:number)=><div key={participant.id} className="flex items-center gap-3 border border-orange-900/15 bg-black/25 p-3"><span className="w-6 text-center font-mono text-xs text-gray-600">{index+1}</span>{participant.steam_avatar?<img src={participant.steam_avatar} alt="" className="size-9 rounded object-cover"/>:<div className="size-9 rounded bg-orange-950/40"/>}<span className="min-w-0 truncate font-mono text-sm text-gray-200">{participant.username}</span></div>)}</div>}</CardContent></Card>
      </div>
      <Card className="h-fit border-orange-900/30 bg-black/50"><CardHeader><CardTitle className="font-mono text-orange-300">REGISTRATION</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between font-mono text-sm"><span className="flex items-center gap-2 text-gray-400"><Users className="size-4"/>PLAYERS</span><span>{participants.length}/{Number(tournament.max_participants)||0}</span></div><p className="text-xs leading-5 text-gray-500">{tournament.registration_deadline?`Changes close ${new Date(tournament.registration_deadline).toLocaleString()}.`:'Deadline pending.'}</p><Button className="w-full" variant={registered?'destructive':'default'} disabled={busy||(!registered&&(!registrationOpen||(tournament.requires_vip&&!isPremium)))} onClick={changeRegistration}>{busy?<Loader2 className="size-4 animate-spin"/>:registered?'CANCEL REGISTRATION':registrationOpen?'REGISTER':'REGISTRATION CLOSED'}</Button>{!registered&&tournament.requires_vip&&!isPremium&&<p className="text-center text-xs text-yellow-400">VIP status is required.</p>}</CardContent></Card>
    </div>
  </div>;
}

function Info({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="border border-orange-900/15 bg-black/25 p-4"><p className="flex items-center gap-2 font-mono text-xs text-gray-500"><Icon className="size-4"/>{label}</p><p className="mt-2 font-mono text-sm text-gray-200">{value}</p></div>}
