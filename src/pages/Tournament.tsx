import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Trophy, Calendar, Users, Clock, Target, Award, Zap, Crown, Star, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface TournamentProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

const upcomingTournaments = [
  {
    id: 1,
    name: "Black Mesa Championship",
    mode: "Classic Deathmatch 1v1",
    description: "Traditional Half-Life 1 one-on-one combat experience",
    prize: "5000 Points",
    date: "Jan 15, 2025",
    time: "19:00 CET",
    participants: 0,
    maxParticipants: 120,
    status: "Open Registration",
    entryFee: "Free",
    icon: "🏆",
    maps: ["dm_crossfire", "dm_bounce", "dm_undertow", "dm_gasworks", "dm_powerup"]
  },
  {
    id: 2,
    name: "Lambda Instagib Tournament",
    mode: "Instagib Mode 1v1", 
    description: "One-shot elimination one-on-one combat with rail gun only",
    prize: "5000 Points",
    date: "Jan 22, 2025",
    time: "20:00 CET",
    participants: 0,
    maxParticipants: 120,
    status: "Open Registration",
    entryFee: "Free",
    icon: "⚡",
    maps: ["dm_killbox", "dm_lockdown", "dm_rapidcore", "dm_stalkyard", "dm_snark_pit"]
  },
  {
    id: 3,
    name: "Tactical Operations Championship",
    mode: "Tactical Operations 1v1",
    description: "Strategic one-on-one combat with specialized loadouts",
    prize: "5000 Points", 
    date: "Feb 2, 2025",
    time: "18:00 CET",
    participants: 0,
    maxParticipants: 120,
    status: "Open Registration",
    entryFee: "Free",
    icon: "🎯",
    maps: ["dm_datacore", "dm_lambda_bunker", "dm_powerhouse", "dm_fortress", "dm_chokepoint"]
  },
  {
    id: 4,
    name: "Resonance Cascade Royale",
    mode: "Battle Royale 1v1",
    description: "Last scientist standing - one-on-one elimination",
    prize: "5000 Points",
    date: "Feb 10, 2025",
    time: "21:00 CET",
    participants: 0,
    maxParticipants: 120,
    status: "Open Registration",
    entryFee: "Free",
    icon: "👑",
    maps: ["br_blackmesa", "br_xen_chambers", "br_facility_17", "br_lambda_core", "br_anomalous_materials"]
  }
];



export function Tournament({ onNavigate, isPremium = false }: TournamentProps) {
  // User is registered for all tournaments by default
  const [registeredTournaments, setRegisteredTournaments] = useState<number[]>([1, 2, 3, 4]);

  const handleEnterTournament = (tournamentId: number, tournamentName: string) => {
    toast.success("Entering tournament!", {
      description: `Opening ${tournamentName} tournament page...`
    });
    
    // Navigate to specific tournament page based on ID
    const tournamentPages: { [key: number]: string } = {
      1: 'black-mesa-championship',
      2: 'lambda-instagib-tournament', 
      3: 'tactical-operations-championship',
      4: 'resonance-cascade-royale'
    };
    
    setTimeout(() => {
      onNavigate?.(tournamentPages[tournamentId]);
    }, 800);
  };
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 font-mono">TOURNAMENT CENTER</h1>
        <p className="text-gray-400 font-mono mt-1">Competitive events and skill-based competitions</p>
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
                <h3 className="text-orange-400 font-mono text-lg">COMPETITIVE TOURNAMENTS</h3>
                <p className="text-gray-300 font-mono text-sm">
                  Free access to tournament pages. VIP subscription required for tournament registration.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400 font-mono">4</div>
              <div className="text-sm text-gray-400 font-mono">Active Events</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="upcoming" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            TOURNAMENTS
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            CHAMPIONS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {upcomingTournaments.map((tournament) => {
              const isRegistered = registeredTournaments.includes(tournament.id);
              const canEnter = tournament.status === 'Open Registration' && isRegistered;
              
              return (
                <Card key={tournament.id} className="bg-black/40 border-orange-900/20">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{tournament.icon}</div>
                        <div>
                          <CardTitle className="text-orange-400 font-mono">{tournament.name}</CardTitle>
                          <div className="text-sm text-gray-400 font-mono">{tournament.mode}</div>
                          <div className="text-xs text-gray-500 font-mono mt-1">{tournament.description}</div>
                        </div>
                      </div>
                      <Badge 
                        className="bg-green-900/20 text-green-400 border-green-900/30 font-mono"
                      >
                        REGISTERED
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300 font-mono">{tournament.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300 font-mono">{tournament.time}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300 font-mono">
                          {tournament.participants}/{tournament.maxParticipants}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-gray-400" />
                        <span className="text-green-400 font-mono">{tournament.prize}</span>
                      </div>
                    </div>

                    <Progress 
                      value={(tournament.participants / tournament.maxParticipants) * 100}
                      className="h-2"
                    />

                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-sm text-gray-400 font-mono mb-2">Tournament Maps</div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {tournament.maps.slice(0, 3).map((map) => (
                            <Badge key={map} variant="outline" className="text-xs text-orange-400 border-orange-400/30 font-mono">
                              {map.replace('dm_', '')}
                            </Badge>
                          ))}
                          {tournament.maps.length > 3 && (
                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-400/30 font-mono">
                              +{tournament.maps.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-400 font-mono">{tournament.entryFee}</div>
                          <div className="text-xs text-gray-400 font-mono">Entry Fee</div>
                        </div>
                        <Button 
                          onClick={() => handleEnterTournament(tournament.id, tournament.name)}
                          className="bg-orange-900/20 border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4" />
                            ENTER TOURNAMENT
                          </div>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">TOURNAMENT CHAMPIONS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                <div className="text-gray-400 font-mono text-sm">
                  No tournament champions yet
                </div>
                <div className="text-xs text-gray-500 font-mono mt-2">
                  Be the first to win a tournament and claim your glory!
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}