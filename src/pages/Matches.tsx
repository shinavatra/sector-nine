import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ArrowRight, ExternalLink } from "lucide-react";

export function Matches() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 font-mono">MATCH OPERATIONS</h1>
        <p className="text-gray-400 font-mono mt-1">Access personnel match history and training records</p>
      </div>

      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono">TRAINING RECORDS ACCESS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🗃️</div>
            <h3 className="text-xl font-mono text-orange-400 mb-2">CLASSIFIED TRAINING RECORDS</h3>
            <p className="text-gray-400 font-mono mb-6 max-w-md mx-auto">
              Individual match history and training performance data has been relocated to personnel files for enhanced security protocols.
            </p>
            <Button className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono">
              <ExternalLink className="w-4 h-4 mr-2" />
              ACCESS PERSONNEL FILE
            </Button>
          </div>
          
          <div className="border-t border-orange-900/20 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/20 border border-orange-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400 font-mono text-sm">Current Training Protocol</span>
                  <Badge className="bg-green-900/20 text-green-400 border-green-900/30 font-mono">
                    ACTIVE
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-orange-400 font-mono">Half-Life 1</div>
                <div className="text-xs text-gray-400 font-mono">Primary Combat Training</div>
              </div>
              
              <div className="p-4 bg-black/20 border border-orange-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400 font-mono text-sm">Security Clearance</span>
                  <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
                    LEVEL 3
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-orange-400 font-mono">RESEARCHER</div>
                <div className="text-xs text-gray-400 font-mono">Authorized Personnel</div>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-orange-400 mt-1">⚠️</div>
              <div>
                <div className="text-orange-400 font-mono text-sm font-semibold">SECURITY NOTICE</div>
                <div className="text-gray-400 font-mono text-sm mt-1">
                  Match history and performance analytics have been classified and moved to individual personnel files. 
                  Access your complete training records through your personnel file dashboard.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}