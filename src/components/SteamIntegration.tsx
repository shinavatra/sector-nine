import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Alert, AlertDescription } from "./ui/alert";
import { CheckCircle, ExternalLink, Loader2, RefreshCw, Shield, XCircle } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { steamAPI } from "../utils/api";
import { initiateSteamLogin, isInIframe } from "../utils/steamAuth";
import { toast } from "sonner";

type SteamGame = {
  appId: number;
  name: string;
  playtimeMinutes: number;
  lastPlayedAt: string | null;
  iconUrl: string | null;
};

type SteamStatus = {
  linked: boolean;
  steamId?: string;
  personaName?: string | null;
  avatar?: string | null;
  profileUrl?: string | null;
  level?: number | null;
  profileVisibility?: "public" | "private" | "unknown";
  gamesVisible?: boolean;
  vac?: { banned: boolean; count: number };
  gameBans?: { banned: boolean; count: number };
  ownedGames?: SteamGame[];
  ownsHL1?: boolean;
  verified?: boolean;
  lastRefreshedAt?: string | null;
  verification?: { code: string; message: string };
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load Steam account details.";

export function SteamIntegration() {
  const { user, adoptProfile } = useUser();
  const [status, setStatus] = useState<SteamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(user?.steamId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!user?.steamId) {
      setStatus({ linked: false });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await steamAPI.getStatus();
      setStatus(response.steam);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [user?.steamId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await steamAPI.refresh();
      setStatus(response.steam);
      if (response.profile) adoptProfile(response.profile);
      toast.success("Steam profile refreshed", {
        description: "Avatar, games, level, visibility, and ban status are up to date.",
      });
    } catch (refreshError) {
      const message = errorMessage(refreshError);
      setError(message);
      toast.error("Steam refresh failed", { description: message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSteamConnect = async () => {
    setIsConnecting(true);
    try {
      if (window.location.protocol === "http:" && window.location.hostname !== "localhost") {
        throw new Error("Steam login requires HTTPS in production.");
      }
      if (isInIframe()) {
        toast.info("Opening Steam login", {
          description: "Allow popups if the Steam sign-in window is blocked.",
        });
      }
      await initiateSteamLogin('link');
    } catch (connectError) {
      setIsConnecting(false);
      toast.error("Steam connection failed", { description: errorMessage(connectError) });
    }
  };

  if (!user?.steamId) {
    return (
      <Card className="border-orange-900/20 bg-black/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-400">
            <ExternalLink className="h-5 w-5" />
            Steam Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6 text-center">
          <p className="text-sm text-gray-400">
            Connect through Steam OpenID. Sector Nine reads public profile, ownership, level, and ban
            information; your Steam credentials are never shared with us.
          </p>
          <Button onClick={handleSteamConnect} disabled={isConnecting} className="bg-blue-700 hover:bg-blue-800">
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            {isConnecting ? "Connecting..." : "Sign in through Steam"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !status) {
    return (
      <Card className="border-orange-900/20 bg-black/40">
        <CardHeader><CardTitle className="flex items-center gap-2 text-orange-400"><Loader2 className="size-5 animate-spin" />Verifying Steam account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4"><div className="size-20 animate-pulse rounded-full bg-blue-950/60" /><div className="flex-1 space-y-2"><div className="h-5 w-40 animate-pulse rounded bg-gray-800" /><div className="h-3 w-56 max-w-full animate-pulse rounded bg-gray-900" /></div></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0,1,2,3].map(item=><div key={item} className="h-16 animate-pulse rounded border border-white/10 bg-black/30" />)}</div>
          <p className="text-center font-mono text-xs text-gray-500">Loading verified profile, ownership, visibility, and ban status...</p>
        </CardContent>
      </Card>
    );
  }

  const games = status?.ownedGames || [];
  const profileName = status?.personaName || user.username;

  return (
    <Card className={`border bg-black/40 ${status?.verified?'border-green-800/40':'border-amber-800/40'}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-orange-400">
            <Shield className="h-5 w-5" />
            Steam Profile
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isRefreshing ? "Reverifying..." : "Reverify Steam"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert className="border-red-800 bg-red-950 text-red-200">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-blue-900/30 bg-gradient-to-r from-blue-950/30 to-black/20 p-4 sm:flex sm:min-w-0 sm:items-center sm:gap-4">
          <Avatar className="h-20 w-20 border-2 border-blue-700/50 shadow-lg shadow-blue-950/40">
            <AvatarImage src={status?.avatar || user.steamAvatar || ""} alt={profileName} />
            <AvatarFallback>{profileName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="mt-3 min-w-0 flex-1 sm:mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-orange-400">{profileName}</h3>
              <Badge className={status?.verified ? "bg-green-950 text-green-300" : "bg-yellow-950 text-yellow-300"}>
                {status?.verified ? <CheckCircle className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                {status?.verified ? "Verified" : "Verification required"}
              </Badge>
            </div>
            <p className="text-xs text-gray-400">SteamID {status?.steamId || user.steamId}</p>
            <p className="mt-1 text-xs text-gray-500">Last verification: {status?.lastRefreshedAt ? new Date(status.lastRefreshedAt).toLocaleString() : "Never"}</p>
          </div>
        </div>

        {status?.verification && (
          <Alert className={status.verified ? "border-green-900 bg-green-950/40" : "border-yellow-900 bg-yellow-950/40"}>
            <AlertDescription className={status.verified ? "text-green-200" : "text-yellow-200"}>
              {status.verification.message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-5">
          <Metric label="Game ownership" value={status?.ownsHL1 ? "Half-Life owned" : "Not verified"} danger={!status?.ownsHL1} />
          <Metric label="Steam level" value={status?.level == null ? "Unavailable" : String(status.level)} />
          <Metric label="Visibility" value={status?.profileVisibility || "Unknown"} />
          <Metric label="VAC status" value={status?.vac?.banned ? `Banned (${status.vac.count})` : "Clear"} danger={status?.vac?.banned} />
          <Metric label="Game-ban status" value={status?.gameBans?.banned ? `Banned (${status.gameBans.count})` : "Clear"} danger={status?.gameBans?.banned} />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-orange-400">Owned games ({games.length})</h4>
            {(!status?.gamesVisible || status?.profileVisibility !== "public") && (
              <span className="text-xs text-yellow-300">A private profile can hide library results.</span>
            )}
          </div>
          {games.length ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {games.map((game) => (
                <div key={game.appId} className="flex min-w-0 items-center gap-3 rounded border border-white/10 bg-black/30 p-2">
                  {game.iconUrl && <img src={game.iconUrl} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-200">{game.name}</p>
                    <p className="text-xs text-gray-500">{(game.playtimeMinutes / 60).toFixed(1)} hours</p>
                  </div>
                  {game.appId === 70 && <Badge className="bg-green-950 text-green-300">Required game</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded border border-white/10 p-3 text-sm text-gray-400">
              No public owned-game data is available.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-gray-500">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(status?.profileUrl || `https://steamcommunity.com/profiles/${user.steamId}`, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Steam profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-black/30 p-3">
      <p className="truncate text-xs text-gray-500">{label}</p>
      <p className={`mt-1 capitalize ${danger ? "text-red-400" : "text-green-400"}`}>{value}</p>
    </div>
  );
}
