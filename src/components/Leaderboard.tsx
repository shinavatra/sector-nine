import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Award, ChevronLeft, ChevronRight, Gamepad2, Loader2, Medal, Minus, Search, Trophy } from "lucide-react";
import { statsAPI, userAPI } from "../utils/api";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { FramedAvatar } from "./FramedAvatar";
import { ProfileComments } from "./ProfileComments";
import { useGame } from "../contexts/GameContext";
import { useUser } from "../contexts/UserContext";
import { displayPlayerName, playerInitials } from "../utils/displayName";

interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
  steam_avatar: string | null;
  resolvedAvatar: string | null;
  equippedFrame: string | null;
  is_premium: boolean;
  is_online: boolean;
  country_code: string | null;
  level: number;
  experience: number;
  wins: number;
  losses: number;
  win_rate: number;
  score: number;
  rank: number;
  rank_movement: number | null;
}

interface Season {
  id: string;
  name: string;
  game_id: string;
  status: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: { games: string[]; countries: string[]; seasons: Season[] };
  season: Season | null;
  rankingMetric: "experience" | "wins" | "points";
}

const selectClass = "border-orange-900/30 bg-black/80 text-gray-200 font-mono";

export function Leaderboard() {
  const { selectedGame } = useGame();
  const { user } = useUser();
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"global" | "seasonal">("global");
  const [game, setGame] = useState(selectedGame.id);
  const [country, setCountry] = useState("all");
  const [season, setSeason] = useState("current");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<LeaderboardResponse["filters"]>({ games: ["all"], countries: [], seasons: [] });
  const [metric, setMetric] = useState<LeaderboardResponse["rankingMetric"]>("experience");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const requestId = useRef(0);
  const profileRequestId = useRef(0);

  useEffect(() => setGame(selectedGame.id), [selectedGame.id]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError("");
      try {
        const data = await statsAPI.getLeaderboard({
          scope,
          game,
          country: country === "all" ? "" : country,
          season: season === "current" ? "" : season,
          search,
          page,
          pageSize: 20,
        }) as LeaderboardResponse;
        if (currentRequest !== requestId.current) return;
        setPlayers(data.leaderboard || []);
        setPagination(data.pagination || { page, pageSize: 20, total: 0, totalPages: 0 });
        setFilters(data.filters || { games: ["all"], countries: [], seasons: [] });
        setMetric(data.rankingMetric || "experience");
      } catch (reason) {
        if (currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : "Failed to load leaderboard");
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, search ? 300 : 0);
    return () => window.clearTimeout(timeout);
  }, [scope, game, country, season, search, page]);

  useEffect(() => setPage(1), [scope, game, country, season, search]);

  const availableSeasons = useMemo(
    () => filters.seasons.filter(item => item.game_id === game),
    [filters.seasons, game],
  );

  const openProfile = async (id: string) => {
    const currentRequest = ++profileRequestId.current;
    setProfileId(id);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      const data = await userAPI.getPublicProfile(id);
      if (currentRequest === profileRequestId.current) setProfile(data.profile);
    } catch (reason) {
      if (currentRequest === profileRequestId.current) setProfileError(reason instanceof Error ? reason.message : "Unable to load profile");
    } finally {
      if (currentRequest === profileRequestId.current) setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    profileRequestId.current += 1;
    setProfileId(null);
    setProfile(null);
    setProfileError("");
    setProfileLoading(false);
  };

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="size-5 text-orange-400" />;
    if (rank === 2) return <Medal className="size-5 text-green-400" />;
    if (rank === 3) return <Award className="size-5 text-orange-300" />;
    return <span className="flex size-5 items-center justify-center text-sm font-medium text-orange-400">{rank}</span>;
  };

  const rankColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-orange-900/30 to-orange-900/10 border-orange-900/40";
    if (rank === 2) return "bg-gradient-to-r from-green-900/30 to-green-900/10 border-green-900/40";
    if (rank === 3) return "bg-gradient-to-r from-orange-900/20 to-orange-900/5 border-orange-900/30";
    return "bg-black/20 border-orange-900/20";
  };

  const movement=(value:number|null)=>value===null
    ? <span className="font-mono text-[10px] text-gray-500">NEW</span>
    : value>0
      ? <span className="flex items-center gap-0.5 font-mono text-[10px] text-green-400"><ArrowUp className="size-3"/>{value}</span>
      : value<0
        ? <span className="flex items-center gap-0.5 font-mono text-[10px] text-red-400"><ArrowDown className="size-3"/>{Math.abs(value)}</span>
        : <span className="flex items-center gap-0.5 font-mono text-[10px] text-gray-500"><Minus className="size-3"/>0</span>;

  return (
    <>
      <Card className="w-full border-orange-900/20 bg-black/40">
        <CardHeader className="space-y-4">
          <CardTitle className="flex items-center space-x-2 text-orange-400">
            <Trophy className="size-5" />
            <span>RESEARCH RANKINGS</span>
          </CardTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-2.5 size-4 text-gray-500" />
              <Input aria-label="Search leaderboard players" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search player" className="border-orange-900/30 bg-black/50 pl-9 font-mono" />
            </div>
            <Select value={scope} onValueChange={value => setScope(value as "global" | "seasonal")}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="global">Global ranking</SelectItem><SelectItem value="seasonal">Seasonal ranking</SelectItem></SelectContent>
            </Select>
            <Select value={game} onValueChange={value => { setGame(value); setSeason("current"); }}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{filters.games.map(value => <SelectItem key={value} value={value}>{value.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All countries</SelectItem>{filters.countries.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={season} onValueChange={setSeason} disabled={scope !== "seasonal"}>
              <SelectTrigger aria-label="Season" className={selectClass}><SelectValue placeholder="Current season" /></SelectTrigger>
              <SelectContent><SelectItem value="current">Current season</SelectItem>{availableSeasons.map(value => <SelectItem key={value.id} value={value.id}>{value.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="size-6 animate-spin text-orange-400" /><span className="ml-2 font-mono text-gray-400">LOADING RANKINGS...</span></div>
          ) : error ? (
            <div className="py-10 text-center"><p className="font-mono text-red-400">{error}</p></div>
          ) : players.length === 0 ? (
            <div className="py-10 text-center"><p className="font-mono text-gray-400">NO RANKING DATA AVAILABLE</p><p className="mt-2 text-sm font-mono text-gray-500">Try another filter or play a ranked match</p></div>
          ) : (
            <div className="space-y-4">
              {players.map(player => {
                const isCurrentUser=player.id===user?.id;
                return (
                <button key={player.id} type="button" onClick={() => openProfile(player.id)} className={`flex w-full min-w-0 items-center gap-4 rounded-lg border p-4 text-left transition-colors ${rankColor(player.rank)} ${isCurrentUser?'ring-2 ring-green-500/60 bg-green-950/20':''}`}>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      {rankIcon(player.rank)}
                      <span title="Movement since the player's latest recorded match">{movement(player.rank_movement)}</span>
                    </div>
                    <div className="relative">
                      <FramedAvatar frameId={player.equippedFrame}><Avatar className="size-10 border-2 border-orange-900/30"><AvatarImage src={player.resolvedAvatar || player.steam_avatar || ""} alt={displayPlayerName({ display_name: player.display_name, username: player.username })} /><AvatarFallback className="bg-orange-900/20 text-orange-400">{playerInitials({ display_name: player.display_name, username: player.username })}</AvatarFallback></Avatar></FramedAvatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-black ${player.is_online ? "bg-green-400" : "bg-gray-600"}`} aria-label={player.is_online ? "Online" : "Offline"} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono font-medium text-orange-400">{displayPlayerName({ display_name: player.display_name, username: player.username })}{isCurrentUser&&<span className="ml-2 text-xs text-green-400">[YOU]</span>}{player.is_premium && <span className="ml-2 text-xs text-yellow-400">[VIP]</span>}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded border border-orange-900/30 bg-orange-950/20 px-1.5 py-0.5 font-mono text-[10px] text-orange-300"><Gamepad2 className="size-3" />{game.toUpperCase()}</span>
                      <Badge variant="outline" className="border-green-900/30 bg-green-900/10 text-xs text-green-400">LVL {player.level}</Badge>
                      {player.country_code && <span className="text-xs font-mono text-gray-500">{player.country_code}</span>}
                      <span className="text-sm font-mono text-gray-400">{player.wins}W / {player.losses}L <span className="text-green-400">({player.win_rate || 0}%)</span></span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-lg font-semibold font-mono text-orange-400">{player.score}</p><p className="text-xs font-mono text-green-400">{metric === "experience" ? "XP" : metric.toUpperCase()}</p></div>
                </button>
              )})}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-900/20 pt-4">
                <span className="text-xs font-mono text-gray-500">{pagination.total} ranked players - Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="border-orange-900/30"><ChevronLeft /> Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)} className="border-orange-900/30">Next <ChevronRight /></Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(profileId)} onOpenChange={open => !open && closeProfile()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-orange-900/40 bg-[#0b0b0b] text-gray-200">
          <DialogHeader><DialogTitle className="font-mono text-orange-400">PLAYER PROFILE</DialogTitle><DialogDescription>Public competitive profile</DialogDescription></DialogHeader>
          {profileLoading ? <div className="flex justify-center py-12"><Loader2 className="size-7 animate-spin text-orange-400" /></div> : profileError ? <div className="rounded border border-red-900/40 bg-red-950/20 p-4 font-mono text-red-300">{profileError}</div> : profile && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <FramedAvatar frameId={profile.equippedFrame}><Avatar className="size-16 border-2 border-orange-900/30"><AvatarImage src={profile.resolvedAvatar || ""} /><AvatarFallback>{playerInitials(profile)}</AvatarFallback></Avatar></FramedAvatar>
                <div><h3 className="font-mono text-xl text-orange-300">{displayPlayerName(profile)}</h3><p className={profile.isOnline ? "text-green-400" : "text-gray-500"}>{profile.isOnline ? "Online" : "Offline"} - {profile.countryCode || "Country not set"}</p></div>
              </div>
              {profile.bio && <p className="rounded border border-orange-900/20 bg-black/30 p-3 text-sm text-gray-300">{profile.bio}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[["Level", profile.level], ["XP", profile.experience], ["Wins", profile.wins], ["Losses", profile.losses], ["Steam", profile.steamVerified ? "Verified" : "Unverified"], ["Account", profile.isPremium ? "VIP" : "Standard"]].map(([label, value]) => <div key={String(label)} className="rounded border border-orange-900/20 bg-black/30 p-3"><p className="text-xs font-mono text-gray-500">{label}</p><p className="mt-1 font-mono text-orange-300">{value}</p></div>)}
              </div>
              {profileId&&user?.id&&<ProfileComments profileUserId={profileId} currentUserId={user.id}/>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
