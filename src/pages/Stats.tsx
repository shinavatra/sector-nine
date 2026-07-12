import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Target, Trophy, Zap, Activity, Calendar, Award, Users } from "lucide-react";
import { useUser } from "../contexts/UserContext";

interface StatsProps {
  onNavigate?: (page: string) => void;
}

export function Stats({ onNavigate }: StatsProps) {
  const { user } = useUser();

  // Use actual user stats or defaults
  const currentRating = user?.stats?.rating || 0;
  const winRate = user?.stats?.winRate || 0;
  const totalMatches = (user?.stats?.wins || 0) + (user?.stats?.losses || 0);
  const kda = user?.stats?.kda || "0.00";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 font-mono">RESEARCH STATISTICS</h1>
        <p className="text-gray-400 font-mono mt-1">Comprehensive analysis of experimental performance</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-black/40 border-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-900/20 rounded-lg">
                <Trophy className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400 font-mono">{currentRating}</div>
                <div className="text-sm text-gray-400 font-mono">Current Rating</div>
              </div>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-mono text-sm">Track your progress</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-900/20 rounded-lg">
                <Target className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400 font-mono">{winRate}%</div>
                <div className="text-sm text-gray-400 font-mono">Win Rate</div>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={winRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-900/20 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400 font-mono">{totalMatches}</div>
                <div className="text-sm text-gray-400 font-mono">Total Matches</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-400 font-mono">
              {user?.stats?.wins || 0}W / {user?.stats?.losses || 0}L
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-900/20 rounded-lg">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400 font-mono">{kda}</div>
                <div className="text-sm text-gray-400 font-mono">K/D Ratio</div>
              </div>
            </div>
            <div className="mt-3 text-sm text-green-400 font-mono">
              Combat Efficiency
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="performance" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            PERFORMANCE
          </TabsTrigger>
          <TabsTrigger value="games" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            GAME ANALYSIS
          </TabsTrigger>
          <TabsTrigger value="weapons" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            EQUIPMENT
          </TabsTrigger>
          <TabsTrigger value="maps" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            MAP DATA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">RATING PROGRESSION</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-orange-400 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400 font-mono">NO PERFORMANCE DATA AVAILABLE</p>
                  <p className="text-gray-500 font-mono text-sm mt-2">Play more matches to see your progress</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">MATCH ACTIVITY</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-green-400 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400 font-mono">NO ACTIVITY DATA AVAILABLE</p>
                  <p className="text-gray-500 font-mono text-sm mt-2">Complete matches to see your activity</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">GAME STATISTICS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 font-mono">NO GAME DATA AVAILABLE</p>
                <p className="text-gray-500 font-mono text-sm mt-2">Play matches to see your game statistics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weapons" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">WEAPON STATISTICS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Zap className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 font-mono">NO WEAPON DATA AVAILABLE</p>
                <p className="text-gray-500 font-mono text-sm mt-2">Use weapons in matches to see statistics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">MAP PERFORMANCE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Award className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 font-mono">NO MAP DATA AVAILABLE</p>
                <p className="text-gray-500 font-mono text-sm mt-2">Play on different maps to see your performance</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
