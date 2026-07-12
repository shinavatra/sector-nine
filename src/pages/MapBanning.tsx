import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { X, Clock, Users, Shield, ArrowLeft, Map } from "lucide-react";
import { useState, useEffect } from "react";

const halfLifeMaps = [
  { id: 'c1a0', name: 'Anomalous Materials', image: '🏭', description: 'Classic research facility' },
  { id: 'c1a1', name: 'Unforeseen Consequences', image: '⚡', description: 'Post-incident chaos' },
  { id: 'c1a2', name: 'Office Complex', image: '🏢', description: 'Corporate battleground' },
  { id: 'c1a3', name: 'We\'ve Got Hostiles', image: '🎯', description: 'Military confrontation' },
  { id: 'c1a4', name: 'Blast Pit', image: '🕳️', description: 'Underground facility' },
  { id: 'c2a1', name: 'Red Letter Day', image: '🚂', description: 'Train yard combat' },
  { id: 'c2a2', name: 'Route Kanal', image: '🌊', description: 'Canal system' },
  { id: 'c2a3', name: 'Water Hazard', image: '💧', description: 'Aquatic warfare' },
  { id: 'c2a4', name: 'Black Mesa East', image: '🏗️', description: 'Eastern facility' },
  { id: 'c2a5', name: 'Ravenholm', image: '👻', description: 'Abandoned township' },
];

interface MapBanningProps {
  onNavigate?: (page: string) => void;
  onComplete?: (finalMap: string) => void;
  playerMaps?: string[];
  opponentMaps?: string[];
  playerId?: string;
  opponentId?: string;
}

