import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { authenticateSteamCallback, markSteamCallbackCompleted, wasSteamCallbackCompleted } from "../utils/steamAuth";
import { ApiError, getSessionToken, logFrontendAuthEvent } from "../utils/api";
import { toast } from "sonner";

interface SteamCallbackProps {
  onNavigate: (page: string) => void;
  onLogin: (isNewUser?: boolean) => void | Promise<void>;
}

export function SteamCallback({
  onNavigate,
  onLogin,
}: SteamCallbackProps) {
  const [status, setStatus] = useState<
    "processing" | "success" | "error"
  >("processing");

  const [message, setMessage] = useState(
    "Processing Steam authentication..."
  );

  const [steamProfile, setSteamProfile] = useState<any>(null);
  const [ownsHalfLife, setOwnsHalfLife] = useState(false);

  const [vacStatus, setVacStatus] = useState<
    "clean" | "banned" | "unknown"
  >("unknown");
  const processingStarted = useRef(false);

  useEffect(() => {
    logFrontendAuthEvent('steam_callback_mounted');
    if (wasSteamCallbackCompleted() && getSessionToken()) {
      logFrontendAuthEvent('steam_callback_navigation_started', { destination: 'hub', reason: 'already_completed' });
      void Promise.resolve().then(() => onLogin(false)).catch(() => onNavigate("auth"));
      return () => logFrontendAuthEvent('steam_callback_unmounted');
    }
    if (!processingStarted.current) {
      processingStarted.current = true;
      void handleSteamCallback();
    }
    return () => logFrontendAuthEvent('steam_callback_unmounted');
  }, []);

  const handleSteamCallback = async () => {
    let steamAuthenticationSucceeded = false;
    try {
      logFrontendAuthEvent('steam_callback_processing_started');
      // The server verifies Steam's signed OpenID response before returning a JWT.
      const linkResult = await authenticateSteamCallback(window.location.href);
      logFrontendAuthEvent('steam_callback_frontend_received', {
        authIntent: linkResult.authIntent === "link" ? "link" : "login",
        createdAccount: linkResult.createdAccount === true,
      });
      markSteamCallbackCompleted();
      steamAuthenticationSucceeded = true;
      logFrontendAuthEvent('steam_callback_auth_success', { authIntent: linkResult.authIntent === "link" ? "link" : "login" });
      const profile = linkResult.profile;
      const intent = linkResult.authIntent === "link" ? "link" : "login";
      const createdAccount = linkResult.createdAccount === true;
      const hasHalfLife = profile.ownsHL1 === true;
      const isVacBanned = profile.vacBanned === true;
      const isGameBanned = profile.gameBanned === true;

      setSteamProfile({
        steamId: profile.steamId,
        username:
          profile.displayName ||
          profile.username ||
          "Steam Player",
        avatar: profile.steamAvatar,
        profileUrl: profile.steamProfileUrl,
      });

      setOwnsHalfLife(hasHalfLife);
      setVacStatus(
        isVacBanned || isGameBanned ? "banned" : "clean"
      );

      setStatus("success");
      setMessage(createdAccount
        ? "Creating Sector Nine account..."
        : intent === "link"
          ? "Steam account connected. Signing you in..."
          : "Signing you in...");

      await onLogin(false);
      toast.success(intent === "link" ? "Steam account connected" : "Steam authentication complete", {
        description: createdAccount
          ? "Your Sector Nine account was created from your verified Steam identity."
          : "Your Sector Nine session is ready.",
        className: "bg-green-900/90 border-green-700 text-green-100",
      });
      logFrontendAuthEvent('steam_callback_success_toast');
    } catch (error) {
      const isLinkConflict = error instanceof ApiError && error.code === "STEAM_ACCOUNT_ALREADY_LINKED";
      setStatus("error");
      setMessage(isLinkConflict
        ? "This Steam account is already linked to another Sector Nine account."
        : error instanceof Error ? error.message : "An unexpected Steam error occurred");

      toast.error("Steam authentication failed", {
        description: isLinkConflict
          ? "Sector Nine did not change either account."
          : "Your existing Sector Nine session remains active. Please try again later.",
        className: "bg-red-900/90 border-red-700 text-red-100",
      });
      logFrontendAuthEvent('steam_callback_failure_toast', { postAuthFailure: steamAuthenticationSucceeded });

      if (!steamAuthenticationSucceeded && getSessionToken()) {
        logFrontendAuthEvent('steam_callback_navigation_started', { destination: 'hub', reason: 'existing_session' });
        try {
          await onLogin(false);
        } catch {
          onNavigate("auth");
        }
      } else {
        onNavigate("auth");
      }
    } finally {
      // Steam signs the return_to URL, so clean it only after server verification.
      // replaceState removes the sensitive OpenID response without reloading or
      // changing the current Sector Nine session.
      if (window.location.pathname === '/auth/steam/callback') {
        window.history.replaceState({}, document.title, '/auth/steam/callback');
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case "processing":
        return (
          <div className="text-center space-y-6">
            <Loader2 className="w-16 h-16 mx-auto text-orange-400 animate-spin" />

            <h3 className="text-xl text-orange-400 font-mono">
              AUTHENTICATING WITH STEAM
            </h3>

            <p className="text-gray-400 font-mono">
              {message}
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="w-16 h-16 mx-auto text-green-400" />

            <h3 className="text-xl text-green-400 font-mono">
              AUTHENTICATION SUCCESSFUL
            </h3>

            <Alert className="bg-green-900/20 border-green-900/30">
              <Shield className="h-4 w-4 text-green-400" />

              <AlertDescription className="text-green-300 font-mono">
                {message}
              </AlertDescription>
            </Alert>

            {steamProfile && (
              <div className="flex items-center justify-center space-x-3 p-4 bg-black/40 rounded-lg border border-green-900/30">
                {steamProfile.avatar && (
                  <img
                    src={steamProfile.avatar}
                    alt={steamProfile.username}
                    className="w-12 h-12 rounded-full border-2 border-green-900/30"
                  />
                )}

                <div className="text-left">
                  <div className="text-green-400 font-mono">
                    {steamProfile.username}
                  </div>

                  <div className="text-xs text-gray-400 font-mono">
                    Half-Life 1 verified ✓
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-400 font-mono">
              Redirecting to platform...
            </p>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-6">
            <XCircle className="w-16 h-16 mx-auto text-red-400" />

            <h3 className="text-xl text-red-400 font-mono">
              STEAM AUTHENTICATION FAILED
            </h3>

            <Alert className="bg-red-900/20 border-red-900/30">
              <XCircle className="h-4 w-4 text-red-400" />

              <AlertDescription className="text-red-300 font-mono">
                {message}
              </AlertDescription>
            </Alert>

            {steamProfile && !ownsHalfLife && (
              <div>
                <p className="text-sm text-gray-400 font-mono mb-3">
                  Your Steam account remains linked, but Half-Life 1
                  is required for matchmaking.
                </p>

                <a
                  href="https://store.steampowered.com/app/70/HalfLife/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-900/20 border border-blue-900/30 text-blue-400 hover:bg-blue-900/30 font-mono rounded transition-colors"
                >
                  GET HALF-LIFE ON STEAM
                </a>
              </div>
            )}

            {vacStatus === "banned" && (
              <p className="text-sm text-gray-400 font-mono">
                VAC or game-banned accounts cannot access
                matchmaking.
              </p>
            )}

            <p className="text-sm text-gray-400 font-mono">
              You remain logged in. Redirecting to the hub...
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-400 font-mono mb-2">
            STEAM INTEGRATION
          </h1>

          <Badge className="mt-2 bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
            SECURE AUTHENTICATION
          </Badge>
        </div>

        <Card className="bg-black/40 border-orange-900/20">
          <CardHeader>
            <CardTitle className="text-center text-orange-400 font-mono">
              PROCESSING STEAM CREDENTIALS
            </CardTitle>
          </CardHeader>

          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-500 font-mono">
          <p>Secure OpenID authentication via Steam</p>
          <p>Your Steam password is never stored by Sector Nine</p>
        </div>
      </div>
    </div>
  );
}
