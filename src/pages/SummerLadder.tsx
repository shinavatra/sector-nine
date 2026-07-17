import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { FramedAvatar } from "../components/FramedAvatar";
import { Trophy, Calendar, TrendingUp, Medal, Crown, Star, ArrowLeft, Clock, Sun } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { statsAPI } from "../utils/api";

interface SummerLadderProps {
  onNavigate?: (page: string) => void;
}

export function SummerLadder({ onNavigate }: SummerLadderProps) {
  const { user } = useUser();
  const [daysUntilEnd, setDaysUntilEnd] = useState(0);
  const [seasonProgress, setSeasonProgress] = useState(0);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Summer season: June-August (Jun 1 - Aug 31)
    const startDate = new Date(currentYear, 5, 1); // June 1
    const endDate = new Date(currentYear, 8, 0); // Last day of August
    
    // Calculate days until end
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysUntilEnd(Math.max(0, diffDays));
    
    // Calculate progress
    const totalSeasonDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalSeasonDays) * 100));
    setSeasonProgress(progress);
  }, []);

  const [ladderData, setLadderData] = useState<any[]>([]);
  const [ladderSeason, setLadderSeason] = useState<any>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    statsAPI.getLadder('summer')
      .then(data => {
        setLadderSeason(data.season || null);
        setLadderData(data.entries || []);
        if (user?.id) {
          const myEntry = data.entries?.find((e: any) => e.user_id === user.id);
          if (myEntry) setUserRank(myEntry.rank || null);
        }
      })
      .catch(err => console.error('Failed to load ladder:', err));
  }, [user?.id]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return <span className="font-mono text-gray-500 text-sm">#{position}</span>;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-yellow-900/20 border-yellow-900/30';
      case 2:
        return 'bg-gray-600/20 border-gray-600/30';
      case 3:
        return 'bg-orange-900/20 border-orange-900/30';
      default:
        return 'bg-black/20 border-orange-900/20';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onNavigate?.('hub')}
            className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/10 font-mono"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK TO HUB
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Sun className="w-12 h-12 text-yellow-400" />
            <div>
              <h1 className="text-3xl text-yellow-400 font-mono">SUMMER SEASON</h1>
              <p className="text-gray-400 font-mono mt-1">June - August</p>
            </div>
          </div>
          <Card className="bg-black/40 border-yellow-900/20">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl text-yellow-400 font-mono">{daysUntilEnd}</div>
                <div className="text-xs text-gray-400 font-mono">Days Remaining</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Season Progress */}
      <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-900/30 mb-8">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Clock className="w-8 h-8 text-yellow-400" />
                <div>
                  <h3 className="text-yellow-400 font-mono text-lg">SUMMER SEASON PROGRESS</h3>
                  <p className="text-gray-300 font-mono">3-month competitive season • Jun-Aug</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl text-yellow-400 font-mono">{seasonProgress.toFixed(0)}%</div>
                <div className="text-xs text-gray-400 font-mono">Complete</div>
              </div>
            </div>
            <div className="w-full bg-black/40 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all duration-500"
                style={{ width: `${seasonProgress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Ranking */}
      {user && (
        <Card className="bg-black/40 border-yellow-900/20 mb-8">
          <CardHeader>
            <CardTitle className="text-yellow-400 font-mono">YOUR SUMMER RANKING</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-yellow-900/10 rounded border border-yellow-900/30">
              <div className="flex items-center space-x-4">
                <div className="text-2xl text-yellow-400 font-mono">{userRank ? `#${userRank}` : "--"}</div>
                <FramedAvatar frameId={user.equippedFrame}><Avatar className="h-12 w-12 border-2 border-yellow-900/30">
                  <AvatarImage src={user.resolvedAvatar} alt={user.username} />
                  <AvatarFallback className="bg-yellow-900/20 text-yellow-400">
                    {user.username.slice(0, 2)}
                  </AvatarFallback>
                </Avatar></FramedAvatar>
                <div>
                  <div className="text-yellow-400 font-mono">{user.username}</div>
                  <div className="text-xs text-green-400 font-mono">Level {user.level || 0}</div>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className="text-xl text-green-400 font-mono">{user.stats?.wins || 0}</div>
                  <div className="text-xs text-gray-400 font-mono">Season Wins</div>
                </div>
                <div className="text-right">
                  <div className="text-xl text-yellow-400 font-mono">{user.stats?.rating || 1000}</div>
                  <div className="text-xs text-gray-400 font-mono">Rating</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Season Rankings */}
      <Card className="bg-black/40 border-yellow-900/20">
        <CardHeader>
          <CardTitle className="text-yellow-400 font-mono flex items-center">
            <Trophy className="w-5 h-5 mr-2" />
            TOP SUMMER RANKINGS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ladderData.length === 0 ? (
            <div className="text-center py-12">
              <Sun className="w-16 h-16 text-yellow-400/30 mx-auto mb-4" />
              <div className="text-gray-400 font-mono text-sm">
                Summer ladder is empty
              </div>
              <div className="text-xs text-gray-500 font-mono mt-2">
                Be the first to dominate the summer season!
              </div>
              <Button
                onClick={() => onNavigate?.('lobby')}
                className="mt-4 bg-yellow-900/20 border border-yellow-900/30 text-yellow-400 hover:bg-yellow-900/30 font-mono"
              >
                Start Matchmaking
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {ladderData.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-4 rounded border ${getRankColor(index + 1)}`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 flex items-center justify-center">
                      {getRankIcon(index + 1)}
                    </div>
                    <FramedAvatar frameId={player.equippedFrame}><Avatar className="h-10 w-10 border-2 border-yellow-900/30">
                      <AvatarImage src={player.resolvedAvatar || player.steam_avatar || ""} alt={player.username} />
                      <AvatarFallback className="bg-yellow-900/20 text-yellow-400">
                        {(player.username || "??").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar></FramedAvatar>
                    <div>
                      <div className="text-yellow-400 font-mono">{player.username}</div>
                      <div className="text-xs text-green-400 font-mono">Level {player.level}</div>
                    </div>
                    {player.isPremium && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-mono text-xs">
                        VIP
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-6 text-sm font-mono">
                    <div className="text-center">
                      <div className="text-green-400">{player.points || 0}</div>
                      <div className="text-xs text-gray-400">POINTS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-400">{player.wins || 0}</div>
                      <div className="text-xs text-gray-400">LOSSES</div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-400">{player.experience || 0}</div>
                      <div className="text-xs text-gray-400">RATING</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Season Rules */}
      <Card className="bg-black/40 border-yellow-900/20 mt-8">
        <CardHeader>
          <CardTitle className="text-yellow-400 font-mono">SUMMER SEASON RULES</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-gray-300 font-mono text-sm">
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-yellow-400">Summer Season:</strong> June 1st - August 31st with complete data reset at the end
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-yellow-400">Ranking System:</strong> Players ranked by total season wins and overall rating
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-yellow-400">Complete Reset:</strong> All season statistics reset to zero at the start of each new season
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-yellow-400">Season Rewards:</strong> Top 10 players receive exclusive badges and bonus points
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
