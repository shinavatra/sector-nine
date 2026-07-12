import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { ArrowLeft, Trophy, Shield, Target, Zap, Users, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface TournamentRulesProps {
  onNavigate?: (page: string) => void;
}

export function TournamentRules({ onNavigate }: TournamentRulesProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          onClick={() => onNavigate?.('hub')}
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO HUB
        </Button>
        <h1 className="text-4xl font-bold text-orange-400 font-mono">TOURNAMENT REGULATIONS</h1>
        <p className="text-gray-400 font-mono mt-2">OFFICIAL SECTOR NINE INITIATIVE COMPETITIVE PROTOCOLS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* General Rules */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                GENERAL TOURNAMENT REGULATIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border border-orange-900/20 rounded-lg p-4 bg-black/20">
                  <h3 className="text-green-400 font-mono mb-3">1. PLAYER ELIGIBILITY</h3>
                  <ul className="space-y-2 text-gray-400 font-mono text-sm">
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400 mt-0.5 flex-shrink-0" />
                      Active Premium subscription required (€5/month)
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400 mt-0.5 flex-shrink-0" />
                      Verified Steam account integration mandatory
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400 mt-0.5 flex-shrink-0" />
                      Minimum 50 ranked matches completed
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400 mt-0.5 flex-shrink-0" />
                      Clean disciplinary record (no recent suspensions)
                    </li>
                  </ul>
                </div>

                <div className="border border-orange-900/20 rounded-lg p-4 bg-black/20">
                  <h3 className="text-green-400 font-mono mb-3">2. ANTI-CHEAT PROTOCOLS</h3>
                  <ul className="space-y-2 text-gray-400 font-mono text-sm">
                    <li className="flex items-start">
                      <AlertTriangle className="w-4 h-4 mr-2 text-yellow-400 mt-0.5 flex-shrink-0" />
                      Sector Nine Anti-Cheat (S9AC) required during all matches
                    </li>
                    <li className="flex items-start">
                      <XCircle className="w-4 h-4 mr-2 text-red-400 mt-0.5 flex-shrink-0" />
                      Third-party software strictly prohibited
                    </li>
                    <li className="flex items-start">
                      <XCircle className="w-4 h-4 mr-2 text-red-400 mt-0.5 flex-shrink-0" />
                      Script modifications or game exploits result in immediate disqualification
                    </li>
                    <li className="flex items-start">
                      <AlertTriangle className="w-4 h-4 mr-2 text-yellow-400 mt-0.5 flex-shrink-0" />
                      Random mid-match integrity checks may occur
                    </li>
                  </ul>
                </div>

                <div className="border border-orange-900/20 rounded-lg p-4 bg-black/20">
                  <h3 className="text-green-400 font-mono mb-3">3. TOURNAMENT FORMAT</h3>
                  <ul className="space-y-2 text-gray-400 font-mono text-sm">
                    <li className="flex items-start">
                      <Target className="w-4 h-4 mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
                      Single elimination bracket structure
                    </li>
                    <li className="flex items-start">
                      <Target className="w-4 h-4 mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
                      Best of 3 matches (BO3) until semifinals
                    </li>
                    <li className="flex items-start">
                      <Target className="w-4 h-4 mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
                      Best of 5 matches (BO5) for finals
                    </li>
                    <li className="flex items-start">
                      <Clock className="w-4 h-4 mr-2 text-purple-400 mt-0.5 flex-shrink-0" />
                      15-minute maximum delay between matches
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Modes */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                APPROVED COMBAT PROTOCOLS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-green-900/30 rounded-lg p-4 bg-green-900/10">
                  <div className="flex items-center mb-3">
                    <Target className="w-5 h-5 mr-2 text-green-400" />
                    <h3 className="text-green-400 font-mono">CLASSIC DEATHMATCH</h3>
                  </div>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• First to 30 frags wins</li>
                    <li>• 20-minute time limit</li>
                    <li>• All weapons available</li>
                    <li>• Respawn delay: 3 seconds</li>
                  </ul>
                </div>

                <div className="border border-purple-900/30 rounded-lg p-4 bg-purple-900/10">
                  <div className="flex items-center mb-3">
                    <Zap className="w-5 h-5 mr-2 text-purple-400" />
                    <h3 className="text-purple-400 font-mono">INSTAGIB MODE</h3>
                  </div>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• Railgun only combat</li>
                    <li>• One-shot elimination</li>
                    <li>• First to 20 frags wins</li>
                    <li>• 15-minute time limit</li>
                  </ul>
                </div>

                <div className="border border-blue-900/30 rounded-lg p-4 bg-blue-900/10">
                  <div className="flex items-center mb-3">
                    <Users className="w-5 h-5 mr-2 text-blue-400" />
                    <h3 className="text-blue-400 font-mono">TEAM DEATHMATCH</h3>
                  </div>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• 4v4 team format</li>
                    <li>• First team to 60 frags</li>
                    <li>• 25-minute time limit</li>
                    <li>• Team communication allowed</li>
                  </ul>
                </div>

                <div className="border border-yellow-900/30 rounded-lg p-4 bg-yellow-900/10">
                  <div className="flex items-center mb-3">
                    <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                    <h3 className="text-yellow-400 font-mono">TOURNAMENT SPECIAL</h3>
                  </div>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• Admin-selected mode</li>
                    <li>• Varies by tournament</li>
                    <li>• Custom rule modifications</li>
                    <li>• Announced 24h prior</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map Regulations */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">MAP SELECTION PROTOCOLS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border border-orange-900/20 rounded-lg p-4 bg-black/20">
                <h3 className="text-green-400 font-mono mb-3">OFFICIAL MAP POOL</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-mono">
                  <div className="text-gray-400">
                    <div className="text-blue-400">CLASSIC MAPS:</div>
                    <div>• c1a0 (Anomalous Materials)</div>
                    <div>• c1a2 (Office Complex)</div>
                    <div>• c2a1 (Red Letter Day)</div>
                    <div>• c3a1 (Surface Tension)</div>
                  </div>
                  <div className="text-gray-400">
                    <div className="text-purple-400">DEATHMATCH:</div>
                    <div>• dm_crossfire</div>
                    <div>• dm_bounce</div>
                    <div>• dm_undertow</div>
                    <div>• dm_gasworks</div>
                  </div>
                  <div className="text-gray-400">
                    <div className="text-green-400">APPROVED:</div>
                    <div>• c4a1 (Residue Processing)</div>
                    <div>• c4a2 (Questionable Ethics)</div>
                    <div>• c2a5 (Ravenholm)</div>
                    <div>• c5a1 (Xen)</div>
                  </div>
                  <div className="text-gray-400">
                    <div className="text-yellow-400">TOURNAMENT:</div>
                    <div>• Custom selections</div>
                    <div>• Admin approval required</div>
                    <div>• Balanced for competition</div>
                    <div>• No exploitable areas</div>
                  </div>
                </div>
              </div>

              <div className="border border-red-900/20 rounded-lg p-4 bg-red-900/10">
                <h3 className="text-red-400 font-mono mb-3">MAP BANNING PROCESS</h3>
                <ol className="space-y-2 text-gray-400 font-mono text-sm">
                  <li>1. Each player/team bans 2 maps from the pool</li>
                  <li>2. Remaining maps form the active selection</li>
                  <li>3. Players alternate map picks for BO3/BO5</li>
                  <li>4. Final map (if needed) is randomly selected</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Penalties */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">DISCIPLINARY ACTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-yellow-900/30 rounded-lg p-4 bg-yellow-900/10">
                  <h3 className="text-yellow-400 font-mono mb-3">WARNING</h3>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• Minor rule violations</li>
                    <li>• Unsportsmanlike conduct</li>
                    <li>• Technical delays</li>
                    <li>• First offense</li>
                  </ul>
                </div>

                <div className="border border-orange-900/30 rounded-lg p-4 bg-orange-900/10">
                  <h3 className="text-orange-400 font-mono mb-3">SUSPENSION</h3>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• Repeated violations</li>
                    <li>• Match abandonment</li>
                    <li>• 7-30 day tournament ban</li>
                    <li>• Premium benefits suspended</li>
                  </ul>
                </div>

                <div className="border border-red-900/30 rounded-lg p-4 bg-red-900/10">
                  <h3 className="text-red-400 font-mono mb-3">PERMANENT BAN</h3>
                  <ul className="space-y-1 text-gray-400 font-mono text-xs">
                    <li>• Cheating/exploiting</li>
                    <li>• Account sharing</li>
                    <li>• Harassment</li>
                    <li>• Platform termination</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Reference */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">QUICK REFERENCE</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tournament Entry:</span>
                  <Badge className="bg-green-900/20 text-green-400 border-green-900/30">€10</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Premium Required:</span>
                  <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30">YES</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Players:</span>
                  <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/30">64</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prize Pool:</span>
                  <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-900/30">€500</Badge>
                </div>
              </div>
              <Separator className="bg-orange-900/20" />
              <div className="space-y-2 text-xs font-mono text-gray-400">
                <div>Next Tournament:</div>
                <div className="text-orange-400">January 15, 2024</div>
                <div className="text-green-400">19:00 GMT</div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SUPPORT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono text-xs"
              >
                TOURNAMENT ADMIN
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-green-900/30 text-green-400 hover:bg-green-900/10 font-mono text-xs"
              >
                TECHNICAL SUPPORT
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-blue-900/30 text-blue-400 hover:bg-blue-900/10 font-mono text-xs"
              >
                APPEAL PROCESS
              </Button>
            </CardContent>
          </Card>

          {/* Version Info */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardContent className="pt-4">
              <div className="text-center space-y-2">
                <div className="text-orange-400 font-mono text-sm">RULES VERSION</div>
                <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
                  v2.4.1
                </Badge>
                <div className="text-gray-500 font-mono text-xs">
                  Last Updated:<br />
                  January 2025
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}