import { useState, useEffect, useRef } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Globe, Zap, Map, Users, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { matchmakingAPI, reportAPI } from "../utils/api";
import { toast } from "sonner";

interface LobbyProps {
  onNavigate: (page: string) => void;
  onStartMatch?: (matchType: string, mapName: string) => void;
  isPremium?: boolean;
}

export function Lobby({ onNavigate, onStartMatch }: LobbyProps) {
  const [activeTab, setActiveTab] = useState("server-config");
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedMod, setSelectedMod] = useState<string>("classic-deathmatch");
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);

  // Use ref so the interval callback always sees latest isSearching value
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const isSearchingRef = useRef(false);

  // Check ban status on mount from real DB
  useEffect(() => {
    checkBanStatus();
  }, []);

  const checkBanStatus = async () => {
    try {
      const { ban, isBanned: banned } = await reportAPI.getBanStatus();
      setIsBanned(banned);
      setBanInfo(ban || null);
    } catch {
      // non-critical — if this fails, just allow the user to queue
    }
  };

  // Countdown timer for active ban display
  useEffect(() => {
    if (!isBanned || !banInfo) return;
    const timer = setInterval(() => {
      const remaining = new Date(banInfo.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setIsBanned(false);
        setBanInfo(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isBanned, banInfo]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const servers = [
    { value: "us-east",  label: "US East",       ping: "25ms",  players: "1,234" },
    { value: "eu-west",  label: "Europe",         ping: "45ms",  players: "2,156" },
    { value: "central",  label: "Central",        ping: "35ms",  players: "987"   },
    { value: "ap-south", label: "Asia Pacific",   ping: "78ms",  players: "1,543" },
  ];

  const mods = [
    {
      id: "classic-deathmatch",
      name: "Classic Deathmatch",
      description: "Traditional Half-Life 1 combat experience",
      players: "1v1",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "instagib-mode",
      name: "Instagib Mode",
      description: "One-shot elimination combat protocol",
      players: "1v1",
      icon: <Zap className="w-5 h-5" />,
    },
    {
      id: "tactical-ops",
      name: "Tactical Operations",
      description: "Strategic team-based objectives",
      players: "5v5",
      icon: <Globe className="w-5 h-5" />,
    },
  ];

  const maps = [
    "dm_crossfire", "dm_bounce",    "dm_undertow",     "dm_gasworks",
    "dm_boot_camp", "dm_datacore",  "dm_lockdown",     "dm_rapidcore",
    "dm_stalkyard", "dm_lambda_bunker", "dm_frenzy",   "dm_killbox",
    "dm_subtransit","dm_powerhouse","dm_rust",         "dm_snark_pit",
    "dm_stretch",   "dm_desert",    "dm_industrial",   "dm_fortress",
  ];

  const handleMapToggle = (mapName: string) => {
    setSelectedMaps(prev => {
      if (prev.includes(mapName)) return prev.filter(m => m !== mapName);
      if (prev.length < 5) return [...prev, mapName];
      return prev;
    });
  };

  const stopSearching = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    isSearchingRef.current = false;
    setIsSearching(false);
    try { await matchmakingAPI.leaveQueue(); } catch { /* best effort */ }
    toast.info("Search Cancelled", { description: "You have left the matchmaking queue" });
  };

  const handleMatchFound = (match: any) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    isSearchingRef.current = false;
    setIsSearching(false);
    toast.success("Match Found!", { description: "Proceeding to map banning phase..." });
    const modData = mods.find(m => m.id === selectedMod);
    onStartMatch?.(modData?.name || "Classic Deathmatch", match?.selected_map || selectedMaps[0]);
  };

  const handleFindMatch = async () => {
    if (!isReadyToSearch) return;

    setIsSearching(true);
    isSearchingRef.current = true;

    try {
      // FIX: check status === 'matched' not response.matchFound
      const response = await matchmakingAPI.joinQueue(selectedMod, selectedMaps);

      if (response.status === "matched") {
        handleMatchFound(response.match);
        return;
      }

      toast.info("Searching for opponent...", { description: "You've joined the matchmaking queue" });

      // FIX: poll uses /matchmaking/join but server handles ON CONFLICT DO UPDATE
      // so re-joining is safe and will match if opponent joins
      pollRef.current = setInterval(async () => {
        if (!isSearchingRef.current) return;
        try {
          const pollResponse = await matchmakingAPI.joinQueue(selectedMod, selectedMaps);
          if (pollResponse.status === "matched") {
            handleMatchFound(pollResponse.match);
          }
        } catch {
          // network hiccup — keep polling
        }
      }, 3000);

      // Auto-cancel after 5 minutes
      setTimeout(() => {
        if (isSearchingRef.current) {
          stopSearching();
          toast.info("Search timeout", { description: "No opponents found. Please try again." });
        }
      }, 300000);

    } catch (error: any) {
      isSearchingRef.current = false;
      setIsSearching(false);

      if (error.message?.includes("banned")) {
        // Server returned 403 with ban info — refresh ban state
        await checkBanStatus();
        toast.error("Matchmaking Suspended", { description: error.message });
      } else if (error.message?.includes("NO_GAME_OWNERSHIP")) {
        toast.error("Game Ownership Required", {
          description: "You must own Half-Life 1 on Steam. Please link your Steam account.",
        });
      } else if (error.message?.includes("VAC_BANNED")) {
        toast.error("Account Banned", {
          description: "Your Steam account has a VAC ban and cannot participate in matchmaking.",
        });
      } else {
        toast.error("Matchmaking Error", { description: error.message || "Failed to join queue" });
      }
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const timeLeft = new Date(expiresAt).getTime() - Date.now();
    if (timeLeft <= 0) return "0m 0s";
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const isReadyToSearch =
    selectedServer !== "" &&
    selectedMod !== "" &&
    selectedMaps.length === 5 &&
    !isSearching &&
    !isBanned;

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="mb-4 text-orange-400 font-mono tracking-wider">
            MATCHMAKING PROTOCOL
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            CONFIGURE MATCH PARAMETERS AND INITIATE COMPETITIVE SEQUENCE
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {isBanned && banInfo && (
            <Alert className="mb-6 bg-red-900/20 border-red-700/50 text-red-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                <strong>MATCHMAKING SUSPENDED</strong><br />
                Reason: {banInfo.reason}<br />
                Time Remaining: {formatTimeRemaining(banInfo.expires_at)}<br />
                Offense Level #{banInfo.ban_level}
              </AlertDescription>
            </Alert>
          )}

          <Card className="bg-black/80 border-orange-900/30 backdrop-blur-sm">
            <CardHeader className="text-center border-b border-orange-900/20">
              <CardTitle className="text-green-400 font-mono tracking-wide">
                SECTOR NINE MATCHMAKING
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-900/50 border border-orange-900/30">
                  <TabsTrigger
                    value="server-config"
                    className="font-mono data-[state=active]:bg-orange-600 data-[state=active]:text-black"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    SERVER
                  </TabsTrigger>
                  <TabsTrigger
                    value="mod-selection"
                    className="font-mono data-[state=active]:bg-orange-600 data-[state=active]:text-black"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    MODS
                  </TabsTrigger>
                  <TabsTrigger
                    value="map-selection"
                    className="font-mono data-[state=active]:bg-orange-600 data-[state=active]:text-black"
                  >
                    <Map className="w-4 h-4 mr-2" />
                    MAPS
                  </TabsTrigger>
                </TabsList>

                {/* ── SERVER ── */}
                <TabsContent value="server-config" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-orange-400 font-mono mb-2">SERVER REGION SELECTION</h3>
                    <p className="text-gray-400 font-mono text-sm">
                      Choose optimal server location for minimal latency
                    </p>
                    <p className="text-gray-500 font-mono text-xs mt-1">
                      (Server region preference — dedicated servers coming soon)
                    </p>
                  </div>

                  <div className="max-w-md mx-auto">
                    <Select value={selectedServer} onValueChange={setSelectedServer}>
                      <SelectTrigger className="w-full bg-gray-900/50 border-orange-900/30 font-mono">
                        <SelectValue placeholder="SELECT SERVER REGION" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-orange-900/30">
                        {servers.map(server => (
                          <SelectItem
                            key={server.value}
                            value={server.value}
                            className="font-mono hover:bg-orange-900/20 focus:bg-orange-900/20"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{server.label}</span>
                              <div className="flex gap-2 ml-4">
                                <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                                  {server.ping}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">
                                  {server.players}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedServer && (
                    <div className="text-center">
                      <Badge className="bg-green-900/30 text-green-400 border-green-400/30 font-mono">
                        SERVER REGION CONFIGURED
                      </Badge>
                    </div>
                  )}
                </TabsContent>

                {/* ── MODS ── */}
                <TabsContent value="mod-selection" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-orange-400 font-mono mb-2">COMBAT PROTOCOL SELECTION</h3>
                    <p className="text-gray-400 font-mono text-sm">Choose your preferred combat engagement type</p>
                  </div>

                  <div className="grid gap-4">
                    {mods.map(mod => (
                      <Card
                        key={mod.id}
                        className={`cursor-pointer transition-all border-2 ${
                          selectedMod === mod.id
                            ? "border-orange-500 bg-orange-900/20"
                            : "border-gray-700 bg-gray-900/30 hover:border-orange-900/50"
                        }`}
                        onClick={() => setSelectedMod(mod.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-orange-400">{mod.icon}</div>
                              <div>
                                <h4 className="font-mono text-orange-400">{mod.name}</h4>
                                <p className="text-sm text-gray-400 font-mono">{mod.description}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-green-400 border-green-400/30 font-mono">
                              {mod.players}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ── MAPS ── */}
                <TabsContent value="map-selection" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-orange-400 font-mono mb-2">MAP PRIORITY SELECTION</h3>
                    <p className="text-gray-400 font-mono text-sm">Select exactly 5 preferred combat environments</p>
                    <Badge variant="outline" className="mt-2 text-orange-400 border-orange-400/30 font-mono">
                      {selectedMaps.length}/5 MAPS SELECTED
                    </Badge>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {maps.map(map => (
                        <div
                          key={map}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedMaps.includes(map)
                              ? "border-orange-500 bg-orange-900/20"
                              : "border-gray-700 bg-gray-900/30 hover:border-orange-900/50"
                          }`}
                          onClick={() => handleMapToggle(map)}
                        >
                          <Checkbox
                            checked={selectedMaps.includes(map)}
                            onCheckedChange={() => handleMapToggle(map)}
                            disabled={!selectedMaps.includes(map) && selectedMaps.length >= 5}
                            className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                          />
                          <div className="flex-1">
                            <span className="font-mono text-sm text-gray-300">{map.toUpperCase()}</span>
                            {selectedMaps.includes(map) && (
                              <div className="flex items-center gap-1 mt-1">
                                <CheckCircle className="w-3 h-3 text-green-400" />
                                <span className="text-xs text-green-400 font-mono">
                                  PRIORITY #{selectedMaps.indexOf(map) + 1}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedMaps.length > 0 && (
                    <div className="text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        {selectedMaps.map((map, i) => (
                          <Badge key={map} className="bg-green-900/30 text-green-400 border-green-400/30 font-mono">
                            #{i + 1}: {map.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* ── STATUS + BUTTON ── */}
              <div className="mt-12 text-center">
                <div className="mb-6">
                  <div className="flex justify-center gap-4 mb-4 flex-wrap">
                    <Badge
                      variant={selectedServer ? "default" : "secondary"}
                      className={`font-mono ${selectedServer ? "bg-green-900/30 text-green-400 border-green-400/30" : ""}`}
                    >
                      SERVER: {selectedServer ? selectedServer.toUpperCase() : "NOT SET"}
                    </Badge>
                    <Badge
                      variant={selectedMod ? "default" : "secondary"}
                      className={`font-mono ${selectedMod ? "bg-green-900/30 text-green-400 border-green-400/30" : ""}`}
                    >
                      MODE: {selectedMod ? mods.find(m => m.id === selectedMod)?.name.toUpperCase() : "NOT SET"}
                    </Badge>
                    <Badge
                      variant={selectedMaps.length === 5 ? "default" : "secondary"}
                      className={`font-mono ${selectedMaps.length === 5 ? "bg-green-900/30 text-green-400 border-green-400/30" : ""}`}
                    >
                      MAPS: {selectedMaps.length > 0 ? `${selectedMaps.length}/5 SELECTED` : "NOT SET"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <Button
                    onClick={isSearching ? stopSearching : handleFindMatch}
                    disabled={!isSearching && !isReadyToSearch}
                    className={`px-8 py-6 font-mono tracking-wider text-lg transition-all ${
                      isSearching
                        ? "bg-red-600 hover:bg-red-700 text-white border-2 border-red-500"
                        : isReadyToSearch
                        ? "bg-orange-600 hover:bg-orange-700 text-black border-2 border-orange-500"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {isSearching ? (
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 animate-spin" />
                        CANCEL SEARCH
                      </div>
                    ) : isBanned ? (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        MATCHMAKING SUSPENDED
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        FIND MATCH
                      </div>
                    )}
                  </Button>
                </div>

                {!isReadyToSearch && !isSearching && !isBanned && (
                  <p className="text-red-400 font-mono text-sm mt-4">
                    CONFIGURE SERVER, MODE & SELECT EXACTLY 5 MAPS TO PROCEED
                  </p>
                )}

                {isBanned && (
                  <p className="text-red-400 font-mono text-sm mt-4">
                    MATCHMAKING DISABLED DUE TO ACTIVE PENALTY
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
