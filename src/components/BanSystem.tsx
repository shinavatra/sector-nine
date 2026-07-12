import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertTriangle, Clock, Shield } from "lucide-react";
import { toast } from "sonner";
import { reportAPI } from "../utils/api";

interface BanRecord {
  id: string;
  reason: string;
  ban_level: number;
  duration_minutes: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export function BanSystem() {
  const [currentBan, setCurrentBan] = useState<BanRecord | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBanStatus();
  }, []);

  // Countdown timer when there is an active ban
  useEffect(() => {
    if (!currentBan) return;

    const timer = setInterval(() => {
      const timeLeft = new Date(currentBan.expires_at).getTime() - Date.now();
      if (timeLeft <= 0) {
        setCurrentBan(null);
        setTimeRemaining("");
        toast.success("Ban lifted", {
          description: "You can now participate in matches again",
        });
      } else {
        const minutes = Math.floor(timeLeft / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentBan]);

  const checkBanStatus = async () => {
    try {
      const { ban } = await reportAPI.getBanStatus();
      setCurrentBan(ban || null);
    } catch (error) {
      console.error("Failed to check ban status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      {currentBan && (
        <Card className="bg-red-900/20 border-red-700/50">
          <CardHeader>
            <CardTitle className="text-red-400 font-mono flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              ACTIVE PENALTY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 font-mono">REASON:</span>
                <span className="text-red-400 font-mono">{currentBan.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-mono">DURATION:</span>
                <span className="text-red-400 font-mono">{formatDuration(currentBan.duration_minutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-mono">TIME LEFT:</span>
                <span className="text-red-400 font-mono font-bold">{timeRemaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-mono">OFFENSE LEVEL:</span>
                <Badge variant="destructive" className="font-mono">
                  #{currentBan.ban_level}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!currentBan && (
        <Card className="bg-black/40 border-orange-900/20">
          <CardHeader>
            <CardTitle className="text-orange-400 font-mono flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              MATCHMAKING STATUS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-green-400 font-mono">
              <Clock className="w-4 h-4" />
              <span>No active penalties — you are clear to play</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
