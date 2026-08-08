import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Gamepad2 as GamepadIcon, Info, Shield, CheckCircle2, ExternalLink } from "lucide-react";
import { initiateSteamLogin, isInIframe } from "../utils/steamAuth";
import { useUser } from "../contexts/UserContext";
import { toast } from "sonner";

interface SteamSetupProps {
  onNavigate: (page: string) => void;
}

export function SteamSetup({ onNavigate }: SteamSetupProps) {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSteamConnect = async () => {
    setIsConnecting(true);
    
    try {
      // Check if we're in a secure context
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("Secure connection required", {
          description: "Steam login requires HTTPS in production environments.",
          className: "bg-red-900/90 border-red-700 text-red-100"
        });
        setIsConnecting(false);
        return;
      }

      // Check if in iframe
      if (isInIframe()) {
        toast.info("Opening Steam login", {
          description: "Steam login will open in a new window. Please allow popups if blocked.",
          className: "bg-blue-900/90 border-blue-700 text-blue-100"
        });
      }

      // Initiate Steam OpenID authentication
      await initiateSteamLogin();
      
      // Don't reset loading if in iframe (user needs to complete in new window)
      if (!isInIframe()) {
        // Loading will continue until redirect
      }
    } catch (error) {
      console.error('Steam connection error:', error);
      setIsConnecting(false);
      toast.error("Steam connection failed", {
        description: error instanceof Error ? error.message : "Unable to connect to Steam. Please try again.",
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
    }
  };

  const handleSkip = () => {
    toast.warning("Steam linking skipped", {
      description: "You can link your Steam account later in Profile settings",
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
    onNavigate('hub');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="bg-black/40 border-orange-900/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-orange-900/20 rounded-full">
                <GamepadIcon className="w-12 h-12 text-orange-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-orange-400 font-mono">STEAM INTEGRATION</CardTitle>
            <p className="text-gray-400 font-mono text-sm mt-2">
              Link your Steam account to verify Half-Life 1 ownership
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {user?.steamId ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-16 h-16 text-green-400" />
                </div>
                <div>
                  <h3 className="text-green-400 font-mono text-lg mb-2">STEAM ACCOUNT LINKED</h3>
                  <p className="text-gray-400 font-mono text-sm">
                    Your Steam account is already connected
                  </p>
                  {user.steamVerified && (
                    <Badge className="bg-green-900/20 text-green-400 border-green-900/30 font-mono mt-2">
                      HALF-LIFE 1 VERIFIED ✓
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => onNavigate('hub')}
                  className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                >
                  CONTINUE TO PLATFORM
                </Button>
              </div>
            ) : (
              <>
                <Alert className="border-blue-900/20 bg-blue-900/10">
                  <Shield className="w-4 h-4" />
                  <AlertDescription className="text-blue-400 font-mono text-sm">
                    Steam integration is required to access competitive matches and tournaments. 
                    Half-Life 1 must be in your Steam library.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="text-center p-6 bg-black/20 rounded-lg border border-orange-900/10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                      <ExternalLink className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-orange-400 font-mono mb-2">Secure Steam Authentication</h3>
                    <p className="text-sm text-gray-400 font-mono mb-4">
                      You'll be redirected to Steam to securely authorize this platform
                    </p>
                    <Button
                      onClick={handleSteamConnect}
                      disabled={isConnecting}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-mono px-6 py-3"
                    >
                      {isConnecting ? (
                        <>
                          <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          CONNECTING...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          SIGN IN THROUGH STEAM
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-green-900/10 border border-green-900/20 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                        <div>
                          <div className="text-green-400 font-mono text-xs">SECURE</div>
                          <div className="text-gray-400 font-mono text-xs">OpenID authentication</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-green-900/10 border border-green-900/20 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                        <div>
                          <div className="text-green-400 font-mono text-xs">PRIVATE</div>
                          <div className="text-gray-400 font-mono text-xs">No credentials stored</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSkip}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-400 hover:bg-gray-800 font-mono"
                  >
                    SKIP FOR NOW
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t border-orange-900/20">
                  <h3 className="text-orange-400 font-mono text-sm">WHAT HAPPENS NEXT:</h3>
                  <div className="space-y-2 text-xs text-gray-400 font-mono">
                    <div className="flex items-start space-x-2">
                      <span className="text-orange-400">1.</span>
                      <span>You'll be redirected to Steam's secure login page</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-orange-400">2.</span>
                      <span>Steam will ask you to authorize Sector Nine Initiative</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-orange-400">3.</span>
                      <span>We'll verify Half-Life 1 ownership and link your account</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-orange-400">4.</span>
                      <span>You'll be redirected back to the platform</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
