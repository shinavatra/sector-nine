import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { FramedAvatar } from "../components/FramedAvatar";
import { Trophy, Calendar, TrendingUp, Medal, Crown, Star, ArrowLeft } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { statsAPI } from "../utils/api";

interface MonthlyLadderProps {
  onNavigate?: (page: string) => void;
}

export function MonthlyLadder({ onNavigate }: MonthlyLadderProps) {
  const { user } = useUser();
  const [currentMonth, setCurrentMonth] = useState("");
  const [daysUntilReset, setDaysUntilReset] = useState(0);

  useEffect(() => {
    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    setCurrentMonth(monthName);

    // Calculate days until next month (reset)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysLeft = lastDay.getDate() - now.getDate();
    setDaysUntilReset(daysLeft);
  }, []);

  const [ladderData, setLadderData] = useState<any[]>([]);
  const [ladderSeason, setLadderSeason] = useState<any>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    statsAPI.getLadder('monthly')
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
            <div className="text-4xl">📊</div>
            <div>
              <h1 className="text-3xl text-orange-400 font-mono">MONTHLY LADDER</h1>
              <p className="text-gray-400 font-mono mt-1">{currentMonth} • Resets on the 1st of each month</p>
            </div>
          </div>
          <Card className="bg-black/40 border-orange-900/20">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl text-orange-400 font-mono">{daysUntilReset}</div>
                <div className="text-xs text-gray-400 font-mono">Days Until Reset</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-green-900/20 border-orange-900/30 mb-8">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Calendar className="w-8 h-8 text-green-400" />
            <div>
              <h3 className="text-green-400 font-mono text-lg">MONTHLY COMPETITION</h3>
              <p className="text-gray-300 font-mono">Ladder rankings reset on the 1st of every month. Compete for top position!</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Ranking */}
      {user && (
        <Card className="bg-black/40 border-orange-900/20 mb-8">
          <CardHeader>
            <CardTitle className="text-orange-400 font-mono">YOUR CURRENT RANKING</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-orange-900/10 rounded border border-orange-900/30">
              <div className="flex items-center space-x-4">
                <div className="text-2xl text-orange-400 font-mono">{userRank ? `#${userRank}` : "--"}</div>
                <FramedAvatar frameId={user.equippedFrame}><Avatar className="h-12 w-12 border-2 border-orange-900/30">
                  <AvatarImage src={user.resolvedAvatar} alt={user.username} />
                  <AvatarFallback className="bg-orange-900/20 text-orange-400">
                    {user.username.slice(0, 2)}
                  </AvatarFallback>
                </Avatar></FramedAvatar>
                <div>
                  <div className="text-orange-400 font-mono">{user.username}</div>
                  <div className="text-xs text-green-400 font-mono">Level {user.level || 0}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl text-green-400 font-mono">{user.stats?.wins || 0}</div>
                <div className="text-xs text-gray-400 font-mono">Monthly Wins</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ladder Rankings */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <Trophy className="w-5 h-5 mr-2" />
            TOP MONTHLY RANKINGS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ladderData.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
              <div className="text-gray-400 font-mono text-sm">
                Monthly ladder is empty
              </div>
              <div className="text-xs text-gray-500 font-mono mt-2">
                Be the first to climb the ranks this month!
              </div>
              <Button
                onClick={() => onNavigate?.('lobby')}
                className="mt-4 bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
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
                    <FramedAvatar frameId={player.equippedFrame}><Avatar className="h-10 w-10 border-2 border-orange-900/30">
                      <AvatarImage src={player.resolvedAvatar || player.steam_avatar || ""} alt={player.username} />
                      <AvatarFallback className="bg-orange-900/20 text-orange-400">
                        {(player.username || "??").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar></FramedAvatar>
                    <div>
                      <div className="text-orange-400 font-mono">{player.username}</div>
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
                      <div className="text-orange-400">{player.win_rate || 0}%</div>
                      <div className="text-xs text-gray-400">WIN RATE</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="bg-black/40 border-orange-900/20 mt-8">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono">MONTHLY LADDER RULES</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-gray-300 font-mono text-sm">
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-green-400">Monthly Reset:</strong> Rankings reset on the 1st day of each month at 00:00 UTC
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-green-400">Ranking System:</strong> Players are ranked by total wins in the current month
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-green-400">All Modes Count:</strong> Wins from both Classic Deathmatch and Instagib Mode are included
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Star className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-green-400">Fair Play:</strong> Accounts flagged for suspicious activity will be removed from rankings
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
