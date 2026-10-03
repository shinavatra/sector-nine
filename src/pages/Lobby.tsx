import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Globe, Zap, Map as MapIcon, Users, CheckCircle, AlertTriangle } from "lucide-react";
import { matchmakingAPI, reportAPI } from "../utils/api";
import { toast } from "sonner";
import { GameQueue, type MatchmakingSnapshot } from "../components/GameQueue";
import { useGame } from "../contexts/GameContext";
import { SUPPORTED_REGIONS, isSupportedRegionId, type SupportedRegionId } from "../shared/regions";
import type { ReactNode } from "react";

interface LobbyProps {
  onNavigate: (page: string) => void;
  onStartMatch?: (matchType: string, mapName: string) => void;
  isPremium?: boolean;
  maintenanceMode?: boolean;
}

export function Lobby({ onNavigate, onStartMatch, maintenanceMode = false }: LobbyProps) {
  const {selectedGame}=useGame();
  const [activeTab, setActiveTab] = useState("server-config");
  const [selectedServer, setSelectedServer] = useState<SupportedRegionId>(SUPPORTED_REGIONS[0].id);
  const [selectedMod, setSelectedMod] = useState<string>("classic-deathmatch");
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [servers,setServers]=useState<Array<{value:SupportedRegionId;label:string;available:number;total:number}>>([]);
  const [queue, setQueue] = useState<MatchmakingSnapshot>({ state: "idle" });
  const [queueBusy, setQueueBusy] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [gameModes,setGameModes]=useState<string[]>([]);
  const [mapOptions,setMapOptions]=useState<string[]>([]);
  const [mapPools,setMapPools]=useState<Record<string,string[]>>({});
  const [requiredMapCount,setRequiredMapCount]=useState(5);
  const [matchmakingEnabled,setMatchmakingEnabled]=useState(false);
  const [optionsError,setOptionsError]=useState('');


  // Check ban status on mount from real DB
  useEffect(() => {
    checkBanStatus();
  }, []);

  useEffect(()=>{
    let active=true;
    setSelectedMaps([]);
    setGameModes([]);
    setMapOptions([]);
    setMatchmakingEnabled(false);
    setOptionsError('');
    matchmakingAPI.getOptions(selectedGame.id).then(data=>{
      if(!active)return;
      const liveRegions=new Map<string,{available:number;total:number}>(
        (Array.isArray(data?.regions)?data.regions:[]).map((region:any)=>[
          String(region.region),
          {available:Number(region.available_servers)||0,total:Number(region.total_servers)||0},
        ]),
      );
      setServers(SUPPORTED_REGIONS.map(region=>({
        value:region.id,
        label:region.label,
        available:liveRegions.get(region.id)?.available||0,
        total:liveRegions.get(region.id)?.total||0,
      })));
      const modes=Array.isArray(data?.modes)?data.modes:[];
      setGameModes(modes);
      setSelectedMod(modes[0]||'');
      setRequiredMapCount(Number(data?.requiredMapCount)||5);
      const pools=Object.fromEntries((Array.isArray(data?.mapPools)?data.mapPools:[]).map((pool:any)=>[String(pool.game_mode),Array.isArray(pool.maps)?pool.maps:[]]));
      setMapPools(pools);
      setMapOptions(pools[modes[0]]||[]);
      setMatchmakingEnabled(Boolean(data?.enabled));
      if(data?.enabled&&(!modes.length||!(pools[modes[0]]||[]).length))setOptionsError(`${data?.game?.name||selectedGame.name} is enabled but its PostgreSQL modes or map pool are missing`);
    }).catch((error:unknown)=>{if(active)setOptionsError(error instanceof Error?error.message:'Unable to load matchmaking options')});
    return()=>{active=false};
  },[selectedGame.id]);

  useEffect(()=>{setSelectedMaps([]);setMapOptions(mapPools[selectedMod]||[])},[mapPools,selectedMod]);

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
    if (!banInfo.expires_at) return;
    const timer = setInterval(() => {
      const remaining = new Date(banInfo.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setIsBanned(false);
        setBanInfo(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isBanned, banInfo]);

  useEffect(() => {
    let active=true;
    const synchronize=async()=>{
      try{
        const state=await matchmakingAPI.sync();
        if(active)setQueue(state);
      }catch{/* Preserve the last confirmed backend state during transient failures. */}
    };
    matchmakingAPI.getStatus().then(state=>active&&setQueue(state)).catch(()=>{});
    const poll=window.setInterval(synchronize,3000);
    return()=>{active=false;window.clearInterval(poll)};
  },[]);

  useEffect(() => {
    if (queue.state === "map_selecting" && queue.mapSelection?.viewerMaps?.length) {
      setSelectedMaps(queue.mapSelection.viewerMaps);
    }
  }, [queue.state, queue.mapSelection?.viewerMaps]);

  const modDefinitions:Record<string,{name:string;description:string;players:string;icon:ReactNode}> = {
    "classic-deathmatch": {
      name: "Classic Deathmatch",
      description: "Traditional Half-Life 1 combat experience",
      players: "1v1",
      icon: <Users className="w-5 h-5" />,
    },
    "instagib-mode": {
      name: "Instagib Mode",
      description: "One-shot elimination combat protocol",
      players: "1v1",
      icon: <Zap className="w-5 h-5" />,
    },
    "competitive-1v1": {name:"Competitive 1v1",description:"Counter-Strike 1.6 competitive duel",players:"1v1",icon:<Users className="w-5 h-5"/>},
    "survival-duel": {name:"Survival Duel",description:"Left 4 Dead 2 survival competition",players:"1v1",icon:<Users className="w-5 h-5"/>},
    "promod-1v1": {name:"Promod 1v1",description:"Call of Duty 4 Promod duel",players:"1v1",icon:<Users className="w-5 h-5"/>},
  };

  const mods = gameModes.map(id=>({id,...(modDefinitions[id]||{name:id.split('-').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' '),description:`${selectedGame.name} matchmaking mode`,players:'1v1',icon:<Zap className="w-5 h-5"/>})}));
  const maps = mapOptions;

  const handleMapToggle = (mapName: string) => {
    if (queue.mapSelection?.viewerConfirmed) return;
    setSelectedMaps(prev => {
      if (queue.mapSelection?.unavailableMaps?.includes(mapName) && !prev.includes(mapName)) return prev;
      if (prev.includes(mapName)) return prev.filter(m => m !== mapName);
      if (prev.length < requiredMapCount) return [...prev, mapName];
      return prev;
    });
  };

  const stopSearching = async () => {
    setQueueBusy(true);
    try{setQueue(await matchmakingAPI.leaveQueue());toast.info("Search Cancelled",{description:"The PostgreSQL queue entry was removed"})}
    catch(error:any){toast.error("Unable to leave queue",{description:error.message})}
    finally{setQueueBusy(false)}
  };

  const handleFindMatch = async () => {
    if (maintenanceMode) {
      toast.error("Matchmaking unavailable", { description: "Matchmaking is unavailable during platform maintenance." });
      return;
    }
    if (!isReadyToSearch) return;

    setQueueBusy(true);
    try {
      const response=await matchmakingAPI.joinQueue(selectedGame.id,selectedMod,selectedMaps,selectedServer);
      setQueue(response);
      toast.info(response.state==="searching"?"Searching for opponent...":"Match found",{description:"Matchmaking state was saved by the backend"});
    } catch (error: any) {
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
    }finally{setQueueBusy(false)}
  };

  const acceptMatch=async()=>{
    setQueueBusy(true);
    try{setQueue(await matchmakingAPI.accept());toast.success("Acceptance recorded")}
    catch(error:any){toast.error("Unable to accept match",{description:error.message})}
    finally{setQueueBusy(false)}
  };

  const declineMatch=async()=>{
    setQueueBusy(true);
    try{setQueue(await matchmakingAPI.decline());toast.info("Match declined")}
    catch(error:any){toast.error("Unable to decline match",{description:error.message})}
    finally{setQueueBusy(false)}
  };

  const submitMatchMaps=async()=>{
    setQueueBusy(true);
    try{setQueue(await matchmakingAPI.submitMaps(selectedMaps));toast.success("Five maps confirmed")}
    catch(error:any){toast.error("Unable to confirm maps",{description:error.message})}
    finally{setQueueBusy(false)}
  };

  const banMatchMap=async(mapId:string)=>{
    setQueueBusy(true);
    try{setQueue(await matchmakingAPI.banMap(mapId));toast.info(`${mapId.toUpperCase()} banned`)}
    catch(error:any){toast.error("Unable to ban map",{description:error.message})}
    finally{setQueueBusy(false)}
  };

  const formatTimeRemaining = (expiresAt: string) => {
    if (!expiresAt) return "Permanent";
    const timeLeft = new Date(expiresAt).getTime() - Date.now();
    if (timeLeft <= 0) return "0m 0s";
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const isReadyToSearch =
    selectedMod !== "" &&
    selectedMaps.length === requiredMapCount &&
    queue.state === "idle" &&
    !isBanned &&
    !maintenanceMode &&
    matchmakingEnabled;

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
          {optionsError && (
            <Alert className="mb-6 border-red-700/50 bg-red-950/70 text-red-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-mono">MATCHMAKING DATA FAILED TO LOAD: {optionsError}</AlertDescription>
            </Alert>
          )}
          {!optionsError&&!matchmakingEnabled && (
            <Alert className="mb-6 border-amber-700/50 bg-amber-950/70 text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-mono">
                {selectedGame.name.toUpperCase()} MATCHMAKING IS NOT ENABLED. ENABLE IT IN ADMIN SYSTEM.
              </AlertDescription>
            </Alert>
          )}
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
                    <MapIcon className="w-4 h-4 mr-2" />
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
                      Regions are loaded from active PostgreSQL server records
                    </p>
                  </div>

                  <div className="max-w-md mx-auto">
                    <Select value={selectedServer} onValueChange={value=>isSupportedRegionId(value)&&setSelectedServer(value)}>
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
                                  {server.available}/{server.total} AVAILABLE
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
                      {selectedMaps.length}/{requiredMapCount} MAPS SELECTED
                    </Badge>
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {maps.map(map => {
                        const unavailable=Boolean(queue.mapSelection?.unavailableMaps?.includes(map));
                        const selectionLocked=Boolean(queue.mapSelection?.viewerConfirmed);
                        return (
                        <div
                          key={map}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${selectionLocked||(unavailable&&!selectedMaps.includes(map))?'cursor-not-allowed opacity-45':'cursor-pointer'} ${
                            selectedMaps.includes(map)
                              ? "border-orange-500 bg-orange-900/20"
                              : "border-gray-700 bg-gray-900/30 hover:border-orange-900/50"
                          }`}
                          onClick={() => handleMapToggle(map)}
                        >
                          <Checkbox
                            checked={selectedMaps.includes(map)}
                            disabled={selectionLocked||(unavailable&&!selectedMaps.includes(map))||(!selectedMaps.includes(map) && selectedMaps.length >= requiredMapCount)}
                            className="pointer-events-none data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
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
                      )})}
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
                      variant={selectedMaps.length === requiredMapCount ? "default" : "secondary"}
                      className={`font-mono ${selectedMaps.length === requiredMapCount ? "bg-green-900/30 text-green-400 border-green-400/30" : ""}`}
                    >
                      MAPS: {selectedMaps.length > 0 ? `${selectedMaps.length}/${requiredMapCount} SELECTED` : "NOT SET"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <GameQueue snapshot={queue} busy={queueBusy} disabled={!isReadyToSearch} selectedGame={selectedGame.name} connectedRegion={SUPPORTED_REGIONS.find(region=>region.id===selectedServer)?.label||selectedServer} selectedMaps={selectedMaps} onStart={handleFindMatch} onCancel={stopSearching} onAccept={acceptMatch} onDecline={declineMatch} onSubmitMaps={submitMatchMaps} onBanMap={banMatchMap}/>
                </div>

                {!isReadyToSearch && queue.state === "idle" && !isBanned && (
                  <p className="text-red-400 font-mono text-sm mt-4">
                    CONFIGURE SERVER, MODE & SELECT EXACTLY 5 MAPS TO PROCEED
                  </p>
                )}

                {isBanned && (
                  <p className="text-red-400 font-mono text-sm mt-4">
                    MATCHMAKING DISABLED DUE TO ACTIVE PENALTY
                  </p>
                )}
                {maintenanceMode && (
                  <p className="text-amber-300 font-mono text-sm mt-4">
                    MATCHMAKING IS UNAVAILABLE DURING PLATFORM MAINTENANCE
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
