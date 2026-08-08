import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Play, Users, Clock, Eye, Loader2 } from "lucide-react";
import { statsAPI } from "../utils/api";
import { useGame } from "../contexts/GameContext";

interface ActiveMatch {
  id: string;
  match_type: string;
  status: string;
  player1_username: string;
  player1_avatar: string;
  player1_level: number;
  player2_username: string;
  player2_avatar: string;
  player2_level: number;
  selected_map: string;
  score_p1: number;
  score_p2: number;
  created_at: string;
  started_at: string;
}

export function ActiveMatches() {
  const { selectedGame } = useGame();
  const [matches, setMatches] = useState<ActiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchActiveMatches();
    // Poll every 15 seconds
    const interval = setInterval(() => void fetchActiveMatches(), 15000);
    return () => clearInterval(interval);
  }, [selectedGame.id]);

  const fetchActiveMatches = async () => {
    try {
      setError(null);
      const data = await statsAPI.getActiveMatches(selectedGame.id);
      setMatches(data.matches || []);
    } catch (err) {
      setError("Failed to load active matches");
    } finally {
      setLoading(false);
    }
  };

  const getElapsed = (startedAt: string) => {
    if (!startedAt) return "—";
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="w-full border-orange-900/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-400">
          <Play className="w-5 h-5" />
          <span>ACTIVE EXPERIMENTS</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            <span className="ml-2 text-gray-400 font-mono">LOADING ACTIVE MATCHES...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 font-mono">{error}</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 font-mono">NO ACTIVE MATCHES AT THIS TIME</p>
            <p className="text-gray-500 font-mono text-sm mt-2">Check back soon for ongoing battles</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-4 rounded-lg border border-orange-900/20 bg-black/20 hover:bg-orange-900/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="border-green-900/30 text-green-400 bg-green-900/10 font-mono">
                      {match.match_type}
                    </Badge>
                    <Badge variant="secondary" className="bg-red-900/20 text-red-400 border border-red-900/30">
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-1 animate-pulse" />
                      <span className="font-mono">ACTIVE</span>
                    </Badge>
                    <span className="text-sm text-gray-400 font-mono">{match.selected_map || "—"}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-400 font-mono">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span>{getElapsed(match.started_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Player 1 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-6 h-6 border border-orange-900/30">
                        <AvatarImage src={match.player1_avatar} alt={match.player1_username} />
                        <AvatarFallback className="text-xs bg-orange-900/20 text-orange-400">
                          {match.player1_username?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Users className="w-4 h-4 text-orange-400" />
                      <span className="font-medium text-orange-400 font-mono">{match.player1_username}</span>
                      <span className="text-xs text-gray-500 font-mono">LVL {match.player1_level}</span>
                    </div>
                    <span className="text-xl font-bold text-orange-400 font-mono">{match.score_p1}</span>
                  </div>

                  <div className="text-center text-sm text-green-400 font-mono font-bold">VS</div>

                  {/* Player 2 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-6 h-6 border border-orange-900/30">
                        <AvatarImage src={match.player2_avatar} alt={match.player2_username} />
                        <AvatarFallback className="text-xs bg-orange-900/20 text-orange-400">
                          {match.player2_username?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Users className="w-4 h-4 text-orange-400" />
                      <span className="font-medium text-orange-400 font-mono">{match.player2_username}</span>
                      <span className="text-xs text-gray-500 font-mono">LVL {match.player2_level}</span>
                    </div>
                    <span className="text-xl font-bold text-orange-400 font-mono">{match.score_p2}</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono">
                    <Eye className="w-4 h-4 mr-2" />
                    OBSERVE
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
