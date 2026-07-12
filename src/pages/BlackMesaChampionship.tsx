import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Trophy, Calendar, Users, Clock, Target, Award, Zap, Crown, Star, AlertCircle, ArrowLeft, MapPin, Shield, Sword } from "lucide-react";
import { toast } from "sonner";
import { tournamentAPI } from "../utils/api";
import { useUser } from "../contexts/UserContext";

interface BlackMesaChampionshipProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

export function BlackMesaChampionship({ onNavigate, isPremium = false }: BlackMesaChampionshipProps) {
  const { user } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    tournamentAPI.getById('black-mesa-championship')
      .then(data => {
        setTournament(data.tournament);
        setParticipants(data.tournament?.participants || []);
        // Check if current user is already registered
        if (user?.id && data.tournament?.participants?.some((p: any) => p.user_id === user.id)) {
          setIsReady(true);
        }
      })
      .catch(err => console.error('Failed to load tournament:', err));
  }, [user?.id]);

  const handleReady = async () => {
    if (!isPremium) {
      toast.error("VIP Subscription Required", {
        description: "Tournament registration requires VIP subscription. Visit the store to upgrade."
      });
      return;
    }
    if (isReady) {
      // Cancel is UI-only for now — no cancel endpoint yet
      setIsReady(false);
      toast.info("Registration cancelled", { description: "You have withdrawn from this tournament" });
      return;
    }
    setIsRegistering(true);
    try {
      await tournamentAPI.register('black-mesa-championship');
      setIsReady(true);
      // Refresh participants
      const data = await tournamentAPI.getById('black-mesa-championship');
      setParticipants(data.tournament?.participants || []);
      toast.success("Registered for tournament!", {
        description: "You are now registered and will be notified when matches begin"
      });
    } catch (err: any) {
      toast.error("Registration failed", { description: err.message || "Please try again" });
    } finally {
      setIsRegistering(false);
    }
  };

  const currentParticipants = tournament?.current_participants || participants.length;
  const maxParticipants = tournament?.max_participants || 120;
  const registrationPct = Math.round((currentParticipants / maxParticipants) * 100);

  // standings derived from participants sorted by wins
  const standings = [...participants].sort((a, b) => (b.wins || 0) - (a.wins || 0));

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onNavigate?.('tournament')}
            className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/10 font-mono"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK TO TOURNAMENTS
          </Button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-4xl">🏆</div>
          <div>
            <h1 className="text-3xl text-orange-400 font-mono">BLACK MESA CHAMPIONSHIP</h1>
            <p className="text-gray-400 font-mono mt-1">Classic Deathmatch 1v1 • 120 Players • VIP Only</p>
          </div>
        </div>
      </div>

      {/* Tournament Status Banner */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-green-900/20 border-orange-900/30 mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-900/20 rounded-lg">
                <Trophy className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-orange-400 font-mono text-lg">TOURNAMENT ACTIVE</h3>
                <p className="text-gray-300 font-mono">Registration open until Jan 15, 2025 18:00 CET</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl text-green-400 font-mono">{currentParticipants}/{120}</div>
              <div className="text-sm text-gray-400 font-mono">Players Registered</div>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={registrationPct} className="bg-black/40" />
          </div>
        </CardContent>
      </Card>

      {/* Ready Status */}
      <Card className="bg-black/40 border-orange-900/20 mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${isReady ? 'bg-green-900/20' : 'bg-orange-900/20'}`}>
                <Shield className={`w-8 h-8 ${isReady ? 'text-green-400' : 'text-orange-400'}`} />
              </div>
              <div>
                <h3 className={`font-mono text-lg ${isReady ? 'text-green-400' : 'text-orange-400'}`}>
                  {isReady ? 'TOURNAMENT REGISTERED' : 'REGISTRATION STATUS'}
                </h3>
                <p className="text-gray-300 font-mono">
                  {isReady 
                    ? 'You are registered and will be notified when matches begin' 
                    : isPremium 
                      ? 'Register for tournament to secure your spot' 
                      : 'VIP subscription required for tournament registration'
                  }
                </p>
              </div>
            </div>
            <Button 
              onClick={handleReady}
              disabled={!isPremium && !isReady}
              className={`font-mono ${
                !isPremium && !isReady
                  ? 'bg-gray-800/20 border-gray-800/30 text-gray-500 cursor-not-allowed'
                  : isReady 
                    ? 'bg-red-900/20 border-red-900/30 text-red-400 hover:bg-red-900/30'
                    : 'bg-green-900/20 border-green-900/30 text-green-400 hover:bg-green-900/30'
              }`}
            >
              {!isPremium && !isReady ? 'VIP REQUIRED' : isRegistering ? 'REGISTERING...' : isReady ? 'CANCEL REGISTRATION' : 'REGISTER NOW'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tournament Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="overview" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            OVERVIEW
          </TabsTrigger>
          <TabsTrigger value="rules" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            RULES
          </TabsTrigger>
          <TabsTrigger value="participants" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            PARTICIPANTS
          </TabsTrigger>
          <TabsTrigger value="standings" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            STANDINGS
          </TabsTrigger>
          <TabsTrigger value="bracket" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            BRACKET
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tournament Details */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">TOURNAMENT DETAILS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Start Date</div>
                    <div className="text-orange-400 font-mono">Jan 15, 2025 19:00 CET</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Format</div>
                    <div className="text-orange-400 font-mono">120-Player 1v1 Elimination</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Target className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Game Mode</div>
                    <div className="text-orange-400 font-mono">Classic Deathmatch</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Trophy className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Prize Pool</div>
                    <div className="text-orange-400 font-mono">5000 Research Points</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Maps */}
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">MAP ROTATION</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["dm_crossfire", "dm_bounce", "dm_undertow", "dm_gasworks"].map((map, index) => (
                    <div key={map} className="flex items-center justify-between p-3 bg-black/20 rounded border border-orange-900/20">
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-4 h-4 text-green-400" />
                        <span className="text-orange-400 font-mono">{map}</span>
                      </div>
                      <Badge className="bg-green-900/20 text-green-400 border-green-900/30 font-mono text-xs">
                        ROUND {index + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">COMPETITION RULES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-green-400 font-mono mb-3">GENERAL RULES</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• All players must be registered and ready 15 minutes before tournament start</li>
                  <li>• Late arrivals will result in automatic disqualification</li>
                  <li>• Tournament follows single-elimination bracket format</li>
                  <li>• Best of 3 matches for quarterfinals and beyond</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono mb-3">GAMEPLAY RULES</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• Standard Half-Life 1 weapon set enabled</li>
                  <li>• No external modifications or cheats allowed</li>
                  <li>• 15-minute time limit per match</li>
                  <li>• First to 20 frags wins, or highest score at time limit</li>
                </ul>
              </div>

              <div>
                <h4 className="text-green-400 font-mono mb-3">TECHNICAL REQUIREMENTS</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• Stable internet connection required</li>
                  <li>• Maximum ping of 150ms to tournament servers</li>
                  <li>• Steam overlay must be enabled</li>
                  <li>• Voice communication recommended</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">REGISTERED PARTICIPANTS ({participants.length}/120)</CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="text-center py-12 bg-black/20 border border-orange-900/20 rounded-lg">
                  <Users className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                  <div className="text-gray-400 font-mono text-sm mb-2">
                    No participants registered yet
                  </div>
                  <div className="text-xs text-gray-500 font-mono mb-4">
                    Be the first to join this tournament!
                  </div>
                  {!isReady && isPremium && (
                    <Button
                      onClick={handleReady}
                      className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                    >
                      REGISTER NOW
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {participants.map((participant, index) => (
                    <div key={participant.user_id || participant.id} className="p-4 bg-black/20 rounded border border-orange-900/20">
                      <div className="flex items-center space-x-3 mb-3">
                        <Avatar className="h-10 w-10 border-2 border-orange-900/30">
                          <AvatarImage src={participant.avatar} alt={participant.username} />
                          <AvatarFallback className="bg-orange-900/20 text-orange-400">
                            {(participant.username || "??").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-orange-400 font-mono">{participant.username}</div>
                          <div className="text-xs text-green-400 font-mono">LVL {participant.level}</div>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm font-mono">
                        <span className="text-green-400">{participant.wins}W</span>
                        <span className="text-red-400">{participant.losses}L</span>
                        <span className="text-gray-400">{((participant.wins / (participant.wins + participant.losses)) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">CURRENT STANDINGS</CardTitle>
            </CardHeader>
            <CardContent>
              {standings.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                  <div className="text-gray-400 font-mono text-sm">
                    Standings will be available once the tournament begins
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-2">
                    Tournament starts: Jan 15, 2025 19:00 CET
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {standings.map((player, index) => (
                    <div key={player.user_id || player.id} className="flex items-center justify-between p-4 bg-black/20 rounded border border-orange-900/20">
                      <div className="flex items-center space-x-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono ${
                          index === 0 ? 'bg-yellow-900/20 text-yellow-400' :
                          index === 1 ? 'bg-gray-600/20 text-gray-400' :
                          index === 2 ? 'bg-orange-900/20 text-orange-600' :
                          'bg-gray-800/20 text-gray-500'
                        }`}>
                          {index + 1}
                        </div>
                        <Avatar className="h-10 w-10 border-2 border-orange-900/30">
                          <AvatarImage src={player.avatar} alt={player.username} />
                          <AvatarFallback className="bg-orange-900/20 text-orange-400">
                            {(player.username || "??").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-orange-400 font-mono">{player.username}</div>
                          <div className="text-xs text-green-400 font-mono">LVL {player.level}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6 text-sm font-mono">
                        <div className="text-center">
                          <div className="text-green-400">{player.wins}</div>
                          <div className="text-xs text-gray-400">WINS</div>
                        </div>
                        <div className="text-center">
                          <div className="text-red-400">{player.losses}</div>
                          <div className="text-xs text-gray-400">LOSSES</div>
                        </div>
                        <div className="text-center">
                          <div className="text-orange-400">{((player.wins / (player.wins + player.losses)) * 100).toFixed(0)}%</div>
                          <div className="text-xs text-gray-400">WIN RATE</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">TOURNAMENT BRACKET</CardTitle>
              <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-900/30 font-mono">
                STARTS JAN 15, 19:00 CET
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl text-orange-400 font-mono mb-2">BRACKET PENDING</h3>
                <p className="text-gray-400 font-mono">Tournament bracket will be generated when registration closes</p>
                <p className="text-sm text-gray-500 font-mono mt-2">Jan 15, 2025 18:00 CET</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}