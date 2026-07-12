import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Progress } from "./ui/progress";
import { Trophy, Star, Target, Zap } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { avatarBadges, profileFrames } from "../utils/badgeData";

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
  };
}

export function PlayerProfile({ player }: PlayerProfileProps) {
  const { user } = useUser();
  const winRate = Math.round((player.wins / (player.wins + player.losses)) * 100);
  
  // Get equipped badge and frame
  const equippedBadge = avatarBadges.find(badge => badge.id === user?.equippedBadge);
  const equippedFrame = profileFrames.find(frame => frame.id === user?.equippedFrame);
  
  return (
    <Card className="w-full max-w-sm border-orange-900/20 bg-black/40">
      <CardHeader className="text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="relative">
            <Avatar className={`w-20 h-20 border-2 ${
              equippedFrame 
                ? 'border-orange-400 shadow-lg shadow-orange-500/30' 
                : 'border-orange-900/30'
            }`}>
              <AvatarImage src={player.avatar} alt={player.name} />
              <AvatarFallback className="bg-orange-900/20 text-orange-400">{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {equippedBadge && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-black/90 border-2 border-orange-900/30 rounded-full flex items-center justify-center text-lg">
                {equippedBadge.icon}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-orange-400">{player.name}</h3>
            <Badge variant="secondary" className="mt-1 bg-green-900/20 text-green-400 border-green-900/30 font-mono">
              <Trophy className="w-3 h-3 mr-1" />
              {player.rank}
            </Badge>
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
            <span>{player.wins}W</span>
          </div>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-red-500" />
            <span>{player.losses}L</span>
          </div>
          <div className="flex items-center space-x-1">
            <Zap className="w-4 h-4 text-blue-500" />
            <span>{winRate}% WR</span>
          </div>
          <div className="flex items-center space-x-1">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>{player.kda} KDA</span>
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




