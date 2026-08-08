import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "./UserContext";
import { gameAPI } from "../utils/api";

export type GameId = "hl1" | "cs16" | "l4d2" | "cod4";

export interface GameDefinition {
  id: GameId;
  name: string;
  shortName: string;
}

export const supportedGames: GameDefinition[] = [
  { id: "hl1", name: "Half-Life 1", shortName: "HL1" },
  { id: "cs16", name: "Counter-Strike 1.6", shortName: "CS 1.6" },
  { id: "l4d2", name: "Left 4 Dead 2", shortName: "L4D2" },
  { id: "cod4", name: "Call of Duty 4 Promod", shortName: "CoD4" },
];

interface GameContextValue {
  selectedGame: GameDefinition;
  availableGames: GameDefinition[];
  verifiedGames: GameId[];
  setSelectedGame: (gameId: GameId) => Promise<void>;
  loading: boolean;
  error: string | null;
  lockedReason: (gameId: GameId) => string | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, updateProfile } = useUser();
  const [selectedGameId, setSelectedGameId] = useState<GameId>(user?.preferredGameId || "hl1");
  const [saving, setSaving] = useState(false);
  const [enabledGameIds,setEnabledGameIds]=useState<GameId[]>(["hl1"]);
  const [error, setError] = useState<string | null>(null);
  const verifiedGames = user?.verifiedGames || [];

  useEffect(()=>{
    let active=true;
    const loadEnabledGames=()=>gameAPI.getEnabled().then(response=>{
      if(!active)return;
      const enabled=(Array.isArray(response?.games)?response.games:[])
        .map((game:any)=>game.id)
        .filter((gameId:any):gameId is GameId=>supportedGames.some(game=>game.id===gameId));
      setEnabledGameIds(enabled.length?enabled:["hl1"]);
    }).catch(()=>{if(active)setEnabledGameIds(["hl1"])});
    void loadEnabledGames();
    window.addEventListener("sector-nine:games-changed",loadEnabledGames);
    return()=>{active=false;window.removeEventListener("sector-nine:games-changed",loadEnabledGames)};
  },[]);

  useEffect(() => {
    if (!user?.preferredGameId) return;
    setSelectedGameId(user.preferredGameId);
    localStorage.setItem("selected_game_id", user.preferredGameId);
    window.dispatchEvent(new Event("sector-nine:selected-game"));
  }, [user?.preferredGameId]);

  const lockedReason = useCallback((gameId: GameId) => {
    if (verifiedGames.includes(gameId)) return null;
    if (!user?.steamId) return "Connect Steam to verify ownership.";
    if (user.vacBanned || user.gameBanned) return "Steam account is not eligible for competitive play.";
    return "Verified ownership or game access is required.";
  }, [user?.gameBanned, user?.steamId, user?.vacBanned, verifiedGames]);

  const setSelectedGame = useCallback(async (gameId: GameId) => {
    if(!enabledGameIds.includes(gameId)){
      const message="This game is not enabled on the platform.";
      setError(message);
      throw new Error(message);
    }
    const reason = lockedReason(gameId);
    if (reason) {
      setError(reason);
      throw new Error(reason);
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ preferredGameId: gameId });
      setSelectedGameId(gameId);
      localStorage.setItem("selected_game_id", gameId);
      window.dispatchEvent(new Event("sector-nine:selected-game"));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to save selected game.";
      setError(message);
      throw reason;
    } finally {
      setSaving(false);
    }
  }, [enabledGameIds, lockedReason, updateProfile]);

  useEffect(()=>{
    if(enabledGameIds.includes(selectedGameId))return;
    setSelectedGameId(enabledGameIds[0]||"hl1");
  },[enabledGameIds,selectedGameId]);

  const value = useMemo<GameContextValue>(() => ({
    selectedGame: supportedGames.find(game => game.id === selectedGameId) || supportedGames[0],
    availableGames: supportedGames.filter(game=>enabledGameIds.includes(game.id)),
    verifiedGames,
    setSelectedGame,
    loading: isLoading || saving,
    error,
    lockedReason,
  }), [enabledGameIds, error, isLoading, lockedReason, saving, selectedGameId, setSelectedGame, verifiedGames]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}
