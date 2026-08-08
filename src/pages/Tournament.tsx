import { useEffect, useState } from "react";
import { Calendar, Clock, Loader2, Trophy, Users } from "lucide-react";
import { tournamentAPI } from "../utils/api";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { TournamentCountdown } from "../components/TournamentCountdown";

interface TournamentProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

interface TournamentRow {
  id: string;
  name: string;
  description: string;
  game_id: string;
  game_mode: string;
  status: string;
  current_participants: number;
  max_participants: number;
  start_date: string | null;
  registration_deadline: string | null;
  requires_vip: boolean;
  prize_pool_points?: number;
}

const dedicatedTournamentPages:Record<string,string>={
  'black-mesa-championship':'black-mesa-championship',
  'lambda-instagib':'lambda-instagib-tournament',
  'tactical-ops':'tactical-operations-championship',
  'resonance-cascade':'resonance-cascade-royale',
};

const tournamentPage=(id:string)=>dedicatedTournamentPages[id]||`tournaments/${encodeURIComponent(id)}`;

export function Tournament({ onNavigate }: TournamentProps) {
  const [tournaments,setTournaments]=useState<TournamentRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError("");
    tournamentAPI.getAll("hl1")
      .then(data=>active&&setTournaments(Array.isArray(data?.tournaments)?data.tournaments:[]))
      .catch(reason=>active&&setError(reason instanceof Error?reason.message:"Unable to load tournaments"))
      .finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 font-mono">TOURNAMENT CENTER</h1>
        <p className="mt-1 text-gray-400 font-mono">Half-Life 1 competitive events</p>
      </div>

      <Card className="mb-8 border-orange-900/30 bg-gradient-to-r from-orange-900/20 to-green-900/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-orange-900/20 p-3"><Trophy className="size-8 text-orange-400" /></div>
            <div><h2 className="font-mono text-lg text-orange-400">HALF-LIFE 1 TOURNAMENTS</h2><p className="text-sm font-mono text-gray-300">Sector Nine competitive events.</p></div>
          </div>
          <div className="text-right"><div className="text-2xl font-bold text-green-400 font-mono">{tournaments.length}</div><div className="text-sm text-gray-400 font-mono">Events</div></div>
        </CardContent>
      </Card>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin text-orange-400" /></div>
      : error ? <Card className="border-red-900/40 bg-red-950/30"><CardContent className="p-8 text-center font-mono text-red-300">{error}</CardContent></Card>
      : tournaments.length===0 ? <Card className="border-orange-900/20 bg-black/40"><CardContent className="p-12 text-center font-mono text-gray-400">NO HALF-LIFE 1 TOURNAMENTS ARE CURRENTLY SCHEDULED</CardContent></Card>
      : <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {tournaments.map(tournament=>(
            <Card key={tournament.id} role="button" tabIndex={0} onClick={()=>onNavigate?.(tournamentPage(tournament.id))} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onNavigate?.(tournamentPage(tournament.id))}}} className="cursor-pointer border-orange-900/20 bg-black/40 transition-colors hover:border-orange-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60">
              <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-mono text-orange-400">{tournament.name}</CardTitle><p className="mt-2 text-sm text-gray-500">{tournament.description}</p></div><Badge className="border-green-900/30 bg-green-900/20 text-green-400">{tournament.status}</Badge></div></CardHeader>
              <CardContent className="space-y-3 text-sm font-mono text-gray-300">
                <div className="flex items-center gap-2"><Users className="size-4 text-gray-500" />{Number(tournament.current_participants)||0}/{Number(tournament.max_participants)||0} participants</div>
                <div className="flex items-center gap-2"><Calendar className="size-4 text-gray-500" />{tournament.start_date?new Date(tournament.start_date).toLocaleDateString():"Date pending"}</div>
                <div className="flex items-center gap-2"><Clock className="size-4 text-gray-500" />{tournament.registration_deadline?`Register by ${new Date(tournament.registration_deadline).toLocaleString()}`:"Registration deadline pending"}</div>
                <TournamentCountdown tournament={tournament}/>
                <div className="grid grid-cols-2 gap-2 border-t border-orange-900/20 pt-3 text-xs"><div><p className="text-gray-500">FORMAT</p><p className="mt-1 text-orange-300">{tournament.game_mode}</p></div><div><p className="text-gray-500">PRIZE POOL</p><p className="mt-1 text-green-300">{(Number(tournament.prize_pool_points)||0).toLocaleString()} points</p></div></div>
                <p className="text-xs text-gray-500">{tournament.requires_vip?"VIP required":"Open eligibility"}</p>
              </CardContent>
            </Card>
          ))}
        </div>}
    </div>
  );
}
