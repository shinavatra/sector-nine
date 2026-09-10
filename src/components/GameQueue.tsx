import { CheckCircle2, Clock3, Gamepad2, Loader2, Map, MapPin, Server, UserCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { displayPlayerName } from "../utils/displayName";

export type MatchmakingState = "idle" | "searching" | "found" | "accepting" | "map_selecting" | "map_banning" | "accepted" | "server_assigned";

export interface MatchmakingSnapshot {
  state: MatchmakingState;
  queue?: { game_id: string; game_mode: string; selected_maps: string[]; preferred_region: string | null; joined_at: string };
  viewerAccepted?: boolean;
  acceptedCount?: number;
  totalPlayers?: number;
  match?: { id: string; game_id?: string; game_mode: string; selected_map: string; maps?: string[]; opponent_username?: string; opponent_display_name?: string | null };
  mapSelection?: { requiredCount: number; availableMaps: string[]; viewerMaps: string[]; viewerConfirmed: boolean; opponentConfirmed: boolean; opponentSelectedCount: number; unavailableMaps: string[] } | null;
  mapBan?: { pool: string[]; remainingMaps: string[]; bans: Array<{ sequence: number; user_id: string; map_id: string; created_at: string }>; currentTurnUserId: string | null; isViewerTurn: boolean } | null;
  server?: { id: string; name: string; region: string; host: string; port: number } | null;
}

interface GameQueueProps {
  snapshot: MatchmakingSnapshot;
  busy?: boolean;
  disabled?: boolean;
  onStart: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onSubmitMaps: () => void;
  onBanMap: (mapId: string) => void;
  onLaunch: () => void;
  selectedGame: string;
  connectedRegion: string;
  selectedMaps: string[];
}

const labels: Record<MatchmakingState, string> = {
  idle: "READY", searching: "SEARCHING", found: "MATCH FOUND", accepting: "ACCEPTING",
  map_selecting: "MAP SELECTION", map_banning: "MAP VETO", accepted: "MAP SELECTED", server_assigned: "SERVER ASSIGNED",
};

export function GameQueue({ snapshot, busy = false, disabled = false, onStart, onCancel, onAccept, onDecline, onSubmitMaps, onBanMap, onLaunch, selectedGame, connectedRegion, selectedMaps }: GameQueueProps) {
  const state = snapshot.state || "idle";
  const active = state !== "idle";
  const game = snapshot.queue?.game_id || snapshot.match?.game_id || selectedGame;
  const region = snapshot.server?.region || snapshot.queue?.preferred_region || connectedRegion || "Any available region";
  const maps = snapshot.match?.selected_map ? [snapshot.match.selected_map] : snapshot.match?.maps?.length ? snapshot.match.maps : snapshot.queue?.selected_maps?.length ? snapshot.queue.selected_maps : selectedMaps;
  const selection = snapshot.mapSelection;
  const veto = snapshot.mapBan;

  return (
    <Card className="w-full border-orange-900/20 bg-black/40">
      <CardHeader><CardTitle className="flex flex-wrap items-center justify-center gap-2 text-orange-400"><Gamepad2 className="size-5"/><span>MATCHMAKING STATE</span><Badge variant="outline" className="border-orange-700/40 text-orange-300">{labels[state]}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {state === "searching" && <State icon={<Loader2 className="size-7 animate-spin"/>} title="SEARCHING FOR A COMPATIBLE PLAYER" detail="Your PostgreSQL queue entry is active and synchronized."/>}
        {state === "found" && <State icon={<Users className="size-7"/>} title="MATCH FOUND" detail={`${displayPlayerName({ displayName: snapshot.match?.opponent_display_name, username: snapshot.match?.opponent_username }, "Opponent")} is ready. Confirm your participation.`}/>}
        {state === "accepting" && <State icon={<UserCheck className="size-7"/>} title="ACCEPTING" detail={`${snapshot.acceptedCount || 0}/${snapshot.totalPlayers || 2} players have accepted.`}/>}
        {state === "map_selecting" && <State icon={<Map className="size-7"/>} title="SELECT 5 MAPS" detail={selection?.viewerConfirmed ? "Your five maps are locked. Waiting for your opponent." : `Choose five maps not already claimed by your opponent (${selection?.opponentSelectedCount || 0}/5).`}/>}
        {state === "map_banning" && <State icon={<Map className="size-7"/>} title="MAP VETO" detail={veto?.isViewerTurn ? "Your turn. Ban one map from the remaining pool." : "Opponent's turn. Waiting for their ban."}/>}
        {state === "accepted" && <State icon={<CheckCircle2 className="size-7"/>} title="FINAL MAP SELECTED" detail={`${snapshot.match?.selected_map?.toUpperCase() || "The final map"} remains. Waiting for an available server.`}/>}
        {state === "server_assigned" && <State icon={<Server className="size-7"/>} title="SERVER ASSIGNED" detail={snapshot.server ? `${snapshot.server.name} - ${snapshot.server.region} - ${snapshot.server.host}:${snapshot.server.port}` : "The backend assigned the match server."}/>}

        {state === "map_banning" && veto && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">{veto.remainingMaps.map(map => <Button key={map} type="button" variant="outline" disabled={busy || !veto.isViewerTurn} onClick={() => onBanMap(map)} className="h-auto min-h-10 whitespace-normal border-orange-800/50 px-2 py-2 font-mono text-xs text-orange-200 hover:bg-red-950 hover:text-red-200">{map.toUpperCase()}</Button>)}</div>}

        {active && <div className="grid gap-3 rounded border border-orange-900/20 bg-black/30 p-3 text-xs font-mono sm:grid-cols-2">
          <div><span className="flex items-center gap-1 text-gray-500"><Gamepad2 className="size-3"/>SELECTED GAME</span><p className="mt-1 text-orange-300">{game.toUpperCase()}</p></div>
          <div><span className="flex items-center gap-1 text-gray-500"><MapPin className="size-3"/>CONNECTED REGION</span><p className="mt-1 text-green-300">{region}</p></div>
          <div><span className="flex items-center gap-1 text-gray-500"><Clock3 className="size-3"/>STATUS</span><p className="mt-1 text-orange-300">{state === "searching" ? "Searching" : "Match located"}</p></div>
          <div><span className="flex items-center gap-1 text-gray-500"><Map className="size-3"/>MAP POOL</span><p className="mt-1 break-words text-green-300">{maps.length ? maps.join(", ") : "Waiting for selections"}</p></div>
        </div>}

        {state === "searching" && <div aria-label="Queue search activity" className="flex items-end justify-center gap-2 py-2"><span className="h-3 w-2 animate-pulse rounded-sm bg-orange-700"/><span className="h-6 w-2 animate-pulse rounded-sm bg-orange-500 [animation-delay:150ms]"/><span className="h-9 w-2 animate-pulse rounded-sm bg-green-500 [animation-delay:300ms]"/><span className="h-6 w-2 animate-pulse rounded-sm bg-orange-500 [animation-delay:450ms]"/><span className="h-3 w-2 animate-pulse rounded-sm bg-orange-700 [animation-delay:600ms]"/></div>}

        <div className="flex flex-wrap justify-center gap-2">
          {state === "idle" && <Button onClick={onStart} disabled={disabled || busy} className="bg-orange-600 font-bold text-black hover:bg-orange-700">{busy ? "JOINING..." : "FIND MATCH"}</Button>}
          {state === "searching" && <Button onClick={onCancel} disabled={busy} variant="destructive" className="min-w-52 border-2 border-red-500 bg-red-800 font-mono font-bold text-white hover:bg-red-700">{busy ? "CANCELLING..." : "CANCEL QUEUE"}</Button>}
          {(state === "found" || (state === "accepting" && !snapshot.viewerAccepted)) && <><Button onClick={onDecline} disabled={busy} variant="destructive">DECLINE</Button><Button onClick={onAccept} disabled={busy} className="bg-green-800 text-green-100 hover:bg-green-700">{busy ? "ACCEPTING..." : "ACCEPT MATCH"}</Button></>}
          {state === "accepting" && snapshot.viewerAccepted && <p className="font-mono text-sm text-green-300">YOUR ACCEPTANCE IS RECORDED</p>}
          {state === "map_selecting" && !selection?.viewerConfirmed && <Button onClick={onSubmitMaps} disabled={busy || selectedMaps.length !== (selection?.requiredCount || 5)} className="bg-green-800 text-green-100 hover:bg-green-700">{busy ? "CONFIRMING..." : "CONFIRM 5 MAPS"}</Button>}
          {state === "map_selecting" && selection?.viewerConfirmed && <p className="font-mono text-sm text-green-300">YOUR 5 MAPS ARE CONFIRMED</p>}
          {state === "server_assigned" && <Button onClick={onLaunch} disabled={busy} className="bg-green-800 text-green-100 hover:bg-green-700">OPEN ACTIVE MATCH</Button>}
        </div>
        {active && <p className="text-center text-[11px] font-mono text-gray-600">State is synchronized from the backend and PostgreSQL.</p>}
      </CardContent>
    </Card>
  );
}

function State({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="rounded border border-orange-900/20 bg-orange-900/10 p-4 text-center"><div className="mx-auto mb-2 flex justify-center text-orange-400">{icon}</div><p className="font-mono text-green-400">{title}</p><p className="mt-1 text-xs font-mono text-gray-400">{detail}</p></div>;
}
