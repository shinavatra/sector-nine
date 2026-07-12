import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
  steam_avatar: string | null;
  is_premium: boolean;
  level: number;
  experience: number;
  wins: number;
  losses: number;
  win_streak: number;
  best_win_streak: number;
  win_rate: number;
  rank: number;
}

export function Leaderboard() {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/leaderboard`);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      setPlayers(data.leaderboard || []);
    } catch (err) {
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-orange-400" />;
      case 2: return <Medal className="w-5 h-5 text-green-400" />;
      case 3: return <Award className="w-5 h-5 text-orange-300" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-orange-400 font-mono">{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-gradient-to-r from-orange-900/30 to-orange-900/10 border-orange-900/40";
      case 2: return "bg-gradient-to-r from-green-900/30 to-green-900/10 border-green-900/40";
      case 3: return "bg-gradient-to-r from-orange-900/20 to-orange-900/5 border-orange-900/30";
      default: return "bg-black/20 border-orange-900/20";
    }
  };

  return (
    <Card className="w-full border-orange-900/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-400">
          <Trophy className="w-5 h-5" />
          <span>RESEARCH RANKINGS</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            <span className="ml-2 text-gray-400 font-mono">LOADING RANKINGS...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 font-mono">{error}</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 font-mono">NO RANKING DATA AVAILABLE</p>
            <p className="text-gray-500 font-mono text-sm mt-2">Play matches to appear on the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center space-x-4 p-3 rounded-lg border ${getRankColor(player.rank)}`}
              >
                <div className="flex items-center space-x-3">
                  {getRankIcon(player.rank)}
                  <Avatar className="w-10 h-10 border-2 border-orange-900/30">
                    <AvatarImage src={player.steam_avatar || ""} alt={player.username} />
                    <AvatarFallback className="bg-orange-900/20 text-orange-400">
                      {player.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-orange-400 font-mono">
                        {player.display_name || player.username}
                        {player.is_premium && (
                          <span className="ml-2 text-xs text-yellow-400 font-mono">[VIP]</span>
                        )}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs border-green-900/30 text-green-400 bg-green-900/10 font-mono">
                          LVL {player.level}
                        </Badge>
                        <span className="text-sm text-gray-400 font-mono">
                          {player.wins}W / {player.losses}L
                          {player.win_rate > 0 && (
                            <span className="ml-1 text-green-400">({player.win_rate}%)</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg text-orange-400 font-mono">{player.experience}</p>
                      <p className="text-xs text-green-400 font-mono">XP</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
