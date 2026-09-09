import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, ExternalLink, Loader2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { steamAPI } from "../utils/api";
import { initiateSteamLogin } from "../utils/steamAuth";
import { toast } from "sonner";

interface SteamGameVerificationProps {
  onNavigate?: (page: string) => void;
  onComplete?: () => void;
}

type VerificationStatus = {
  linked: boolean;
  profileVisibility?: "public" | "private" | "unknown";
  gamesVisible?: boolean;
  ownsHL1?: boolean;
  verified?: boolean;
  vac?: { banned: boolean; count: number };
  gameBans?: { banned: boolean; count: number };
  verification?: { code: string; message: string };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Steam verification could not be completed.";

export function SteamGameVerification({ onNavigate, onComplete }: SteamGameVerificationProps) {
  const { user, adoptProfile } = useUser();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    if (!user?.steamId) {
      setStatus({ linked: false });
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const response = await steamAPI.refresh();
      setStatus(response.steam);
      if (response.profile) adoptProfile(response.profile);
    } catch (verificationError) {
      setError(getErrorMessage(verificationError));
    } finally {
      setIsVerifying(false);
    }
  }, [adoptProfile, user?.steamId]);

  useEffect(() => {
    void verify();
  }, [verify]);

  const continueToPlatform = () => {
    toast.success("Steam verification complete", {
      description: "Your account is eligible for Sector Nine matchmaking.",
    });
    onComplete?.();
    onNavigate?.("hub");
  };

  const skip = () => {
    onComplete?.();
    onNavigate?.("hub");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-mono text-3xl font-bold text-orange-400">STEAM VERIFICATION</h1>
          <p className="font-mono text-gray-400">Server-side account and Half-Life ownership verification</p>
          <Badge className="mt-2 border-orange-900/30 bg-orange-900/20 font-mono text-orange-400">
            REQUIRED FOR MATCHMAKING
          </Badge>
        </div>

        <Card className="border-orange-900/20 bg-black/40">
          <CardHeader>
            <CardTitle className="text-center font-mono text-orange-400">VERIFICATION STATUS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6 md:p-8">
            {isVerifying && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <Loader2 className="h-14 w-14 animate-spin text-orange-400" />
                <div>
                  <h3 className="font-mono text-lg text-orange-400">CHECKING STEAM</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Steam is returning your current profile, library, level, and ban status.
                  </p>
                </div>
              </div>
            )}

            {!isVerifying && error && (
              <>
                <Alert className="border-red-900 bg-red-950/50">
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
                <Button onClick={verify} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry verification
                </Button>
              </>
            )}

            {!isVerifying && !error && status && !status.linked && (
              <div className="space-y-5 text-center">
                <XCircle className="mx-auto h-14 w-14 text-yellow-400" />
                <div>
                  <h3 className="font-mono text-lg text-yellow-300">STEAM ACCOUNT NOT CONNECTED</h3>
                  <p className="mt-2 text-sm text-gray-400">
                    Sign in through Steam OpenID first. Sector Nine never receives your Steam password.
                  </p>
                </div>
                <Button onClick={() => void initiateSteamLogin('link').catch(error => toast.error("Steam connection failed", { description: error instanceof Error ? error.message : "Unable to connect to Steam" }))} className="bg-blue-700 hover:bg-blue-800">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Steam
                </Button>
              </div>
            )}

            {!isVerifying && !error && status?.linked && (
              <>
                <Alert className={status.verified ? "border-green-900 bg-green-950/40" : "border-yellow-900 bg-yellow-950/40"}>
                  {status.verified
                    ? <CheckCircle className="h-4 w-4 text-green-400" />
                    : <ShieldAlert className="h-4 w-4 text-yellow-400" />}
                  <AlertDescription className={status.verified ? "text-green-200" : "text-yellow-200"}>
                    {status.verification?.message || "Steam returned an incomplete verification result."}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <CheckRow label="Profile details are public" passed={status.profileVisibility === "public"} />
                  <CheckRow label="Game details are public" passed={Boolean(status.gamesVisible)} />
                  <CheckRow label="Half-Life is owned" passed={Boolean(status.ownsHL1)} />
                  <CheckRow label={`No VAC bans (${status.vac?.count ?? 0})`} passed={!status.vac?.banned} />
                  <CheckRow label={`No game bans (${status.gameBans?.count ?? 0})`} passed={!status.gameBans?.banned} />
                </div>

                {(status.verification?.code === "STEAM_PROFILE_PRIVATE" ||
                  status.verification?.code === "STEAM_GAMES_PRIVATE") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open("https://steamcommunity.com/my/edit/settings", "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Steam privacy settings
                  </Button>
                )}
                {status.verification?.code === "HL1_NOT_OWNED" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open("https://store.steampowered.com/app/70/HalfLife/", "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Half-Life on Steam
                  </Button>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" onClick={verify}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh and check again
                  </Button>
                  {status.verified ? (
                    <Button onClick={continueToPlatform} className="bg-green-800 hover:bg-green-700">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Continue to platform
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={skip}>Skip for now</Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-500">
          Verification uses Steam&apos;s Web API and cached PostgreSQL data. No local files are scanned.
        </p>
      </div>
    </div>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/30 p-3">
      <span className="text-sm text-gray-300">{label}</span>
      {passed
        ? <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
        : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
    </div>
  );
}
