import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Progress } from "./ui/progress";
import { Trophy, Star, Target, Zap } from "lucide-react";
import { FramedAvatar } from "./FramedAvatar";

interface PlayerProfileProps {
  player: {
    name: string;
    avatar: string;
    rank: string;
    level: number;
    experience: number;
    maxExperience: number;
    wins: number;
    losses: number;
    kda: string;
    mainGames: string[];
    equippedFrame?: string | null;
    isOnline?: boolean;
    isPremium?: boolean;
  };
}

export function PlayerProfile({ player }: PlayerProfileProps) {
  const wins = Number.isFinite(Number(player.wins)) ? Number(player.wins) : 0;
  const losses = Number.isFinite(Number(player.losses)) ? Number(player.losses) : 0;
  const matchesPlayed = wins + losses;
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  const kda = Number.isFinite(Number(player.kda)) ? Number(player.kda).toFixed(2) : '0.00';
  
  return (
    <Card className="w-full max-w-sm border-orange-900/20 bg-black/40">
      <CardHeader className="text-center">
        <div className="flex flex-col items-center space-y-2">
          <div>
            <FramedAvatar frameId={player.equippedFrame}>
              <Avatar className="w-20 h-20 border-2 border-orange-900/30">
                <AvatarImage src={player.avatar} alt={player.name} />
                <AvatarFallback className="bg-orange-900/20 text-orange-400">{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </FramedAvatar>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-orange-400">{player.name}</h3>
            <Badge variant="secondary" className="mt-1 bg-green-900/20 text-green-400 border-green-900/30 font-mono">
              <Trophy className="w-3 h-3 mr-1" />
              {player.rank}
            </Badge>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[10px] font-mono">
              <span className={`rounded border px-2 py-1 ${player.isOnline ? "border-green-900/40 bg-green-950/20 text-green-400" : "border-gray-800 bg-gray-950/40 text-gray-500"}`}>
                {player.isOnline ? "ONLINE" : "OFFLINE"}
              </span>
              <span className={`rounded border px-2 py-1 ${player.isPremium ? "border-yellow-900/40 bg-yellow-950/20 text-yellow-300" : "border-gray-800 bg-gray-950/40 text-gray-500"}`}>
                {player.isPremium ? "VIP" : "STANDARD"}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-400 font-mono">SECURITY LEVEL {player.level}</span>
            <span className="text-sm text-orange-400 font-mono">{player.experience}/{player.maxExperience} EXP</span>
          </div>
          <Progress value={(player.experience / player.maxExperience) * 100} className="h-2 bg-gray-800" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-1">
            <Target className="w-4 h-4 text-green-500" />
            <span>{wins}W</span>
          </div>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-red-500" />
            <span>{losses}L</span>
          </div>
          <div className="flex items-center space-x-1">
            <Zap className="w-4 h-4 text-blue-500" />
            <span>{winRate}% WR</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>{kda} KDA</span>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-green-400 font-mono mb-2">AUTHORIZED PROTOCOLS</p>
          <div className="flex flex-wrap gap-1">
            {player.mainGames.map((game) => (
              <Badge key={game} variant="outline" className="text-xs border-orange-900/30 text-orange-400 bg-orange-900/10 font-mono">
                {game}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
