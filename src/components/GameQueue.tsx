import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Loader2, Users, Clock, Gamepad2 } from "lucide-react";

const games = [
  { id: "hl1", name: "Half-Life 1", players: "1v1", avgWait: "2min" },
  { id: "cs16", name: "Counter-Strike 1.6", players: "5v5", avgWait: "1min" },
  { id: "quake3", name: "Quake III Arena", players: "1v1", avgWait: "90s" },
  { id: "tf2", name: "Team Fortress 2", players: "6v6", avgWait: "3min" },
  { id: "hl1dm", name: "Half-Life Deathmatch", players: "FFA", avgWait: "45s" },
];

export function GameQueue() {
  const [selectedGame, setSelectedGame] = useState("");
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  const handleQueue = () => {
    if (!selectedGame) return;
    
    setIsQueuing(true);
    setQueueTime(0);
    
    // Simulate queue timer
    const timer = setInterval(() => {
      setQueueTime(prev => prev + 1);
    }, 1000);

    // Simulate finding match after random time
    setTimeout(() => {
      clearInterval(timer);
      setIsQueuing(false);
      setQueueTime(0);
      // Here you would normally transition to match lobby
      alert("Match found! Redirecting to lobby...");
    }, Math.random() * 15000 + 5000); // 5-20 seconds
  };

  const handleCancelQueue = () => {
    setIsQueuing(false);
    setQueueTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-md border-orange-900/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-400">
          <Gamepad2 className="w-5 h-5" />
          <span>MATCHMAKING</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block text-green-400 font-mono">GAME PROTOCOL</label>
          <Select value={selectedGame} onValueChange={setSelectedGame} disabled={isQueuing}>
            <SelectTrigger className="bg-black/60 border-orange-900/30 text-gray-300">
              <SelectValue placeholder="SELECT GAME MODULE" />
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{game.name}</span>
                    <div className="flex items-center space-x-2 ml-4">
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {game.players}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {game.avgWait}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isQueuing && (
          <div className="text-center p-4 bg-orange-900/10 rounded-lg border border-orange-900/20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-orange-400" />
            <p className="text-sm text-green-400 font-mono">SCANNING FOR OPPONENTS...</p>
            <p className="font-medium text-orange-400 font-mono text-lg">{formatTime(queueTime)}</p>
          </div>
        )}

        <div className="flex gap-2">
          {!isQueuing ? (
            <Button 
              onClick={handleQueue} 
              disabled={!selectedGame}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-black font-bold"
            >
              INITIATE PROTOCOL
            </Button>
          ) : (
            <Button 
              onClick={handleCancelQueue} 
              variant="destructive"
              className="flex-1 bg-red-600 hover:bg-red-700 font-bold"
            >
              ABORT MISSION
            </Button>
          )}
        </div>

        {selectedGame && !isQueuing && (
          <div className="text-center text-sm text-green-400 font-mono">
            <p>EST. DEPLOYMENT TIME: {games.find(g => g.id === selectedGame)?.avgWait}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}