import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { CheckCircle, Clock, User, Map, ArrowLeft, Users, Shield } from "lucide-react";
import { useState, useEffect } from "react";

const halfLifeMaps = [
  // Classic Deathmatch Maps
  { id: 'dm_crossfire', name: 'Crossfire', image: '🎯', description: 'Classic industrial combat', mode: 'dm' },
  { id: 'dm_bounce', name: 'Bounce', image: '🏭', description: 'Multi-level facility', mode: 'dm' },
  { id: 'dm_undertow', name: 'Undertow', image: '🌊', description: 'Underwater research station', mode: 'dm' },
  { id: 'dm_stalkyard', name: 'Stalkyard', image: '🏗️', description: 'Industrial yard combat', mode: 'dm' },
  { id: 'dm_lockdown', name: 'Lockdown', image: '🔒', description: 'Security facility', mode: 'dm' },
  { id: 'dm_datacore', name: 'Datacore', image: '💾', description: 'Server room battleground', mode: 'dm' },
  { id: 'dm_gasworks', name: 'Gasworks', image: '⚡', description: 'Chemical processing plant', mode: 'dm' },
  { id: 'dm_lambda_bunker', name: 'Lambda Bunker', image: 'λ', description: 'Underground bunker', mode: 'dm' },
  { id: 'dm_rapidcore', name: 'Rapidcore', image: '⚡', description: 'High-energy reactor', mode: 'dm' },
  { id: 'dm_subtransit', name: 'Subtransit', image: '🚇', description: 'Subway transit system', mode: 'dm' },
  
  // Instagib Maps
  { id: 'dm_killbox', name: 'Killbox', image: '💀', description: 'Close quarters elimination', mode: 'instagib' },
  { id: 'dm_bloodworks', name: 'Bloodworks', image: '🩸', description: 'Brutal combat arena', mode: 'instagib' },
  { id: 'dm_snark_pit', name: 'Snark Pit', image: '🕳️', description: 'Dangerous creatures lurk', mode: 'instagib' },
  { id: 'dm_frenzy', name: 'Frenzy', image: '🌪️', description: 'Chaotic battle zone', mode: 'instagib' },
  { id: 'dm_chaos_theory', name: 'Chaos Theory', image: '🔬', description: 'Experimental facility', mode: 'instagib' },
  { id: 'dm_power_surge', name: 'Power Surge', image: '⚡', description: 'Electrical hazards', mode: 'instagib' },
  { id: 'dm_razor_edge', name: 'Razor Edge', image: '🗡️', description: 'Precision combat', mode: 'instagib' },
  { id: 'dm_vortex', name: 'Vortex', image: '🌀', description: 'Swirling battlefield', mode: 'instagib' },
  { id: 'dm_elimination', name: 'Elimination', image: '🎯', description: 'Last man standing', mode: 'instagib' },
  { id: 'dm_lightning', name: 'Lightning', image: '⚡', description: 'Fast-paced arena', mode: 'instagib' }
];

interface MapSelectionProps {
  onNavigate?: (page: string) => void;
  onComplete?: (selectedMaps: string[]) => void;
  playerId?: string;
  opponentId?: string;
}

