import { PlayerProfile } from "../components/PlayerProfile";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Play, Trophy, MessageCircle, Youtube, Twitter, Twitch, Calendar, Snowflake, Flower, Sun, Leaf, ExternalLink } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { statsAPI } from "../utils/api";
import { NewsFeed } from "../components/NewsFeed";
import { useState, useEffect } from "react";
import heroImage from '../assets/sector-nine-hub-hero.jpg';
import { displayPlayerName } from "../utils/displayName";

interface HubProps {
  onNavigate?: (page: string) => void;
}

export function Hub({ onNavigate }: HubProps) {
  const { user } = useUser();
  const [platformStats, setPlatformStats] = useState<any>(null);

  useEffect(() => {
    statsAPI.getPlatformStats()
      .then(data => setPlatformStats(data))
      .catch(() => {/* non-critical */});
  }, []);

  const numberOrZero = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const wins = numberOrZero(user?.stats?.wins ?? user?.wins);
  const losses = numberOrZero(user?.stats?.losses ?? user?.losses);
  const kills = numberOrZero(user?.stats?.kills ?? user?.totalKills);
  const deaths = numberOrZero(user?.stats?.deaths ?? user?.totalDeaths);
  const level = numberOrZero(user?.level);
  const experience = numberOrZero(user?.experience);
  const playerName = displayPlayerName(user, "Operative");
  const levelStartXp = level * level * 100;
  const nextLevelXp = (level + 1) * (level + 1) * 100;

  // Create player data from normalized, real profile values.
  const playerData = {
    name: playerName,
    avatar: user?.resolvedAvatar || "",
    rank: user?.isPremium ? "VIP RESEARCHER" : `LEVEL ${user?.level || 0} RESEARCHER`,
    level,
    experience: Math.max(0, experience - levelStartXp),
    maxExperience: Math.max(1, nextLevelXp - levelStartXp),
    wins,
    losses,
    kda: deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toFixed(2) : "0.00",
    mainGames: ["Half-Life 1"],
    equippedFrame: user?.equippedFrame,
    isOnline: true,
    isPremium: user?.isPremium ?? false,
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="theme-hero relative h-80 bg-gradient-to-r from-orange-900/20 to-green-900/10 overflow-hidden border-b border-orange-900/20">
        <img
          src={heroImage}
          alt="Combat Operations"
          className="theme-hero-media absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="text-green-400 font-mono text-sm mb-2">SYSTEM STATUS: OPERATIONAL</div>
            <h1 className="text-5xl font-bold mb-4 text-orange-400">SECTOR NINE INITIATIVE</h1>
            <p className="text-lg text-gray-400 font-mono leading-relaxed">
              QUANTUM GAMING PROTOCOLS ONLINE.<br />
              COMPETITIVE MATCHMAKING & TOURNAMENTS.
            </p>
            <div className="mt-6 text-orange-400 font-mono text-sm animate-pulse">
              &gt; AWAITING PERSONNEL DEPLOYMENT...
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <PlayerProfile player={playerData} />
            
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader><CardTitle className="text-orange-400 font-mono">HLTV FEED</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="py-6 text-center"><p className="text-sm font-mono text-gray-400">CONNECTING TO FEED...</p></div>
                <Button variant="outline" className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono" onClick={() => window.open("https://hltv.org", "_blank")}>
                  <ExternalLink className="mr-2 h-4 w-4" />VIEW MORE ON HLTV
                </Button>
              </CardContent>
            </Card>


          </div>

          {/* Main Content */}
          <div className="lg:col-span-6 space-y-6">
            {/* Platform Stats at top */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">PLATFORM STATUS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-black/20 border border-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-400 font-mono">{platformStats ? platformStats.totalPlayers.toLocaleString() : "---"}</div>
                    <div className="text-xs text-gray-400 font-mono">Registered Players</div>
                  </div>
                  <div className="text-center p-3 bg-black/20 border border-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-400 font-mono">{platformStats ? platformStats.activeMatches : "---"}</div>
                    <div className="text-xs text-gray-400 font-mono">Active Matches</div>
                  </div>
                  <div className="text-center p-3 bg-black/20 border border-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400 font-mono">{platformStats ? platformStats.totalMatches.toLocaleString() : "---"}</div>
                    <div className="text-xs text-gray-400 font-mono">Total Matches</div>
                  </div>
                  <div className="text-center p-3 bg-black/20 border border-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400 font-mono">{platformStats ? platformStats.activeTournaments : "---"}</div>
                    <div className="text-xs text-gray-400 font-mono">Tournaments</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <NewsFeed />
          </div>

          {/* Right Sidebar */}
          <div className="hub-right-rail lg:col-span-3 space-y-6">
            {/* VIP Subscription */}
            <Card className="gap-4 bg-gradient-to-br from-yellow-900/20 via-orange-900/20 to-green-900/20 border-yellow-900/30">
              <CardHeader className="px-5 pt-5">
                <CardTitle className="text-yellow-400 font-mono flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  VIP SUBSCRIPTION
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-4">
                  <div className="text-center py-3">
                    <div className="text-2xl font-bold text-yellow-400 font-mono mb-1">
                      View current Store offer
                    </div>
                    <div className="text-xs text-gray-400 font-mono">per month</div>
                  </div>
                  <Button
                    onClick={() => onNavigate?.('vip-subscription')}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-500 hover:to-orange-500 font-mono"
                  >
                    GET VIP ACCESS
                  </Button>
                  <div className="text-xs text-gray-400 font-mono text-center">
                    Tournament access • +50 XP per win • 1000 bonus points
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competitive Ladders */}
            <Card className="gap-4 bg-black/40 border-orange-900/20">
              <CardHeader className="px-5 pt-5">
                <CardTitle className="text-orange-400 font-mono flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  COMPETITIVE LADDERS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                <Button
                  variant="outline"
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start h-auto py-4"
                  onClick={() => onNavigate?.('monthly-ladder')}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-green-400" />
                      <div className="text-left">
                        <div className="font-bold">MONTHLY LADDER</div>
                        <div className="text-xs text-gray-400">Resets 1st of month</div>
                      </div>
                    </div>
                    <Play className="w-4 h-4" />
                  </div>
                </Button>

                {(() => {
                  const now = new Date();
                  const month = now.getMonth();
                  let seasonName = 'WINTER';
                  let seasonIcon = Snowflake;
                  let seasonPage = 'winter-ladder';
                  let borderColor = 'border-blue-900/30';
                  let textColor = 'text-blue-400';
                  let hoverColor = 'hover:bg-blue-900/10';
                  
                  if (month >= 2 && month <= 4) {
                    seasonName = 'SPRING';
                    seasonIcon = Flower;
                    seasonPage = 'spring-ladder';
                    borderColor = 'border-pink-900/30';
                    textColor = 'text-pink-400';
                    hoverColor = 'hover:bg-pink-900/10';
                  } else if (month >= 5 && month <= 7) {
                    seasonName = 'SUMMER';
                    seasonIcon = Sun;
                    seasonPage = 'summer-ladder';
                    borderColor = 'border-yellow-900/30';
                    textColor = 'text-yellow-400';
                    hoverColor = 'hover:bg-yellow-900/10';
                  } else if (month >= 8 && month <= 10) {
                    seasonName = 'AUTUMN';
                    seasonIcon = Leaf;
                    seasonPage = 'autumn-ladder';
                    borderColor = 'border-amber-900/30';
                    textColor = 'text-amber-400';
                    hoverColor = 'hover:bg-amber-900/10';
                  }
                  
                  const SeasonIcon = seasonIcon;
                  
                  return (
                    <Button
                      variant="outline"
                      className={`w-full ${borderColor} ${textColor} ${hoverColor} font-mono justify-start h-auto py-4`}
                      onClick={() => onNavigate?.(seasonPage)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-3">
                          <SeasonIcon className={`w-5 h-5`} />
                          <div className="text-left">
                            <div className="font-bold">{seasonName} SEASON</div>
                            <div className="text-xs text-gray-400">Current season</div>
                          </div>
                        </div>
                        <Play className="w-4 h-4" />
                      </div>
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card className="gap-4 bg-black/40 border-orange-900/20">
              <CardHeader className="px-5 pt-5">
                <CardTitle className="text-orange-400 font-mono">FOLLOW US</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                <Button 
                  variant="outline" 
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://twitter.com/sectorninehl', '_blank')}
                >
                  <Twitter className="w-4 h-4 mr-2" />
                  @SECTORNINEHL
                </Button>  
                <Button 
                  variant="outline" 
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://youtube.com/@sectornineinitiative', '_blank')}
                >
                  <Youtube className="w-4 h-4 mr-2" />
                  SECTOR NINE INITIATIVE
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://twitch.tv/sectorninehl', '_blank')}
                >
                  <Twitch className="w-4 h-4 mr-2" />
                  SECTORNINEHL
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://discord.gg/sectornine', '_blank')}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  DISCORD COMMUNITY
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
