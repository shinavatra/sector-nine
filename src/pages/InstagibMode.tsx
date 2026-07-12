import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Zap, Check, Users, Clock, Map, Trophy } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const instagibMaps = [
  { id: "ig_crossfire", name: "ig_crossfire", description: "Classic arena adapted for instagib", difficulty: "Easy", size: "Medium" },
  { id: "ig_bounce", name: "ig_bounce", description: "Low-gravity railgun combat", difficulty: "Hard", size: "Small" },
  { id: "ig_arena", name: "ig_arena", description: "Pure instagib combat arena", difficulty: "Medium", size: "Small" },
  { id: "ig_facility", name: "ig_facility", description: "Research facility corridors", difficulty: "Hard", size: "Medium" },
  { id: "ig_platform", name: "ig_platform", description: "Multi-level platform combat", difficulty: "Medium", size: "Large" },
  { id: "ig_core", name: "ig_core", description: "Reactor core complex", difficulty: "Hard", size: "Medium" },
  { id: "ig_sniper", name: "ig_sniper", description: "Long-range combat zones", difficulty: "Hard", size: "Large" },
  { id: "ig_compact", name: "ig_compact", description: "Close-quarters instagib", difficulty: "Medium", size: "Small" },
  { id: "ig_vertigo", name: "ig_vertigo", description: "High-altitude platform", difficulty: "Hard", size: "Medium" },
  { id: "ig_maze", name: "ig_maze", description: "Labyrinth combat arena", difficulty: "Medium", size: "Medium" },
  { id: "ig_tower", name: "ig_tower", description: "Vertical tower combat", difficulty: "Hard", size: "Large" },
  { id: "ig_pit", name: "ig_pit", description: "Gladiator pit arena", difficulty: "Easy", size: "Small" },
  { id: "ig_space", name: "ig_space", description: "Zero-gravity combat", difficulty: "Hard", size: "Large" },
  { id: "ig_chaos", name: "ig_chaos", description: "Chaotic multi-level arena", difficulty: "Medium", size: "Medium" },
  { id: "ig_simple", name: "ig_simple", description: "Minimalist combat zone", difficulty: "Easy", size: "Small" },
  { id: "ig_complex", name: "ig_complex", description: "Multi-room facility", difficulty: "Hard", size: "Large" },
  { id: "ig_bridge", name: "ig_bridge", description: "Suspended bridge combat", difficulty: "Medium", size: "Medium" },
  { id: "ig_bunker", name: "ig_bunker", description: "Underground bunker", difficulty: "Medium", size: "Small" },
  { id: "ig_cathedral", name: "ig_cathedral", description: "Gothic architecture arena", difficulty: "Easy", size: "Large" },
  { id: "ig_death", name: "ig_death", description: "Ultimate instagib challenge", difficulty: "Hard", size: "Medium" }
];

interface InstagibModeProps {
  onNavigate?: (page: string) => void;
}

export function InstagibMode({ onNavigate }: InstagibModeProps) {
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

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
            <h1 className="text-4xl font-bold text-purple-400 font-mono flex items-center">
              <Zap className="w-8 h-8 mr-3" />
              INSTAGIB MODE
            </h1>
            <p className="text-gray-400 font-mono mt-2">Select 5 maps for your railgun-only combat pool</p>
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
          <Card className="bg-black/40 border-purple-900/20 mb-6">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">INSTAGIB SETTINGS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Frag Limit</label>
                  <Select defaultValue="20">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="15" className="text-orange-400 font-mono">15 Frags</SelectItem>
                      <SelectItem value="20" className="text-orange-400 font-mono">20 Frags</SelectItem>
                      <SelectItem value="25" className="text-orange-400 font-mono">25 Frags</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Time Limit</label>
                  <Select defaultValue="15">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="10" className="text-orange-400 font-mono">10 Minutes</SelectItem>
                      <SelectItem value="15" className="text-orange-400 font-mono">15 Minutes</SelectItem>
                      <SelectItem value="20" className="text-orange-400 font-mono">20 Minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-mono">Respawn Delay</label>
                  <Select defaultValue="1">
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-orange-900/20">
                      <SelectItem value="1" className="text-orange-400 font-mono">1 Second</SelectItem>
                      <SelectItem value="2" className="text-orange-400 font-mono">2 Seconds</SelectItem>
                      <SelectItem value="3" className="text-orange-400 font-mono">3 Seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-purple-900/20">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">INSTAGIB MAP POOL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {instagibMaps.map((map) => (
                  <div
                    key={map.id}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedMaps.includes(map.id)
                        ? 'border-purple-400 bg-purple-900/20'
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
                        <Check className="w-5 h-5 text-purple-400" />
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
          {/* Ready Status */}
          <Card className="bg-black/40 border-purple-900/20">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">READY STATUS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div className="text-purple-400 font-mono mb-2">INSTAGIB MODE</div>
                <div className="text-gray-400 font-mono text-sm mb-4">
                  Select exactly 5 maps to proceed to map banning phase
                </div>
                
                <Button
                  className={`w-full font-mono ${
                    selectedMaps.length === 5
                      ? 'bg-purple-900/20 border-purple-900/30 text-purple-400 hover:bg-purple-900/30'
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
          <Card className="bg-black/40 border-purple-900/20">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">SELECTED MAPS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedMaps.length === 0 ? (
                  <div className="text-gray-500 font-mono text-sm text-center py-4">
                    No maps selected
                  </div>
                ) : (
                  selectedMaps.map((mapId, index) => {
                    const map = instagibMaps.find(m => m.id === mapId);
                    return (
                      <div key={mapId} className="flex items-center justify-between p-2 bg-black/20 rounded border border-purple-900/30">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 flex items-center justify-center bg-purple-900/20 rounded text-purple-400 font-mono text-xs">
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
          <Card className="bg-black/40 border-purple-900/20">
            <CardHeader>
              <CardTitle className="text-purple-400 font-mono">MODE DETAILS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Mode:</span>
                <span className="text-purple-400">Instagib</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Players:</span>
                <span className="text-orange-400">1v1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Weapons:</span>
                <span className="text-orange-400">Railgun Only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Damage:</span>
                <span className="text-orange-400">One-Shot Kill</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Armor:</span>
                <span className="text-gray-400">Disabled</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}