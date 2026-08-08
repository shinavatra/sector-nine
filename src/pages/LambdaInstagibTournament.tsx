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
import { TournamentCountdown } from "../components/TournamentCountdown";

interface LambdaInstagibTournamentProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

export function LambdaInstagibTournament({ onNavigate, isPremium = false }: LambdaInstagibTournamentProps) {
  const { user } = useUser();
  const [isReady, setIsReady] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    tournamentAPI.getById('lambda-instagib-tournament')
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
    if (!isPremium && !isReady) {
      toast.error("VIP Subscription Required", {
        description: "Tournament registration requires VIP subscription. Visit the store to upgrade."
      });
      return;
    }
    if (isReady) {
      setIsRegistering(true);
      try {
        await tournamentAPI.unregister('lambda-instagib-tournament');
        const data=await tournamentAPI.getById('lambda-instagib-tournament');
        setTournament(data.tournament);setParticipants(data.tournament?.participants||[]);setIsReady(false);
        toast.info("Registration cancelled", { description: "You have withdrawn from this tournament" });
      } catch (err:any) { toast.error("Cancellation failed",{description:err.message||"Please try again"}); }
      finally { setIsRegistering(false); }
      return;
    }
    setIsRegistering(true);
    try {
      await tournamentAPI.register('lambda-instagib-tournament');
      setIsReady(true);
      // Refresh participants
      const data = await tournamentAPI.getById('lambda-instagib-tournament');
      setTournament(data.tournament);
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
  const maxParticipants = tournament?.max_participants || 32;
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
          <div className="text-4xl">⚡</div>
          <div>
            <h1 className="text-3xl text-orange-400 font-mono">LAMBDA INSTAGIB TOURNAMENT</h1>
            <p className="text-gray-400 font-mono mt-1">32-Player Single Elimination Tournament</p>
          </div>
        </div>
      </div>

      {/* Tournament Status Banner */}
      <Card className="bg-gradient-to-r from-yellow-900/20 to-purple-900/20 border-yellow-900/30 mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-900/20 rounded-lg">
                <Zap className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-yellow-400 font-mono text-lg">HIGH-PRECISION COMBAT</h3>
                <TournamentCountdown tournament={tournament} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl text-green-400 font-mono">{currentParticipants}/{32}</div>
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
                <Target className={`w-8 h-8 ${isReady ? 'text-green-400' : 'text-orange-400'}`} />
              </div>
              <div>
                <h3 className={`font-mono text-lg ${isReady ? 'text-green-400' : 'text-orange-400'}`}>
                  {isReady ? 'PRECISION READY' : 'CALIBRATION MODE'}
                </h3>
                <p className="text-gray-300 font-mono">
                  {isReady ? 'Your aim is calibrated for tournament' : 'Prepare for one-shot elimination combat'}
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
                    <div className="text-orange-400 font-mono">Jan 22, 2025 20:00 CET</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Format</div>
                    <div className="text-orange-400 font-mono">32-Player Single Elimination</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Zap className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Game Mode</div>
                    <div className="text-orange-400 font-mono">Instagib Mode</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Trophy className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Entry Requirement</div>
                    <div className="text-orange-400 font-mono">VIP Subscription Only</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 border-t border-orange-900/20 pt-4">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <div>
                    <div className="text-gray-300 font-mono">Prize Pool</div>
                    <div className="text-orange-400 font-mono">{Number(tournament?.prize_pool_points||0).toLocaleString()} Research Points</div>
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
                  {["dm_killbox", "dm_lockdown", "dm_rapidcore", "dm_stalkyard"].map((map, index) => (
                    <div key={map} className="flex items-center justify-between p-3 bg-black/20 rounded border border-orange-900/20">
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-4 h-4 text-green-400" />
                        <span className="text-orange-400 font-mono">{map}</span>
                      </div>
                      <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-900/30 font-mono text-xs">
                        PRECISION
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
              <CardTitle className="text-orange-400 font-mono">INSTAGIB COMPETITION RULES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-green-400 font-mono mb-3">GENERAL RULES</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• All players must be registered and ready 15 minutes before tournament start</li>
                  <li>• Late arrivals will result in automatic disqualification</li>
                  <li>• Tournament follows single-elimination bracket format</li>
                  <li>• Best of 3 matches for semifinals and finals</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono mb-3">INSTAGIB RULES</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• Only rail gun available (one-shot elimination)</li>
                  <li>• No armor or health pickups</li>
                  <li>• 10-minute time limit per match</li>
                  <li>• First to 15 frags wins, or highest score at time limit</li>
                  <li>• Instant respawn enabled</li>
                </ul>
              </div>

              <div>
                <h4 className="text-green-400 font-mono mb-3">TECHNICAL REQUIREMENTS</h4>
                <ul className="space-y-2 text-gray-300 font-mono">
                  <li>• Stable internet connection with low latency required</li>
                  <li>• Maximum ping of 100ms to tournament servers</li>
                  <li>• High refresh rate monitor recommended</li>
                  <li>• Mouse acceleration must be disabled</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">REGISTERED PARTICIPANTS ({participants.length}/32)</CardTitle>
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
                    <div key={participant.user_id || participant.id} className="p-4 bg-black/20 rounded border border-orange-900/20 transition-colors hover:border-orange-700/50">
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
                    Tournament starts: Jan 20, 2025 20:00 CET
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
                          <div className="flex items-center gap-2 text-orange-400 font-mono">{player.username}{tournament?.status==='finished'&&(player.placement===1||index===0)&&<Badge className="border-yellow-700/40 bg-yellow-900/20 text-yellow-300">WINNER</Badge>}</div>
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
                STARTS JAN 22, 20:00 CET
              </Badge>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="rounded-lg border border-orange-900/20 bg-black/20 py-10 text-center sm:py-14">
                <div className="text-6xl mb-4">⚡</div>
                <h3 className="text-xl text-orange-400 font-mono mb-2">PRECISION BRACKET PENDING</h3>
                <p className="text-gray-400 font-mono">Tournament bracket will be generated when registration closes</p>
                <p className="text-sm text-gray-500 font-mono mt-2">Jan 22, 2025 19:00 CET</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
