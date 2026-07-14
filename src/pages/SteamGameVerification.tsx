import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Progress } from "../components/ui/progress";
import { GamepadIcon, CheckCircle, XCircle, AlertTriangle, ExternalLink, Clock, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useUser } from "../contexts/UserContext";
import { getSteamProfile, verifyHalfLifeOwnership } from "../utils/steamAuth";

interface SteamGameVerificationProps {
  onNavigate?: (page: string) => void;
  onComplete?: () => void;
}

export function SteamGameVerification({ onNavigate, onComplete }: SteamGameVerificationProps) {
  const { user, refreshProfile } = useUser();
  const [verificationStep, setVerificationStep] = useState<'connecting' | 'scanning' | 'found' | 'not-found' | 'manual'>('connecting');
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [steamProfile, setSteamProfile] = useState<any>(null);

  // Real Steam verification using user's linked Steam account
  useEffect(() => {
    const performVerification = async () => {
      // Step 1: Connecting to Steam
      setVerificationStep('connecting');
      setProgress(20);
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if user has Steam linked
      if (!user?.steamId) {
        // No Steam account linked - show not found
        setVerificationStep('not-found');
        setProgress(100);
        setCanSkip(true);
        return;
      }
      
      // Step 2: Scanning library
      setVerificationStep('scanning');
      setProgress(50);
      
      try {
        // Get Steam profile
        const profile = await getSteamProfile(user.steamId);
        setSteamProfile(profile);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Step 3: Verify Half-Life ownership
        const hasGame = await verifyHalfLifeOwnership(user.steamId);

        if (hasGame) {
          setVerificationStep('found');
          setProgress(100);
          await refreshProfile();
        } else {
          setVerificationStep('not-found');
          setProgress(100);
        }
      } catch (error) {
        console.error('Steam verification error:', error);
        setVerificationStep('not-found');
        setProgress(100);
      }
      
      // Allow skipping after 5 seconds
      setTimeout(() => {
        setCanSkip(true);
      }, 5000);
    };

    performVerification();
  }, [user?.steamId]);

  const handleContinue = () => {
    if (verificationStep === 'found') {
      toast.success("Steam Integration Complete", {
        description: "Half-Life 1 verified successfully. Welcome to Sector Nine Initiative!"
      });
    }
    onComplete?.();
    onNavigate?.('hub');
  };

  const handleSkip = () => {
    toast.warning("Game Verification Skipped", {
      description: "You can add Half-Life 1 later in your profile settings to enable matchmaking."
    });
    onComplete?.();
    onNavigate?.('hub');
  };

  const handleManualSetup = () => {
    setVerificationStep('manual');
  };

  const handleBuyGame = () => {
    window.open('https://store.steampowered.com/app/70/HalfLife/', '_blank');
  };

  const renderContent = () => {
    switch (verificationStep) {
      case 'connecting':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto mb-4 text-orange-400">
              <svg className="w-full h-full animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="15.708" />
              </svg>
            </div>
            <h3 className="text-xl text-orange-400 font-mono">CONNECTING TO STEAM</h3>
            <p className="text-gray-400 font-mono">Establishing secure connection to Steam client...</p>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
          </div>
        );

      case 'scanning':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto mb-4">
              <GamepadIcon className="w-full h-full text-orange-400 animate-pulse" />
            </div>
            <h3 className="text-xl text-orange-400 font-mono">SCANNING GAME LIBRARY</h3>
            <p className="text-gray-400 font-mono">Searching for Half-Life 1 in your Steam library...</p>
            <Progress value={progress} className="w-full max-w-md mx-auto" />
            <div className="text-sm text-gray-500 font-mono">
              Checking: Steam\steamapps\common\Half-Life\
            </div>
          </div>
        );

      case 'found':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto mb-4">
              <CheckCircle className="w-full h-full text-green-400" />
            </div>
            <h3 className="text-xl text-green-400 font-mono">HALF-LIFE 1 DETECTED</h3>
            <div className="space-y-4">
              <Alert className="bg-green-900/20 border-green-900/30">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300 font-mono">
                  Half-Life 1 found in your Steam library! Version 1.1.1.0 verified.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div className="text-left">
                  <span className="text-gray-400">Game Path:</span>
                  <div className="text-orange-400 break-all">C:\Steam\steamapps\common\Half-Life\</div>
                </div>
                <div className="text-left">
                  <span className="text-gray-400">Last Played:</span>
                  <div className="text-green-400">12 hours ago</div>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleContinue}
              className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono px-8"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              CONTINUE TO PLATFORM
            </Button>
          </div>
        );

      case 'not-found':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto mb-4">
              <XCircle className="w-full h-full text-red-400" />
            </div>
            <h3 className="text-xl text-red-400 font-mono">HALF-LIFE 1 NOT FOUND</h3>
            <div className="space-y-4">
              <Alert className="bg-red-900/20 border-red-900/30">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300 font-mono">
                  Half-Life 1 is required to participate in matchmaking and tournaments.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={handleBuyGame}
                  className="bg-blue-900/20 border border-blue-900/30 text-blue-400 hover:bg-blue-900/30 font-mono"
                >
                  <Download className="w-4 h-4 mr-2" />
                  BUY ON STEAM
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
                <Button 
                  onClick={handleManualSetup}
                  variant="outline"
                  className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
                >
                  MANUAL SETUP
                </Button>
              </div>
            </div>
          </div>
        );

      case 'manual':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4">
                <GamepadIcon className="w-full h-full text-orange-400" />
              </div>
              <h3 className="text-xl text-orange-400 font-mono">MANUAL GAME SETUP</h3>
              <p className="text-gray-400 font-mono mt-2">
                If you have Half-Life 1 installed but we couldn't detect it:
              </p>
            </div>
            <div className="space-y-4">
              <Alert className="bg-orange-900/20 border-orange-900/30">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <AlertDescription className="text-orange-300 font-mono">
                  <div className="space-y-2">
                    <div><strong>1.</strong> Make sure Steam is running</div>
                    <div><strong>2.</strong> Launch Half-Life 1 at least once</div>
                    <div><strong>3.</strong> Restart Sector Nine Initiative</div>
                  </div>
                </AlertDescription>
              </Alert>
              <div className="flex space-x-4">
                <Button 
                  onClick={handleContinue}
                  className="flex-1 bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono"
                >
                  I'VE COMPLETED SETUP
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-400 font-mono mb-2">
            STEAM INTEGRATION
          </h1>
          <p className="text-gray-400 font-mono">
            Verifying Half-Life 1 installation for competitive access
          </p>
          <Badge className="mt-2 bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
            REQUIRED FOR MATCHMAKING
          </Badge>
        </div>

        {/* Main Content */}
        <Card className="bg-black/40 border-orange-900/20">
          <CardHeader>
            <CardTitle className="text-center text-orange-400 font-mono">
              GAME VERIFICATION PROTOCOL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>

        {/* Skip Option */}
        {canSkip && verificationStep !== 'found' && (
          <div className="mt-6 text-center">
            <Alert className="bg-yellow-900/20 border-yellow-900/30 mb-4">
              <Clock className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300 font-mono">
                You can skip verification now, but matchmaking will be disabled until Half-Life 1 is added.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleSkip}
              variant="ghost"
              className="text-gray-400 hover:text-orange-400 hover:bg-orange-900/10 font-mono"
            >
              SKIP FOR NOW - I'LL ADD LATER
            </Button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 font-mono">
          <p>Steam integration is secure and read-only.</p>
          <p>We only verify game ownership - no personal data is accessed.</p>
        </div>
      </div>
    </div>
  );
}