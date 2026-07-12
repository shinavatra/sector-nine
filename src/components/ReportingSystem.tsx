import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Shield, Flag, UserX, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { reportAPI } from "../utils/api";

interface BlockedPlayer {
  id: string;
  playerId: string;
  playerName: string;
  blockedAt: string;
}

interface ReportingSystemProps {
  currentPlayerId: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
}

const REPORT_CATEGORIES = [
  { value: "cheating",      label: "Cheating/Hacking" },
  { value: "toxic",         label: "Toxic Behavior" },
  { value: "griefing",      label: "Griefing/Sabotage" },
  { value: "harassment",    label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "afk",           label: "AFK/Non-Participation" },
  { value: "other",         label: "Other" },
];

export function ReportingSystem({ currentPlayerId, targetPlayerId, targetPlayerName }: ReportingSystemProps) {
  const [reportCategory, setReportCategory] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [blockedPlayers, setBlockedPlayers] = useState<BlockedPlayer[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`blocked_players_${currentPlayerId}`);
    if (stored) setBlockedPlayers(JSON.parse(stored));
  }, [currentPlayerId]);

  const submitReport = async () => {
    if (!targetPlayerId || !reportCategory || !reportDescription.trim()) {
      toast.error("Missing information", { description: "Please fill in all required fields" });
      return;
    }
    setIsSubmitting(true);
    try {
      await reportAPI.reportPlayer(targetPlayerId, reportCategory, reportDescription.trim());
      toast.success("Report submitted", { description: "Thank you for helping keep the community safe" });
      setReportCategory("");
      setReportDescription("");
      setShowReportDialog(false);
    } catch (error) {
      toast.error("Failed to submit report", { description: "Please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const blockPlayer = () => {
    if (!targetPlayerId) return;
    if (blockedPlayers.some(p => p.playerId === targetPlayerId)) {
      toast.error("Player already blocked");
      return;
    }
    const newBlock: BlockedPlayer = {
      id: Date.now().toString(),
      playerId: targetPlayerId,
      playerName: targetPlayerName || targetPlayerId,
      blockedAt: new Date().toISOString(),
    };
    const updated = [...blockedPlayers, newBlock];
    setBlockedPlayers(updated);
    localStorage.setItem(`blocked_players_${currentPlayerId}`, JSON.stringify(updated));
    toast.success("Player blocked", { description: "You won't be matched with this player in regular matches" });
    setShowBlockDialog(false);
  };

  const unblockPlayer = (playerId: string) => {
    const updated = blockedPlayers.filter(p => p.playerId !== playerId);
    setBlockedPlayers(updated);
    localStorage.setItem(`blocked_players_${currentPlayerId}`, JSON.stringify(updated));
    toast.info("Player unblocked");
  };

  const isBlocked = (id: string) => blockedPlayers.some(p => p.playerId === id);

  return (
    <div className="space-y-6">
      {targetPlayerId && (
        <div className="flex space-x-3">
          <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="font-mono">
                <Flag className="w-4 h-4 mr-2" />
                REPORT PLAYER
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black/95 border-2 border-red-500">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-400 font-mono flex items-center">
                  <Flag className="w-5 h-5 mr-2" />
                  REPORT: {targetPlayerName}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300 font-mono">
                  Submit a report for violating community guidelines.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 font-mono text-sm">VIOLATION CATEGORY</label>
                  <Select value={reportCategory} onValueChange={setReportCategory}>
                    <SelectTrigger className="bg-black/20 border-red-700/50 text-red-400 font-mono">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-red-700/50">
                      {REPORT_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value} className="text-red-400 font-mono">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-gray-400 font-mono text-sm">DESCRIPTION</label>
                  <Textarea
                    value={reportDescription}
                    onChange={e => setReportDescription(e.target.value)}
                    placeholder="Describe what happened..."
                    className="bg-black/20 border-red-700/50 text-red-400 font-mono"
                    rows={3}
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700/20 border-gray-600 text-gray-400 font-mono">
                  CANCEL
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={submitReport}
                  disabled={isSubmitting}
                  className="bg-red-900/20 border-red-700 text-red-400 hover:bg-red-900/30 font-mono"
                >
                  {isSubmitting ? "SUBMITTING..." : "SUBMIT REPORT"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isBlocked(targetPlayerId)}
                className="border-orange-700/50 text-orange-400 hover:bg-orange-900/20 font-mono"
              >
                <UserX className="w-4 h-4 mr-2" />
                {isBlocked(targetPlayerId) ? "BLOCKED" : "BLOCK PLAYER"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black/95 border-2 border-orange-500">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-orange-400 font-mono flex items-center">
                  <UserX className="w-5 h-5 mr-2" />
                  BLOCK: {targetPlayerName}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300 font-mono">
                  <div className="space-y-2">
                    <p>This will prevent you from being matched with this player.</p>
                    <div className="p-3 bg-orange-900/20 border border-orange-700/50 rounded">
                      <p className="text-orange-400 text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        NOTE: Blocking does not apply to tournament matches.
                      </p>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700/20 border-gray-600 text-gray-400 font-mono">
                  CANCEL
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={blockPlayer}
                  className="bg-orange-900/20 border-orange-700 text-orange-400 hover:bg-orange-900/30 font-mono"
                >
                  BLOCK PLAYER
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            BLOCKED PLAYERS ({blockedPlayers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blockedPlayers.length === 0 ? (
            <p className="text-gray-400 font-mono text-center py-4">No blocked players</p>
          ) : (
            <div className="space-y-2">
              {blockedPlayers.map(blocked => (
                <div key={blocked.id} className="flex justify-between items-center p-3 bg-black/20 rounded border border-gray-700/30">
                  <div className="flex items-center space-x-3">
                    <UserX className="w-4 h-4 text-orange-400" />
                    <span className="text-orange-400 font-mono">{blocked.playerName}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {new Date(blocked.blockedAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unblockPlayer(blocked.playerId)}
                    className="border-green-700/50 text-green-400 hover:bg-green-900/20 font-mono text-xs"
                  >
                    UNBLOCK
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const isPlayerBlockedBy = (blockerId: string, targetId: string): boolean => {
  const stored = localStorage.getItem(`blocked_players_${blockerId}`);
  if (!stored) return false;
  return JSON.parse(stored).some((p: any) => p.playerId === targetId);
};

export const getBlockedPlayers = (playerId: string): string[] => {
  const stored = localStorage.getItem(`blocked_players_${playerId}`);
  if (!stored) return [];
  return JSON.parse(stored).map((p: any) => p.playerId);
};