export function MapSelection({ 
  onNavigate,
  onComplete = () => {}, 
  playerId = 'Freeman_G', 
  opponentId = 'Gordon_F' 
}: MapSelectionProps) {
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [opponentMaps, setOpponentMaps] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [phase, setPhase] = useState<'selection' | 'ready' | 'complete'>('selection');

  useEffect(() => {
    // Simulate opponent map selection progress
    if (phase === 'selection') {
      const interval = setInterval(() => {
        if (opponentMaps.length < 5 && Math.random() > 0.7) {
          const availableMaps = halfLifeMaps
            .filter(map => !opponentMaps.includes(map.id))
            .map(map => map.id);
          if (availableMaps.length > 0) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            setOpponentMaps(prev => [...prev, randomMap]);
          }
        }
        if (opponentMaps.length === 5 && !opponentReady && Math.random() > 0.6) {
          setOpponentReady(true);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [phase, opponentMaps.length, opponentReady]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-submit with random maps if time runs out
          if (phase === 'selection' && selectedMaps.length < 5) {
            const remainingMaps = halfLifeMaps
              .filter(map => !selectedMaps.includes(map.id))
              .slice(0, 5 - selectedMaps.length)
              .map(map => map.id);
            setSelectedMaps(prev => [...prev, ...remainingMaps]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedMaps, phase]);

  useEffect(() => {
    // Check if both players are ready to proceed
    if (playerReady && opponentReady && phase === 'ready') {
      setPhase('complete');
      setTimeout(() => {
        onComplete([...selectedMaps, ...opponentMaps]);
        // Navigate to map banning with combined maps
        onNavigate?.('map-banning');
      }, 2000);
    }
  }, [playerReady, opponentReady, phase, selectedMaps, opponentMaps, onComplete, onNavigate]);

  const handleMapToggle = (mapId: string) => {
    if (selectedMaps.includes(mapId)) {
      setSelectedMaps(selectedMaps.filter(id => id !== mapId));
    } else if (selectedMaps.length < 5) {
      setSelectedMaps([...selectedMaps, mapId]);
    }
  };

  const handleConfirm = () => {
    if (selectedMaps.length === 5 && phase === 'selection') {
      setPhase('ready');
    }
  };

  const handleReady = () => {
    if (!playerReady) {
      setPlayerReady(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
                  onClick={() => onNavigate('lobby')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  BACK TO LOBBY
                </Button>
              )}
              <h1 className="text-3xl font-bold text-orange-400 font-mono">MAP SELECTION</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 font-mono text-xl">{formatTime(timeLeft)}</span>
              </div>
              <Badge className={`font-mono ${timeLeft <= 30 ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-orange-900/20 text-orange-400 border-orange-900/30'}`}>
                {timeLeft <= 30 ? 'CRITICAL' : phase.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          {/* Player Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-black/40 border-orange-900/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-orange-400" />
                    <span className="text-orange-400 font-mono text-sm">{playerId}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {playerReady && <CheckCircle className="w-4 h-4 text-green-400" />}
                    <Badge className={`font-mono text-xs ${playerReady ? 'bg-green-900/20 text-green-400 border-green-900/30' : 'bg-gray-900/20 text-gray-400 border-gray-900/30'}`}>
                      {playerReady ? 'READY' : 'SELECTING'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Maps: {selectedMaps.length}/5</span>
                  <Progress value={(selectedMaps.length / 5) * 100} className="w-24 h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-blue-900/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400 font-mono text-sm">{opponentId}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {opponentReady && <CheckCircle className="w-4 h-4 text-green-400" />}
                    <Badge className={`font-mono text-xs ${opponentReady ? 'bg-green-900/20 text-green-400 border-green-900/30' : 'bg-gray-900/20 text-gray-400 border-gray-900/30'}`}>
                      {opponentReady ? 'READY' : 'SELECTING'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Maps: {opponentMaps.length}/5</span>
                  <Progress value={(opponentMaps.length / 5) * 100} className="w-24 h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {phase === 'selection' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {halfLifeMaps.map((map) => (
                <Card 
                  key={map.id} 
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedMaps.includes(map.id)
                      ? 'bg-orange-900/20 border-orange-400 ring-2 ring-orange-400/50'
                      : opponentMaps.includes(map.id)
                      ? 'bg-blue-900/20 border-blue-400 ring-1 ring-blue-400/30'
                      : 'bg-black/40 border-orange-900/20 hover:border-orange-400/50'
                  }`}
                  onClick={() => handleMapToggle(map.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="text-center">
                      <div className="text-4xl mb-2">{map.image}</div>
                      <CardTitle className="text-orange-400 font-mono text-sm">{map.name}</CardTitle>
                      <p className="text-gray-400 font-mono text-xs mt-1">{map.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="text-center">
                      <Badge className={`font-mono text-xs ${
                        selectedMaps.includes(map.id)
                          ? 'bg-green-900/20 text-green-400 border-green-900/30'
                          : opponentMaps.includes(map.id)
                          ? 'bg-blue-900/20 text-blue-400 border-blue-900/30'
                          : 'bg-gray-900/20 text-gray-400 border-gray-900/30'
                      }`}>
                        {selectedMaps.includes(map.id) ? 'YOU SELECTED' : 
                         opponentMaps.includes(map.id) ? 'OPP SELECTED' : 'AVAILABLE'}
                      </Badge>
                      {selectedMaps.includes(map.id) && (
                        <div className="mt-2">
                          <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                        </div>
                      )}
                      {opponentMaps.includes(map.id) && !selectedMaps.includes(map.id) && (
                        <div className="mt-2">
                          <Shield className="w-5 h-5 text-blue-400 mx-auto" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleConfirm}
                disabled={selectedMaps.length !== 5}
                className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono px-8 py-3"
              >
                <Map className="w-4 h-4 mr-2" />
                CONFIRM SELECTION ({selectedMaps.length}/5)
              </Button>
            </div>
          </>
        ) : phase === 'ready' ? (
          <div className="text-center space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
              {/* Your Maps */}
              <div>
                <h3 className="text-xl font-mono text-orange-400 mb-4">YOUR MAPS</h3>
                <div className="grid grid-cols-5 gap-2">
                  {selectedMaps.map((mapId) => {
                    const map = halfLifeMaps.find(m => m.id === mapId);
                    return (
                      <div key={mapId} className="text-center">
                        <div className="text-2xl mb-1">{map?.image}</div>
                        <p className="text-orange-400 font-mono text-xs">{map?.name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Opponent Maps */}
              <div>
                <h3 className="text-xl font-mono text-blue-400 mb-4">OPPONENT MAPS</h3>
                <div className="grid grid-cols-5 gap-2">
                  {opponentMaps.map((mapId) => {
                    const map = halfLifeMaps.find(m => m.id === mapId);
                    return (
                      <div key={mapId} className="text-center">
                        <div className="text-2xl mb-1">{map?.image}</div>
                        <p className="text-blue-400 font-mono text-xs">{map?.name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={handleReady}
                  disabled={playerReady}
                  className={`${playerReady ? 'bg-green-900/20 border-green-900/30 text-green-400' : 'bg-orange-900/20 border-orange-900/30 text-orange-400 hover:bg-orange-900/30'} font-mono px-8 py-3`}
                >
                  {playerReady ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      READY!
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      READY UP
                    </>
                  )}
                </Button>
              </div>
              
              {!opponentReady && (
                <p className="text-gray-400 font-mono">Waiting for opponent to ready up...</p>
              )}
              
              {opponentReady && !playerReady && (
                <p className="text-blue-400 font-mono">{opponentId} is ready! Click READY UP to continue.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-green-400 font-mono mb-2">BOTH PLAYERS READY</h2>
              <p className="text-gray-400 font-mono">Proceeding to map banning phase...</p>
            </div>
            <div className="mt-4">
              <div className="w-6 h-6 animate-spin border-2 border-green-400 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}