export function MapBanning({ 
  onNavigate, 
  onComplete = () => {}, 
  playerMaps = ['c1a0', 'c1a1', 'c1a2', 'c1a3', 'c1a4'], 
  opponentMaps = ['c2a1', 'c2a2', 'c2a3', 'c2a4', 'c2a5'], 
  playerId = 'Freeman_G', 
  opponentId = 'Gordon_F' 
}: MapBanningProps) {
  const [allMaps] = useState([...new Set([...playerMaps, ...opponentMaps])]);
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [opponentBans, setOpponentBans] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');
  const [timeLeft, setTimeLeft] = useState(120);
  const [phase, setPhase] = useState<'banning' | 'final'>('banning');
  const [finalMap, setFinalMap] = useState<string>('');
  const [banHistory, setBanHistory] = useState<Array<{player: string, map: string, round: number}>>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-ban random map if time runs out
          if (phase === 'banning') {
            handleAutoBan();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    // Simulate opponent bans
    if (currentTurn === 'opponent' && phase === 'banning') {
      const availableMaps = allMaps.filter(map => !bannedMaps.includes(map) && !opponentBans.includes(map));
      if (availableMaps.length > 1) {
        setTimeout(() => {
          const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
          const roundNumber = Math.floor((bannedMaps.length + opponentBans.length) / 2) + 1;
          setOpponentBans(prev => [...prev, randomMap]);
          setBanHistory(prev => [...prev, {player: opponentId, map: randomMap, round: roundNumber}]);
          setCurrentTurn('player');
          setTimeLeft(120);
        }, 2000 + Math.random() * 2000); // Random delay for realism
      }
    }
  }, [currentTurn, allMaps, bannedMaps, opponentBans, phase, opponentId]);

  useEffect(() => {
    const totalBanned = bannedMaps.length + opponentBans.length;
    const remainingMaps = allMaps.filter(map => !bannedMaps.includes(map) && !opponentBans.includes(map));
    
    if (remainingMaps.length === 1) {
      setFinalMap(remainingMaps[0]);
      setPhase('final');
      setTimeout(() => {
        onComplete(remainingMaps[0]);
      }, 3000);
    }
  }, [bannedMaps, opponentBans, allMaps, onComplete]);

  const handleBan = (mapId: string) => {
    if (currentTurn === 'player' && !bannedMaps.includes(mapId) && !opponentBans.includes(mapId)) {
      const roundNumber = Math.floor((bannedMaps.length + opponentBans.length) / 2) + 1;
      setBannedMaps(prev => [...prev, mapId]);
      setBanHistory(prev => [...prev, {player: playerId, map: mapId, round: roundNumber}]);
      setCurrentTurn('opponent');
      setTimeLeft(120);
    }
  };

  const handleAutoBan = () => {
    const availableMaps = allMaps.filter(map => !bannedMaps.includes(map) && !opponentBans.includes(map));
    if (availableMaps.length > 1 && currentTurn === 'player') {
      const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
      setBannedMaps(prev => [...prev, randomMap]);
      setCurrentTurn('opponent');
      setTimeLeft(120);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMapStatus = (mapId: string) => {
    if (bannedMaps.includes(mapId)) return 'player-banned';
    if (opponentBans.includes(mapId)) return 'opponent-banned';
    return 'available';
  };

  const getRemainingMaps = () => {
    return allMaps.filter(map => !bannedMaps.includes(map) && !opponentBans.includes(map));
  };

  if (phase === 'final') {
    const finalMapData = halfLifeMaps.find(m => m.id === finalMap);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-8 max-w-2xl mx-auto">
          <div className="text-8xl mb-4">{finalMapData?.image}</div>
          <div>
            <h1 className="text-4xl font-bold text-orange-400 font-mono mb-2">FINAL MAP</h1>
            <h2 className="text-2xl text-green-400 font-mono mb-4">{finalMapData?.name}</h2>
            <p className="text-gray-400 font-mono mb-6">{finalMapData?.description}</p>
          </div>

          {/* Match Details */}
          <Card className="bg-black/40 border-green-900/20">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Player 1:</span>
                  <span className="text-orange-400">{playerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Player 2:</span>
                  <span className="text-blue-400">{opponentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Maps Banned:</span>
                  <span className="text-red-400">{bannedMaps.length + opponentBans.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Pool:</span>
                  <span className="text-green-400">{allMaps.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Badge className="bg-green-900/20 text-green-400 border-green-900/30 font-mono text-lg px-6 py-3">
            MATCH CONFIRMED
          </Badge>
          
          <div className="space-y-2">
            <p className="text-orange-400 font-mono animate-pulse">
              Initializing server connection...
            </p>
            <div className="w-8 h-8 animate-spin border-2 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold text-orange-400 font-mono">MAP BANNING PHASE</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 font-mono text-xl">{formatTime(timeLeft)}</span>
              </div>
              <Badge className={`font-mono ${currentTurn === 'player' ? 'bg-orange-900/20 text-orange-400 border-orange-900/30' : 'bg-blue-900/20 text-blue-400 border-blue-900/30'}`}>
                {currentTurn === 'player' ? 'YOUR TURN' : 'OPPONENT TURN'}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-black/40 border-orange-900/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-orange-400" />
                  <div>
                    <div className="text-lg font-bold text-orange-400 font-mono">{getRemainingMaps().length}</div>
                    <div className="text-xs text-gray-400 font-mono">Maps Remaining</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-black/40 border-green-900/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Map className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-lg font-bold text-green-400 font-mono">{allMaps.length}</div>
                    <div className="text-xs text-gray-400 font-mono">Total Pool</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-black/40 border-red-900/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <X className="w-5 h-5 text-red-400" />
                  <div>
                    <div className="text-lg font-bold text-red-400 font-mono">{bannedMaps.length}</div>
                    <div className="text-xs text-gray-400 font-mono">Your Bans</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-black/40 border-blue-900/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-lg font-bold text-blue-400 font-mono">{opponentBans.length}</div>
                    <div className="text-xs text-gray-400 font-mono">Opponent Bans</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ban History */}
          {banHistory.length > 0 && (
            <Card className="bg-black/40 border-orange-900/20 mb-6">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono text-sm">BAN HISTORY</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {banHistory.slice(-5).reverse().map((ban, index) => {
                    const map = halfLifeMaps.find(m => m.id === ban.map);
                    return (
                      <div key={index} className="flex items-center justify-between text-xs font-mono">
                        <span className={ban.player === playerId ? 'text-red-400' : 'text-blue-400'}>
                          Round {ban.round}: {ban.player} banned
                        </span>
                        <span className="text-gray-400">{map?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {allMaps.map((mapId) => {
            const map = halfLifeMaps.find(m => m.id === mapId);
            const status = getMapStatus(mapId);
            
            return (
              <Card 
                key={mapId} 
                className={`transition-all duration-200 relative ${
                  status === 'player-banned' ? 'bg-red-900/20 border-red-400 opacity-60' :
                  status === 'opponent-banned' ? 'bg-blue-900/20 border-blue-400 opacity-60' :
                  currentTurn === 'player' ? 'bg-black/40 border-orange-900/20 hover:border-orange-400/50 cursor-pointer hover:scale-105' :
                  'bg-black/40 border-gray-900/20 opacity-80'
                }`}
                onClick={() => status === 'available' && currentTurn === 'player' && handleBan(mapId)}
              >
                <CardHeader className="pb-2">
                  <div className="text-center relative">
                    <div className="text-4xl mb-2">{map?.image}</div>
                    {status !== 'available' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
                        <X className="w-8 h-8 text-red-400" />
                      </div>
                    )}
                    <CardTitle className="text-orange-400 font-mono text-sm">{map?.name}</CardTitle>
                    <p className="text-gray-400 font-mono text-xs mt-1">{map?.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-center">
                    <Badge className={`font-mono text-xs ${
                      status === 'player-banned' ? 'bg-red-900/20 text-red-400 border-red-900/30' :
                      status === 'opponent-banned' ? 'bg-blue-900/20 text-blue-400 border-blue-900/30' :
                      'bg-green-900/20 text-green-400 border-green-900/30'
                    }`}>
                      {status === 'player-banned' ? 'YOU BANNED' :
                       status === 'opponent-banned' ? 'OPP BANNED' :
                       'AVAILABLE'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {currentTurn === 'player' && (
          <div className="text-center">
            <p className="text-orange-400 font-mono mb-4">Click on a map to ban it</p>
            <Button
              onClick={handleAutoBan}
              variant="outline"
              className="border-gray-600 text-gray-400 hover:bg-gray-800 font-mono"
            >
              AUTO BAN RANDOM MAP
            </Button>
          </div>
        )}

        {currentTurn === 'opponent' && (
          <div className="text-center">
            <p className="text-blue-400 font-mono">Waiting for opponent to ban a map...</p>
            <div className="mt-4">
              <div className="w-6 h-6 animate-spin border-2 border-blue-400 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}