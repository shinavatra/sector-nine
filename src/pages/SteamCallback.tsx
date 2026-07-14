import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { linkSteamAccount } from "../utils/steamAuth";
import { validateSteamCallback } from "../utils/steamDebug";
import { toast } from "sonner";

interface SteamCallbackProps {
  onNavigate: (page: string) => void;
  onLogin: (isNewUser?: boolean) => void;
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

  useEffect(() => {
    void handleSteamCallback();
  }, []);

  const returnToHub = (delay = 4000) => {
  window.setTimeout(() => {
    onLogin(false);
  }, delay);
};

  const handleSteamCallback = async () => {
    try {
      console.log("Processing Steam callback:", window.location.href);

      const validation = validateSteamCallback(window.location.href);

      if (!validation.isValid) {
        const errorMessage =
          validation.errors[0] || "Invalid Steam callback";

        setStatus("error");
        setMessage(errorMessage);

        toast.error("Steam authentication failed", {
          description: errorMessage,
          className: "bg-red-900/90 border-red-700 text-red-100",
        });

        // Ne brišemo sesiju. Vraćamo korisnika na hub.
        returnToHub();
        return;
      }

      const steamId = validation.steamId;

      if (!steamId) {
        setStatus("error");
        setMessage("Failed to extract Steam ID");

        toast.error("Steam authentication failed", {
          description: "Could not retrieve Steam ID",
          className: "bg-red-900/90 border-red-700 text-red-100",
        });

        returnToHub();
        return;
      }

      setMessage(`Steam ID found: ${steamId}`);

      /*
       * Jedan backend poziv sada:
       * - učita Steam profil
       * - provjeri HL1
       * - provjeri VAC/game ban
       * - sačuva rezultat u PostgreSQL
       */
      const linkResult = await linkSteamAccount(steamId);

      if (!linkResult?.profile) {
        setStatus("error");
        setMessage(
          "Steam account could not be linked. Make sure you are logged in."
        );

        toast.error("Steam linking failed", {
          description:
            "Your Steam account could not be linked to this Sector Nine account.",
          className: "bg-red-900/90 border-red-700 text-red-100",
        });

        // Ne pozivamo logout.
        returnToHub();
        return;
      }

      const profile = linkResult.profile;
      const hasHalfLife = linkResult.ownsHL1 === true;
      const isVacBanned = linkResult.hasVacBan === true;
      const isGameBanned = linkResult.hasGameBan === true;

      setSteamProfile({
        steamId: profile.steamId || steamId,
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

      if (!hasHalfLife) {
        setStatus("error");
        setMessage(
          "Steam account linked, but Half-Life 1 was not found in the library."
        );

        toast.error("Half-Life 1 not found", {
          description:
            "You remain logged in, but matchmaking is unavailable until HL1 is verified.",
          className: "bg-red-900/90 border-red-700 text-red-100",
        });

        // Korisnik ostaje prijavljen.
        returnToHub(5000);
        return;
      }

      if (isVacBanned || isGameBanned) {
        setStatus("error");
        setMessage(
          "Steam account linked, but it is not eligible for matchmaking."
        );

        toast.error("Steam account restricted", {
          description:
            "VAC or game-banned accounts cannot join matchmaking.",
          className: "bg-red-900/90 border-red-700 text-red-100",
        });

        // Korisnik ostaje prijavljen, samo nema matchmaking.
        returnToHub(5000);
        return;
      }

      setStatus("success");
      setMessage("Steam account linked and verified!");

      toast.success("Steam integration complete", {
        description: "Half-Life 1 ownership verified successfully.",
        className: "bg-green-900/90 border-green-700 text-green-100",
      });

      window.setTimeout(() => {
        /*
         * Ovo treba ponovo učitati korisnički profil.
         * Ako onLogin kod tebe samo mijenja ekran, i dalje je u redu.
         */
        onLogin(false);
      }, 2000);
    } catch (error) {
      console.error("Steam callback error:", error);

      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected Steam error occurred"
      );

      toast.error("Steam authentication failed", {
        description:
          "Your Sector Nine session remains active. Please try again later.",
        className: "bg-red-900/90 border-red-700 text-red-100",
      });

      // Nikakav logout i nikakav redirect na auth.
      returnToHub();
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
              STEAM VERIFICATION INCOMPLETE
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