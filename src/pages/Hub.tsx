import { PlayerProfile } from "../components/PlayerProfile";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Users, Clock, Play, Trophy, ExternalLink, MessageCircle, Youtube, Twitter, Twitch, TrendingUp, Calendar, Snowflake, Flower, Sun, Leaf } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { statsAPI } from "../utils/api";
import { useState, useEffect } from "react";
import heroImage from 'figma:asset/819394a5391d24198a8e0461bd44cc5ad28fff0a.png';

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

  // Create player data from user context
  const playerData = {
    name: user?.username || "Operative",
    avatar: user?.resolvedAvatar || "",
    rank: user?.isPremium ? "VIP RESEARCHER" : `LEVEL ${user?.level || 0} RESEARCHER`,
    level: user?.level || 0,
    experience: user?.experience || 0,
    maxExperience: 300, // 300 XP per level
    wins: user?.stats?.wins || 0,
    losses: user?.stats?.losses || 0,
    kda: user?.stats?.kills && user?.stats?.deaths 
      ? (user.stats.kills / Math.max(user.stats.deaths, 1)).toFixed(2)
      : "0.00",
    mainGames: ["Half-Life 1"]
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-80 bg-gradient-to-r from-orange-900/20 to-green-900/10 overflow-hidden border-b border-orange-900/20">
        <img
          src={heroImage}
          alt="Combat Operations"
          className="absolute inset-0 w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
        <div className="relative container mx-auto px-4 h-full flex items-center">
          <div className="max-w-3xl">
            <div className="text-green-400 font-mono text-sm mb-2">SYSTEM STATUS: OPERATIONAL</div>
            <h1 className="text-5xl font-bold mb-4 text-orange-400">SECTOR NINE INITIATIVE</h1>
            <h2 className="text-2xl mb-4 text-gray-300">FREE REGISTRATION AVAILABLE</h2>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <PlayerProfile player={playerData} />
            
            {/* HLTV Section */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">HLTV FEED</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="text-center py-6">
                    <p className="text-gray-400 font-mono text-sm">CONNECTING TO FEED...</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
                  onClick={() => window.open('https://hltv.org', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  VIEW MORE ON HLTV
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
                    <div className="text-xs text-gray-400 font-mono">Online Players</div>
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

            {/* Latest News / Updates */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">LATEST NEWS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-400 font-mono text-sm">
                    No news updates at this time
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            {/* Latest News */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">LATEST NEWS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="text-center py-6">
                    <p className="text-gray-400 font-mono text-sm">NO NEWS UPDATES AVAILABLE</p>
                    <p className="text-gray-500 font-mono text-xs mt-2">Check back soon for updates</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* VIP Subscription */}
            <Card className="bg-gradient-to-br from-yellow-900/20 via-orange-900/20 to-green-900/20 border-yellow-900/30">
              <CardHeader>
                <CardTitle className="text-yellow-400 font-mono flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  VIP SUBSCRIPTION
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-3">
                    <div className="text-2xl font-bold text-yellow-400 font-mono mb-1">
                      5000 Points / €5
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
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  COMPETITIVE LADDERS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">FOLLOW US</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
