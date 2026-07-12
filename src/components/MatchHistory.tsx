import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { History, TrendingUp, TrendingDown, Target, Loader2 } from "lucide-react";
import { getSessionToken } from "../utils/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface MatchRow {
  id: string;
  match_type: string;
  selected_map: string;
  status: string;
  score_p1: number;
  score_p2: number;
  p1_xp_change: number | null;
  p2_xp_change: number | null;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_username: string;
  player1_avatar: string;
  player1_level: number;
  player2_username: string;
  player2_avatar: string;
  player2_level: number;
  created_at: string;
  completed_at: string | null;
}

export function MatchHistory() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchHistory();
  }, []);

  const fetchMatchHistory = async () => {
    try {
      setError(null);
      const token = getSessionToken();
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Fetch current user id + match history in parallel
      const [profileRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/matches/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (profileRes.ok) {
        const { profile } = await profileRes.json();
        setMyId(profile.id);
      }

      if (!historyRes.ok) throw new Error("Failed to fetch match history");
      const data = await historyRes.json();
      setMatches(data.matches || []);
    } catch (err) {
      setError("Failed to load match history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "2-digit",
    });
  };

  const formatDuration = (created: string, completed: string | null) => {
    if (!completed || !created) return "—";
    const secs = Math.floor((new Date(completed).getTime() - new Date(created).getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <Card className="w-full border-orange-900/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-400">
          <History className="w-5 h-5" />
          <span>MISSION HISTORY</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            <span className="ml-2 text-gray-400 font-mono">LOADING MATCH HISTORY...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 font-mono">{error}</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 font-mono">NO MATCH HISTORY AVAILABLE</p>
            <p className="text-gray-500 font-mono text-sm mt-2">Complete matches to see your history</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const isP1 = myId === match.player1_id;
              const myScore = isP1 ? match.score_p1 : match.score_p2;
              const opScore = isP1 ? match.score_p2 : match.score_p1;
              const opponent = isP1
                ? { name: match.player2_username, avatar: match.player2_avatar, level: match.player2_level }
                : { name: match.player1_username, avatar: match.player1_avatar, level: match.player1_level };
              const xpChange = isP1 ? match.p1_xp_change : match.p2_xp_change;
              const won = match.winner_id === myId;

              return (
                <div
                  key={match.id}
                  className="flex items-center space-x-4 p-4 rounded-lg border border-orange-900/20 bg-black/20 hover:bg-orange-900/5 transition-colors"
                >
                  <div className={`w-3 h-8 rounded-full ${won ? "bg-green-400" : "bg-red-400"}`} />

                  <div className="flex items-center space-x-3">
                    <div>
                      <Badge variant="outline" className="mb-1 border-green-900/30 text-green-400 bg-green-900/10 font-mono">
                        {match.match_type}
                      </Badge>
                      <p className="text-xs text-gray-400 font-mono">{match.selected_map || "—"}</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium font-mono ${won ? "text-green-400" : "text-red-400"}`}>
                            {won ? "VICTORY" : "DEFEAT"}
                          </span>
                          <span className="text-sm text-orange-400 font-mono">{myScore} – {opScore}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm font-mono">
                          <div className="flex items-center space-x-1">
                            <Target className="w-3 h-3 text-orange-400" />
                            <span className="text-gray-300">vs {opponent.name}</span>
                            <span className="text-gray-500 text-xs">LVL {opponent.level}</span>
                          </div>
                          <span className="text-gray-300">{formatDuration(match.created_at, match.completed_at)}</span>
                          <span className="text-gray-400">{formatDate(match.completed_at || match.created_at)}</span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`flex items-center space-x-1 font-mono ${won ? "text-green-400" : "text-red-400"}`}>
                          {won ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          <span className="font-medium">
                            {xpChange !== null ? `${xpChange > 0 ? "+" : ""}${xpChange} XP` : "—"}
                          </span>
                        </div>
                        <Avatar className="w-6 h-6 border border-orange-900/30 ml-auto">
                          <AvatarImage src={opponent.avatar} alt={opponent.name} />
                          <AvatarFallback className="text-xs bg-orange-900/20 text-orange-400">
                            {opponent.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
