import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, AlertTriangle, Shield, Zap, Users, Eye, Lock, Gamepad2 } from "lucide-react";

interface DisclaimerProps {
  onNavigate?: (page: string) => void;
}

export function Disclaimer({ onNavigate }: DisclaimerProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
          onClick={() => onNavigate?.('lobby')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO FACILITY
        </Button>
        <h1 className="text-3xl font-bold text-orange-400 font-mono">PLATFORM DISCLAIMER</h1>
        <p className="text-gray-400 font-mono mt-1">Important notices and operational limitations</p>
      </div>

      {/* Warning Banner */}
      <Card className="bg-gradient-to-r from-red-900/30 to-orange-900/20 border-red-900/30 mb-8">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-mono text-lg mb-2">CRITICAL PLATFORM NOTICE</h3>
              <p className="text-gray-300 font-mono text-sm leading-relaxed">
                Sector Nine Initiative is a <span className="text-orange-400">COMPETITIVE ESPORTS PLATFORM</span> for Half-Life 1 gameplay. 
                This service operates with specific limitations and requirements detailed below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Platform Scope */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Gamepad2 className="w-6 h-6 text-orange-400" />
                <CardTitle className="text-orange-400 font-mono">PLATFORM SCOPE</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
                HALF-LIFE 1 EXCLUSIVE
              </Badge>
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  This platform is <span className="text-orange-400">EXCLUSIVELY DESIGNED</span> for Half-Life 1 competitive gameplay. 
                  No other games or game modes are supported.
                </p>
                <p>
                  Two matchmaking modes available: <span className="text-green-400">Classic Deathmatch</span> and <span className="text-green-400">Instagib Mode</span>. 
                  All matches are 1v1 format with 5-map selection requirement.
                </p>
                <p>
                  Tournament participation requires <span className="text-orange-400">VIP SUBSCRIPTION (€5.00)</span>. 
                  Standard matchmaking is free for all registered users.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Privacy Notice */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Lock className="w-6 h-6 text-purple-400" />
                <CardTitle className="text-purple-400 font-mono">DATA PRIVACY NOTICE</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge className="bg-red-900/20 text-red-400 border-red-900/30 font-mono">
                IMPORTANT: READ CAREFULLY
              </Badge>
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  <span className="text-red-400">DO NOT ENTER REAL PERSONAL INFORMATION</span> in bio fields, 
                  chat messages, or any platform text fields. This includes real names, addresses, phone numbers, or financial data.
                </p>
                <p>
                  Platform collects: Email (for login), Username, Steam ID, match statistics, and gameplay data. 
                  All data collection follows <span className="text-purple-400">MINIMAL NECESSARY</span> principles.
                </p>
                <p>
                  Your email address cannot be changed after registration. Contact support for account data export or deletion requests.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Limitations */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-blue-400" />
                <CardTitle className="text-blue-400 font-mono">ACCOUNT LIMITATIONS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  Display names are <span className="text-blue-400">PERMANENT</span> upon registration. 
                  Display name changes require <span className="text-orange-400">1500 PLATFORM POINTS</span>.
                </p>
                <p>
                  Social media links can be updated freely in your profile. Links are displayed publicly if your profile visibility is set to "Public".
                </p>
                <p>
                  Account credentials must be kept secure. Account sharing or credential trading violates terms and results in suspension.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Service Limitations */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-yellow-400" />
                <CardTitle className="text-yellow-400 font-mono">SERVICE LIMITATIONS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  Platform provided <span className="text-yellow-400">"AS IS"</span> without guarantees of uptime, 
                  match quality, or competitive balance. Service interruptions may occur.
                </p>
                <p>
                  Match abandonment results in progressive penalties: 5min, 10min, 20min, 30min escalating bans. 
                  Repeated violations lead to extended suspensions.
                </p>
                <p>
                  Steam authentication is <span className="text-orange-400">REQUIRED</span>. Half-Life 1 ownership verification 
                  is mandatory for accessing competitive features.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-green-400" />
                <CardTitle className="text-green-400 font-mono">SECURITY PROTOCOLS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  Use <span className="text-green-400">UNIQUE PASSWORDS</span> for your Sector Nine account. 
                  Never share credentials or account access with other users.
                </p>
                <p>
                  Anti-cheat systems monitor gameplay. Use of unauthorized software, exploits, or cheating tools 
                  results in <span className="text-red-400">IMMEDIATE PERMANENT BAN</span>.
                </p>
                <p>
                  Report suspicious activity, exploits, or security vulnerabilities through the in-platform support system immediately.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Community Standards */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Users className="w-6 h-6 text-orange-400" />
                <CardTitle className="text-orange-400 font-mono">COMMUNITY STANDARDS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  Maintain <span className="text-orange-400">PROFESSIONAL CONDUCT</span> in all interactions. 
                  Harassment, toxic behavior, or hate speech will not be tolerated.
                </p>
                <p>
                  Respect opponents and community members. Unsportsmanlike conduct, griefing, or intentional match disruption 
                  results in disciplinary action.
                </p>
                <p>
                  Use the reporting system for inappropriate behavior. All reports are reviewed and actioned by platform moderators.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Content Warning */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Eye className="w-6 h-6 text-blue-400" />
                <CardTitle className="text-blue-400 font-mono">CONTENT NOTICE</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
                <p>
                  Platform features Half-Life 1 themed content including sci-fi combat, weapons, and competitive gameplay scenarios.
                </p>
                <p>
                  Online player interactions are not pre-screened. Users may encounter competitive banter or trash talk typical of esports environments.
                </p>
                <p>
                  Platform is intended for users familiar with FPS mechanics and competitive gaming culture.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Notice */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-green-900/10 border-orange-900/30 mt-8">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <div className="text-orange-400 font-mono">
              ACKNOWLEDGMENT REQUIRED FOR PLATFORM ACCESS
            </div>
            <div className="text-gray-300 font-mono text-sm">
              By using Sector Nine Initiative, you acknowledge understanding and acceptance of all limitations, 
              requirements, and terms outlined in this disclaimer and the Terms and Conditions.
            </div>
            <div className="text-green-400 font-mono text-xs mt-4">
              Document Classification: PUBLIC • Distribution: ALL USERS • Version: 4.0.0
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
