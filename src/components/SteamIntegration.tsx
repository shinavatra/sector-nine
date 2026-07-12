import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ExternalLink, Shield, Users, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { getSteamProfile, getSteamGames, initiateSteamLogin, isInIframe } from "../utils/steamAuth";
import { toast } from "sonner";

interface SteamProfile {
  steamId: string;
  username: string;
  avatar: string;
  accountAge: number;
  vacBans: number;
  gameBans: number;
  lastBan: string | null;
  level: number;
  games: Array<{
    appId: string;
    name: string;
    hours: number;
    lastPlayed: string;
  }>;
}

export function SteamIntegration() {
  const { user, refreshProfile } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [steamProfile, setSteamProfile] = useState<SteamProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadSteamProfile();
  }, [user?.steamId]);

  const loadSteamProfile = async () => {
    if (!!user?.steamId) {
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get Steam profile
      const profile = await getSteamProfile(user.steamId);
      
      if (!profile) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      // Get games
      const games = await getSteamGames(user.steamId);
      
      // Calculate account age
      const accountCreated = new Date(profile.accountCreated);
      const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (365 * 24 * 60 * 60 * 1000));
      
      // Format games data
      const formattedGames = games.slice(0, 4).map(game => ({
        appId: game.appId.toString(),
        name: game.name,
        hours: Math.floor(game.playtime / 60),
        lastPlayed: game.lastPlayed ? formatLastPlayed(game.lastPlayed) : 'Never'
      }));

      setSteamProfile({
        steamId: profile.steamId,
        username: profile.username,
        avatar: profile.avatar,
        accountAge,
        vacBans: 0, // Not provided by Steam API in basic call
        gameBans: 0, // Not provided by Steam API in basic call
        lastBan: null,
        level: 0, // Would need separate Steam API call
        games: formattedGames
      });
      
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to load Steam profile:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastPlayed = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
  };

  const handleSteamConnect = () => {
    setIsConnecting(true);
    
    try {
      // Check if we're in a secure context
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("Secure connection required", {
          description: "Steam login requires HTTPS in production.",
          className: "bg-red-900/90 border-red-700 text-red-100"
        });
        setIsConnecting(false);
        return;
      }

      // Check if in iframe
      if (isInIframe()) {
        toast.info("Opening Steam login", {
          description: "Steam login will open in a new window. Please allow popups if blocked.",
          className: "bg-blue-900/90 border-blue-700 text-blue-100"
        });
      }

      // Initiate Steam OpenID authentication
      initiateSteamLogin();
      
      // Don't reset loading if in iframe
      if (!isInIframe()) {
        // Loading continues until redirect
      }
    } catch (error) {
      console.error('Steam connection error:', error);
      setIsConnecting(false);
      toast.error("Steam connection failed", {
        description: error instanceof Error ? error.message : "Unable to connect to Steam. Please try again.",
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
    }
  };

  const getTrustFactor = () => {
    if (!steamProfile) return "Unknown";
    
    const { accountAge, vacBans, gameBans, games } = steamProfile;
    const totalHours = games.reduce((sum, game) => sum + game.hours, 0);
    
    if (vacBans > 0 || gameBans > 0) return "Low";
    if (accountAge >= 5 && totalHours >= 1000) return "High";
    if (accountAge >= 2 && totalHours >= 500) return "Medium";
    return "Low";
  };

  const getTrustColor = (trustFactor: string) => {
    switch (trustFactor) {
      case "High": return "text-green-400 bg-green-900/20";
      case "Medium": return "text-orange-400 bg-orange-900/20";
      case "Low": return "text-red-400 bg-red-900/20";
      default: return "text-gray-400 bg-gray-900/20";
    }
  };

  if (isLoading) {
    return (
      <Card className="border-orange-900/20 bg-black/40">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-400">
            <Shield className="w-5 h-5" />
            <span>Steam Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6">
            <Loader2 className="w-8 h-8 mx-auto text-orange-400 animate-spin mb-4" />
            <p className="text-gray-400 font-mono text-sm">Loading Steam profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="border-orange-900/20 bg-black/40">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-400">
            <ExternalLink className="w-5 h-5" />
            <span>Steam Integration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-8 h-8 text-white" />
            </div>
            <h3 className="mb-2 text-orange-400">Connect your Steam account</h3>
            <p className="text-sm text-gray-400 mb-4">
              Link your Steam profile to verify your gaming credentials and unlock competitive features.
            </p>
            <Button 
              onClick={handleSteamConnect}
              disabled={isConnecting}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Sign in through Steam
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trustFactor = getTrustFactor();

  return (
    <Card className="border-orange-900/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-400">
          <Shield className="w-5 h-5" />
          <span>Steam Profile</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-12 h-12 border-2 border-orange-900/30">
            <AvatarImage src={steamProfile?.avatar} alt={steamProfile?.username} />
            <AvatarFallback className="bg-orange-900/20 text-orange-400">
              {steamProfile?.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-orange-400">{steamProfile?.username}</h3>
              {user?.steamVerified && (
                <Badge className="bg-green-900/20 text-green-400 border-green-900/30 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400">Steam Account</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Account Age</span>
              <span className="text-green-400">{steamProfile?.accountAge}y</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VAC Bans</span>
              <span className={steamProfile?.vacBans === 0 ? "text-green-400" : "text-red-400"}>
                {steamProfile?.vacBans}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Game Bans</span>
              <span className={steamProfile?.gameBans === 0 ? "text-green-400" : "text-red-400"}>
                {steamProfile?.gameBans}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Trust Factor</span>
              <Badge className={getTrustColor(trustFactor)}>
                {trustFactor}
              </Badge>
            </div>
          </div>
        </div>

        {steamProfile && steamProfile.games.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-orange-400 mb-2">Recent Games</h4>
            <div className="space-y-2">
              {steamProfile.games.map((game) => (
                <div key={game.appId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate mr-2">{game.name}</span>
                  <div className="text-right flex-shrink-0">
                    <div className="text-orange-400">{game.hours}h</div>
                    <div className="text-xs text-gray-500">{game.lastPlayed}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10"
          onClick={() => window.open(`https://steamcommunity.com/profiles/${steamProfile?.steamId}`, '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Full Steam Profile
        </Button>
      </CardContent>
    </Card>
  );
}