import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Target, Check, Users, Clock, Map, Trophy, UserX, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { reportAPI } from "../utils/api";
import { toast } from "sonner";

const classicMaps = [
  { id: "crossfire", name: "dm_crossfire", description: "Classic industrial setting", difficulty: "Easy", size: "Medium" },
  { id: "bounce", name: "dm_bounce", description: "Low-gravity combat arena", difficulty: "Medium", size: "Small" },
  { id: "undertow", name: "dm_undertow", description: "Underwater facility", difficulty: "Hard", size: "Large" },
  { id: "gasworks", name: "dm_gasworks", description: "Industrial gas facility", difficulty: "Medium", size: "Medium" },
  { id: "stalkyard", name: "dm_stalkyard", description: "Abandoned factory complex", difficulty: "Medium", size: "Large" },
  { id: "rapidcore", name: "dm_rapidcore", description: "High-tech research facility", difficulty: "Hard", size: "Medium" },
  { id: "subtransit", name: "dm_subtransit", description: "Underground transit system", difficulty: "Easy", size: "Small" },
  { id: "datacore", name: "dm_datacore", description: "Computer server complex", difficulty: "Hard", size: "Medium" },
  { id: "lambda_bunker", name: "dm_lambda_bunker", description: "Lambda team bunker", difficulty: "Medium", size: "Large" },
  { id: "snarkpit", name: "dm_snarkpit", description: "Alien creature testing", difficulty: "Hard", size: "Small" },
  { id: "boot_camp", name: "dm_boot_camp", description: "Military training facility", difficulty: "Easy", size: "Medium" },
  { id: "killbox", name: "dm_killbox", description: "Compact combat arena", difficulty: "Medium", size: "Small" },
  { id: "powerhouse", name: "dm_powerhouse", description: "Power generation facility", difficulty: "Hard", size: "Large" },
  { id: "rats", name: "dm_rats", description: "Miniaturized kitchen warfare", difficulty: "Easy", size: "Medium" },
  { id: "frenzy", name: "dm_frenzy", description: "Fast-paced arena combat", difficulty: "Medium", size: "Small" },
  { id: "facility", name: "dm_facility", description: "Research facility complex", difficulty: "Hard", size: "Large" },
  { id: "surface", name: "dm_surface", description: "Black Mesa surface area", difficulty: "Medium", size: "Large" },
  { id: "complex", name: "dm_complex", description: "Multi-level complex", difficulty: "Hard", size: "Medium" },
  { id: "lockdown", name: "dm_lockdown", description: "Security lockdown scenario", difficulty: "Medium", size: "Medium" },
  { id: "hazard", name: "dm_hazard", description: "Hazardous materials lab", difficulty: "Hard", size: "Small" }
];

interface ClassicDeathmatchProps {
  onNavigate?: (page: string) => void;
}

