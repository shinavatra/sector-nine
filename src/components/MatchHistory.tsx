import { useEffect, useRef, useState } from "react";
import { Award, ChevronDown, ChevronUp, Clock, ExternalLink, Gamepad2, History, List, Loader2, MapPin, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { matchmakingAPI, statsAPI, userAPI } from "../utils/api";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { FramedAvatar } from "./FramedAvatar";
import { useGame } from "../contexts/GameContext";

interface MatchPlayer {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  level: number;
  frame: string | null;
}

interface MatchRow {
  id: string;
  game_id: string;
  match_type: string;
  selected_map: string | null;
  score_p1: number;
  score_p2: number;
  p1_xp_change: number | null;
  p2_xp_change: number | null;
  p1_rating_change: number | null;
  p2_rating_change: number | null;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  mvp_id: string | null;
  player1_username: string;
  player1_display_name: string | null;
  player1_avatar: string | null;
  player1_level: number;
  player1_frame: string | null;
  player2_username: string;
  player2_display_name: string | null;
  player2_avatar: string | null;
  player2_level: number;
  player2_frame: string | null;
  duration_seconds: number | null;
  completed_at: string | null;
}

const signed = (value: number | null, suffix: string) =>
  value === null || value === undefined ? "Not recorded" : `${value > 0 ? "+" : ""}${value} ${suffix}`;

const duration = (seconds: number | null) => {
  if (seconds === null || seconds === undefined) return "Not recorded";
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}m ${safe % 60}s`;
};

export function MatchHistory() {
  const { user } = useUser();
  const { selectedGame } = useGame();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(() => new Set());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [timelineMatch,setTimelineMatch]=useState<MatchRow|null>(null);
  const [timeline,setTimeline]=useState<any[]>([]);
  const [replay,setReplay]=useState<any>(null);
  const [timelineLoading,setTimelineLoading]=useState(false);
  const [timelineError,setTimelineError]=useState("");
  const profileRequest = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    statsAPI.getMatchHistory(selectedGame.id)
      .then(data => {
        if (active) {
          setMatches(Array.isArray(data?.matches) ? data.matches : []);
          setError("");
        }
      })
      .catch(reason => active && setError(reason instanceof Error ? reason.message : "Failed to load match history"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedGame.id]);

  const playerFrom = (match: MatchRow, side: 1 | 2): MatchPlayer => side === 1 ? {
    id: match.player1_id,
    username: match.player1_username,
    displayName: match.player1_display_name,
    avatar: match.player1_avatar,
    level: match.player1_level,
    frame: match.player1_frame,
  } : {
    id: match.player2_id,
    username: match.player2_username,
    displayName: match.player2_display_name,
    avatar: match.player2_avatar,
    level: match.player2_level,
    frame: match.player2_frame,
  };

  const openProfile = async (id: string) => {
    const request = ++profileRequest.current;
    setProfileId(id);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      const data = await userAPI.getPublicProfile(id);
      if (request === profileRequest.current) setProfile(data.profile);
    } catch (reason) {
      if (request === profileRequest.current) setProfileError(reason instanceof Error ? reason.message : "Unable to load profile");
    } finally {
      if (request === profileRequest.current) setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    profileRequest.current += 1;
    setProfileId(null);
    setProfile(null);
    setProfileError("");
    setProfileLoading(false);
  };

  const openTimeline=async(match:MatchRow)=>{setTimelineMatch(match);setTimeline([]);setReplay(null);setTimelineError("");setTimelineLoading(true);try{const data=await matchmakingAPI.getTimeline(match.id);setTimeline(Array.isArray(data?.events)?data.events:[]);setReplay(data?.replay||null)}catch(reason){setTimelineError(reason instanceof Error?reason.message:"Unable to load match timeline")}finally{setTimelineLoading(false)}};

  const Player = ({ player, mvp }: { player: MatchPlayer; mvp: boolean }) => (
    <button type="button" onClick={() => openProfile(player.id)} className="flex min-w-0 items-center gap-2 rounded border border-orange-900/20 bg-black/30 p-2 text-left transition-colors hover:border-orange-700/50">
      <FramedAvatar frameId={player.frame}><Avatar className="size-9 border border-orange-900/30"><AvatarImage src={player.avatar || ""} alt={player.username} /><AvatarFallback className="bg-orange-900/20 text-xs text-orange-300">{player.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar></FramedAvatar>
      <span className="min-w-0"><span className="block truncate text-sm font-mono text-orange-300">{player.displayName || player.username}</span><span className="block text-xs font-mono text-gray-500">LVL {player.level}</span></span>
      {mvp && <Badge className="ml-auto shrink-0 border-yellow-700/40 bg-yellow-900/20 text-yellow-300"><Award className="mr-1 size-3" />MVP</Badge>}
    </button>
  );

  return (
    <>
      <Card className="w-full border-orange-900/20 bg-black/40">
        <CardHeader><CardTitle className="flex items-center gap-2 text-orange-400"><History className="size-5" /><span>MISSION HISTORY</span></CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-orange-400" /><span className="ml-2 font-mono text-gray-400">LOADING MATCH HISTORY...</span></div>
            : error ? <div className="py-10 text-center font-mono text-red-400">{error}</div>
            : matches.length === 0 ? <div className="py-10 text-center"><p className="font-mono text-gray-400">NO MATCH HISTORY AVAILABLE</p><p className="mt-2 text-sm font-mono text-gray-500">Complete matches to see your history</p></div>
            : <div className="space-y-4">{matches.map(match => {
              const isP1 = user?.id === match.player1_id;
              const me = playerFrom(match, isP1 ? 1 : 2);
              const opponent = playerFrom(match, isP1 ? 2 : 1);
              const myScore = isP1 ? match.score_p1 : match.score_p2;
              const opponentScore = isP1 ? match.score_p2 : match.score_p1;
              const xp = isP1 ? match.p1_xp_change : match.p2_xp_change;
              const rating = isP1 ? match.p1_rating_change : match.p2_rating_change;
              const won = match.winner_id === user?.id;
              const expanded = expandedMatches.has(match.id);
              const mvp = match.mvp_id === me.id ? me : match.mvp_id === opponent.id ? opponent : null;
              return <article key={match.id} className="min-w-0 rounded-lg border border-orange-900/20 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-orange-900/20 pb-3">
                  <div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-orange-900/30 bg-orange-900/10 font-mono text-orange-300"><Gamepad2 className="mr-1 size-3" />{(match.game_id||selectedGame.id).toUpperCase()}</Badge><Badge variant="outline" className="border-green-900/30 bg-green-900/10 font-mono text-green-400">{match.match_type}</Badge><strong className={won ? "font-mono text-green-400" : "font-mono text-red-400"}>{won ? "VICTORY" : "DEFEAT"}</strong></div><div className="mt-2 flex flex-wrap gap-4 text-xs font-mono text-gray-400"><span className="flex items-center gap-1"><MapPin className="size-3 text-orange-400" />{match.selected_map || "Map not recorded"}</span><span className="flex items-center gap-1"><Clock className="size-3 text-orange-400" />{duration(match.duration_seconds)}</span><span>{match.completed_at ? new Date(match.completed_at).toLocaleString() : "Date not recorded"}</span></div></div>
                  <div className="text-right"><p className="text-2xl font-mono text-orange-300">{myScore} - {opponentScore}</p><p className="text-xs font-mono text-gray-500">FINAL SCORE</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs text-gray-500"><Award className="mr-1 inline size-3 text-yellow-400" />MVP: {mvp ? mvp.displayName || mvp.username : "Not recorded"}</p>
                  <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" className="border-orange-900/30 font-mono text-xs" onClick={()=>void openTimeline(match)}><List className="mr-1 size-4"/>TIMELINE & REPLAY</Button><Button type="button" size="sm" variant="outline" className="border-orange-900/30 font-mono text-xs" onClick={()=>setExpandedMatches(previous=>{const next=new Set(previous);next.has(match.id)?next.delete(match.id):next.add(match.id);return next})}>{expanded?'HIDE DETAILS':'EXPAND DETAILS'}{expanded?<ChevronUp className="ml-1 size-4"/>:<ChevronDown className="ml-1 size-4"/>}</Button></div>
                </div>
                {expanded&&<>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <section><h4 className="mb-2 flex items-center gap-2 text-xs font-mono text-gray-500"><Users className="size-3" />YOUR TEAM</h4><Player player={me} mvp={match.mvp_id === me.id} /></section>
                  <section><h4 className="mb-2 flex items-center gap-2 text-xs font-mono text-gray-500"><Users className="size-3" />OPPONENTS</h4><Player player={opponent} mvp={match.mvp_id === opponent.id} /></section>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded border border-orange-900/20 bg-black/30 p-3"><p className="text-xs font-mono text-gray-500">XP GAINED</p><p className={`mt-1 flex items-center gap-1 font-mono ${(xp || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(xp || 0) >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{signed(xp, "XP")}</p></div>
                  <div className="rounded border border-orange-900/20 bg-black/30 p-3"><p className="text-xs font-mono text-gray-500">RATING CHANGE</p><p className={`mt-1 flex items-center gap-1 font-mono ${(rating || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(rating || 0) >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{signed(rating, "rating")}</p><p className="mt-1 text-[10px] font-mono text-gray-600">XP-backed rating</p></div>
                </div>
                </>}
              </article>;
            })}</div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(profileId)} onOpenChange={open => !open && closeProfile()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-orange-900/40 bg-[#0b0b0b] text-gray-200">
          <DialogHeader><DialogTitle className="font-mono text-orange-400">PLAYER PROFILE</DialogTitle><DialogDescription>Public competitive profile</DialogDescription></DialogHeader>
          {profileLoading ? <div className="flex justify-center py-12"><Loader2 className="size-7 animate-spin text-orange-400" /></div> : profileError ? <div className="rounded border border-red-900/40 bg-red-950/20 p-4 font-mono text-red-300">{profileError}</div> : profile && <div className="space-y-4"><div className="flex items-center gap-4"><FramedAvatar frameId={profile.equippedFrame}><Avatar className="size-16 border-2 border-orange-900/30"><AvatarImage src={profile.resolvedAvatar || ""} /><AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar></FramedAvatar><div><h3 className="font-mono text-xl text-orange-300">{profile.displayName || profile.username}</h3><p className={profile.isOnline ? "text-green-400" : "text-gray-500"}>{profile.isOnline ? "Online" : "Offline"}</p></div></div>{profile.bio && <p className="rounded border border-orange-900/20 bg-black/30 p-3 text-sm">{profile.bio}</p>}<div className="grid grid-cols-2 gap-3 text-sm">{[["Level",profile.level],["XP",profile.experience],["Wins",profile.wins],["Losses",profile.losses]].map(([label,value])=><div key={String(label)} className="rounded border border-orange-900/20 bg-black/30 p-3"><p className="text-xs font-mono text-gray-500">{label}</p><p className="mt-1 font-mono text-orange-300">{value}</p></div>)}</div></div>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(timelineMatch)} onOpenChange={open=>{if(!open)setTimelineMatch(null)}}><DialogContent className="max-h-[85vh] overflow-y-auto border-orange-900/40 bg-[#0b0b0b] text-gray-200"><DialogHeader><DialogTitle className="font-mono text-orange-400">MATCH TIMELINE</DialogTitle><DialogDescription>{timelineMatch?.selected_map||'Map not recorded'} - {timelineMatch?.completed_at?new Date(timelineMatch.completed_at).toLocaleString():''}</DialogDescription></DialogHeader>{timelineLoading?<div className="flex justify-center py-12"><Loader2 className="size-7 animate-spin text-orange-400"/></div>:timelineError?<div className="rounded border border-red-900/40 bg-red-950/20 p-4 font-mono text-red-300">{timelineError}</div>:<div className="space-y-4">{timeline.length?<ol className="space-y-3">{timeline.map(event=><li key={event.id} className="flex gap-3 border-l-2 border-orange-800/40 pl-4"><span className="font-mono text-xs text-orange-400">#{event.sequence}</span><div><p className="font-mono text-sm text-gray-200">{String(event.event_type).replaceAll('_',' ').toUpperCase()}</p><p className="mt-1 text-xs text-gray-500">{new Date(event.occurred_at).toLocaleString()}</p>{event.actor_name&&<p className="mt-1 text-xs text-gray-400">{event.actor_name}{event.target_name?` -> ${event.target_name}`:''}</p>}<EventDetails details={event.details}/></div></li>)}</ol>:<p className="py-8 text-center font-mono text-xs text-gray-500">NO TIMELINE EVENTS RECORDED</p>}<div className="border-t border-orange-900/20 pt-4">{replay?<Button asChild className="w-full"><a href={replay.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4"/>OPEN MATCH REPLAY</a></Button>:<p className="text-center font-mono text-xs text-gray-500">REPLAY WILL APPEAR AFTER THE GAME SERVER UPLOADS A DEMO</p>}</div></div>}</DialogContent></Dialog>
    </>
  );
}

function EventDetails({details}:{details:any}){if(!details||typeof details!=='object')return null;const values=Object.entries(details).filter(([,value])=>value!==null&&value!=='');return values.length?<p className="mt-2 text-xs text-gray-400">{values.map(([key,value])=>`${key}: ${String(value)}`).join(' - ')}</p>:null}
