import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Users } from "lucide-react";
import { toast } from "sonner";

interface MatchReadyAlertProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  matchType: string;
  mapName: string;
  playersReady: number;
  totalPlayers: number;
}

export function MatchReadyAlert({ 
  isOpen, 
  onAccept, 
  onDecline, 
  matchType, 
  mapName, 
  playersReady, 
  totalPlayers 
}: MatchReadyAlertProps) {
  const handleAccept = () => {
    onAccept();
    toast.success("Match accepted!", {
      description: "Connecting to server...",
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
  };

  const handleDecline = () => {
    onDecline();
    toast.info("Match declined", {
      description: "Returning to queue...",
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="bg-black/95 border-2 border-orange-500 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-orange-400 font-mono text-xl flex items-center">
            <Users className="w-6 h-6 mr-2" />
            MATCH READY
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300 font-mono">
            Match details are ready for acceptance
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">MODE:</span>
            <span className="text-orange-400 font-mono">{matchType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">MAP:</span>
            <span className="text-green-400 font-mono">{mapName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">PLAYERS:</span>
            <span className="text-green-400 font-mono">{playersReady}/{totalPlayers}</span>
          </div>
          <div className="mt-4 rounded border border-orange-700/50 bg-orange-900/20 p-3 text-center font-mono text-orange-300">
            Waiting for your backend-recorded response
          </div>
        </div>
        <AlertDialogFooter className="gap-3">
          <AlertDialogCancel 
            onClick={handleDecline}
            className="bg-red-900/20 border-red-700 text-red-400 hover:bg-red-900/30 font-mono"
          >
            DECLINE
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleAccept}
            className="bg-green-900/20 border-green-700 text-green-400 hover:bg-green-900/30 font-mono"
          >
            ACCEPT MATCH
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