export function ClassicDeathmatch({ onNavigate }: ClassicDeathmatchProps) {
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [inMatch, setInMatch] = useState(false);
  const [matchPlayers] = useState([
    { id: "1", name: "Gordon_Freeman", status: "connected" },
    { id: "2", name: "Opponent_Player", status: "connected" }
  ]);

  // Simulate match start after map selection
  useEffect(() => {
    if (selectedMaps.length === 5) {
      const timer = setTimeout(() => {
        setInMatch(true);
        toast.success("Match started!", {
          description: "You are now in a Classic Deathmatch",
          className: "bg-green-900/90 border-green-700 text-green-100"
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedMaps]);

  // Player leaves/goes AFK and gets banned via the real ban system
  const simulatePlayerLeave = async (playerId: string, playerName: string, reason: string) => {
    try {
      await reportAPI.issueBan(reason, playerId);
    } catch (err) {
      console.error('Failed to issue ban:', err);
    }
    toast.error(`Player penalized: ${playerName}`, {
      description: `Reason: ${reason}`,
      className: "bg-red-900/90 border-red-700 text-red-100"
    });
  };

  const handleMapToggle = (mapId: string) => {
    if (selectedMaps.includes(mapId)) {
      setSelectedMaps(selectedMaps.filter(id => id !== mapId));
    } else if (selectedMaps.length < 5) {
      setSelectedMaps([...selectedMaps, mapId]);
    }
  };

  const handleReady = () => {
    if (selectedMaps.length === 5) {
      // Navigate to map banning with selected maps
      onNavigate?.('map-banning');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-900/20 text-green-400 border-green-900/30';
      case 'Medium': return 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30';
      case 'Hard': return 'bg-red-900/20 text-red-400 border-red-900/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    }
  };

  const getSizeColor = (size: string) => {
    switch (size) {
      case 'Small': return 'bg-blue-900/20 text-blue-400 border-blue-900/30';
      case 'Medium': return 'bg-purple-900/20 text-purple-400 border-purple-900/30';
      case 'Large': return 'bg-orange-900/20 text-orange-400 border-orange-900/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          onClick={() => onNavigate?.('lobby')}
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO LOBBY
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-green-400 font-mono flex items-center">
              <Target className="w-8 h-8 mr-3" />
              CLASSIC DEATHMATCH
            </h1>
            <p className="text-gray-400 font-mono mt-2">Select 5 maps for your map pool</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-400 font-mono">{selectedMaps.length}/5</div>
            <div className="text-sm text-gray-400 font-mono">Maps Selected</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Map Selection */}
        <div className="lg:col-span-3">
          <Card className="bg-black/40 border-green-900/20 mb-6">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">GAME MODE SETTINGS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Frag Limit</label>
                  <Select defaultValue="30">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="20" className="text-orange-400 font-mono">20 Frags</SelectItem>
                      <SelectItem value="30" className="text-orange-400 font-mono">30 Frags</SelectItem>
                      <SelectItem value="50" className="text-orange-400 font-mono">50 Frags</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Time Limit</label>
                  <Select defaultValue="20">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="15" className="text-orange-400 font-mono">15 Minutes</SelectItem>
                      <SelectItem value="20" className="text-orange-400 font-mono">20 Minutes</SelectItem>
                      <SelectItem value="25" className="text-orange-400 font-mono">25 Minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Respawn Delay</label>
                  <Select defaultValue="3">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="1" className="text-orange-400 font-mono">1 Second</SelectItem>
                      <SelectItem value="3" className="text-orange-400 font-mono">3 Seconds</SelectItem>
                      <SelectItem value="5" className="text-orange-400 font-mono">5 Seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-green-900/20">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">MAP SELECTION POOL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {classicMaps.map((map) => (
                  <div
                    key={map.id}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedMaps.includes(map.id)
                        ? 'border-green-400 bg-green-900/20'
                        : 'border-orange-900/20 bg-black/20 hover:border-orange-400'
                    } ${selectedMaps.length >= 5 && !selectedMaps.includes(map.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleMapToggle(map.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedMaps.includes(map.id)}
                          disabled={selectedMaps.length >= 5 && !selectedMaps.includes(map.id)}
                          className="border-orange-900/30"
                        />
                        <Map className="w-4 h-4 text-orange-400" />
                      </div>
                      {selectedMaps.includes(map.id) && (
                        <Check className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-orange-400 font-mono font-semibold">{map.name}</h3>
                      <p className="text-gray-300 font-mono text-xs">{map.description}</p>
                      
                      <div className="flex flex-wrap gap-1">
                        <Badge className={`font-mono text-xs ${getDifficultyColor(map.difficulty)}`}>
                          {map.difficulty}
                        </Badge>
                        <Badge className={`font-mono text-xs ${getSizeColor(map.size)}`}>
                          {map.size}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Match Status (only show when in match) */}
          {inMatch && (
            <Card className="bg-black/40 border-red-900/20">
              <CardHeader>
                <CardTitle className="text-red-400 font-mono flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  MATCH PLAYERS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matchPlayers.map((player) => (
                  <div key={player.id} className={`flex items-center justify-between p-2 rounded border ${
                    player.status === 'connected' ? 'bg-green-900/20 border-green-700/50' :
                    player.status === 'afk' ? 'bg-yellow-900/20 border-yellow-700/50' :
                    'bg-red-900/20 border-red-700/50'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        player.status === 'connected' ? 'bg-green-400' :
                        player.status === 'afk' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                      <span className="text-orange-400 font-mono text-sm">{player.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={`text-xs font-mono ${
                        player.status === 'connected' ? 'bg-green-900/20 text-green-400' :
                        player.status === 'afk' ? 'bg-yellow-900/20 text-yellow-400' :
                        'bg-red-900/20 text-red-400'
                      }`}>
                        {player.status.toUpperCase()}
                      </Badge>
                      {(player.status === 'disconnected' || player.status === 'afk') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => simulatePlayerLeave(player.id, player.name, 
                            player.status === 'afk' ? 'AFK/Non-participation' : 'Match abandonment')}
                          className="border-red-700/50 text-red-400 hover:bg-red-900/20 font-mono text-xs"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          BAN
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-4 p-3 bg-orange-900/20 border border-orange-700/50 rounded">
                  <p className="text-orange-400 font-mono text-xs">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Players who leave or go AFK receive escalating penalties
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Ready Status */}
          <Card className="bg-black/40 border-green-900/20">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">READY STATUS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div className="text-green-400 font-mono mb-2">CLASSIC DEATHMATCH</div>
                <div className="text-gray-400 font-mono text-sm mb-4">
                  Select exactly 5 maps to proceed to map banning phase
                </div>
                
                <Button
                  className={`w-full font-mono ${
                    selectedMaps.length === 5
                      ? 'bg-green-900/20 border-green-900/30 text-green-400 hover:bg-green-900/30'
                      : 'bg-gray-900/20 border-gray-900/30 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={selectedMaps.length !== 5}
                  onClick={handleReady}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {selectedMaps.length === 5 ? 'PROCEED TO MAP BANNING' : 'SELECT 5 MAPS'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Selected Maps */}
          <Card className="bg-black/40 border-green-900/20">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">SELECTED MAPS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedMaps.length === 0 ? (
                  <div className="text-gray-500 font-mono text-sm text-center py-4">
                    No maps selected
                  </div>
                ) : (
                  selectedMaps.map((mapId, index) => {
                    const map = classicMaps.find(m => m.id === mapId);
                    return (
                      <div key={mapId} className="flex items-center justify-between p-2 bg-black/20 rounded border border-green-900/30">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 flex items-center justify-center bg-green-900/20 rounded text-green-400 font-mono text-xs">
                            {index + 1}
                          </div>
                          <span className="text-orange-400 font-mono text-sm">{map?.name}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mode Info */}
          <Card className="bg-black/40 border-green-900/20">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">MODE DETAILS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Mode:</span>
                <span className="text-green-400">Classic Deathmatch</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Players:</span>
                <span className="text-orange-400">1v1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Weapons:</span>
                <span className="text-orange-400">All Available</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Armor:</span>
                <span className="text-orange-400">Enabled</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Power-ups:</span>
                <span className="text-orange-400">Enabled</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}