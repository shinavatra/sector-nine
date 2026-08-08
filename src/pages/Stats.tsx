import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Target, Trophy, Zap, Activity, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { useGame } from "../contexts/GameContext";
import { statsAPI } from "../utils/api";

interface StatsProps {
  onNavigate?: (page: string) => void;
}

export function Stats({ onNavigate }: StatsProps) {
  const { selectedGame } = useGame();
  const [gameStats,setGameStats]=useState<any>(null);
  const [ratingHistory,setRatingHistory]=useState<any[]>([]);

  useEffect(()=>{let active=true;Promise.all([statsAPI.getUserStats(selectedGame.id),statsAPI.getRatingHistory(selectedGame.id)]).then(([stats,history])=>{if(active){setGameStats(stats?.stats||null);setRatingHistory(Array.isArray(history?.history)?history.history:[])}}).catch(()=>{if(active){setGameStats(null);setRatingHistory([])}});return()=>{active=false}},[selectedGame.id]);

  // Use actual user stats or defaults
  const currentRating = Number(gameStats?.rating)||0;
  const placementMatches=Math.min(5,Number(gameStats?.placement_matches_played)||0);
  const placementComplete=Boolean(gameStats?.placement_complete);
  const winRate = Number(gameStats?.win_rate)||0;
  const totalMatches = Number(gameStats?.matches_played)||0;
  const kda = Number(gameStats?.total_deaths)>0?(Number(gameStats?.total_kills)/Number(gameStats?.total_deaths)).toFixed(2):Number(gameStats?.total_kills||0).toFixed(2);
  const ratingChart=ratingHistory.map((entry,index)=>({match:index+1,rating:Number(entry.rating_after),delta:Number(entry.rating_delta),date:new Date(entry.created_at).toLocaleDateString()}));
  const activityChart=Array.from(ratingHistory.reduce((days:Map<string,number>,entry)=>{const day=new Date(entry.created_at).toLocaleDateString();days.set(day,(days.get(day)||0)+1);return days},new Map<string,number>())).map(([date,matches])=>({date,matches}));

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
              <span className="text-green-400 font-mono text-sm">{placementComplete?'Rank established':`Placement ${placementMatches}/5`}</span>
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
          {Number(gameStats?.wins)||0}W / {Number(gameStats?.losses)||0}L
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
                {ratingChart.length?<div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={ratingChart} margin={{top:8,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#3f2a1f"/><XAxis dataKey="match" stroke="#9ca3af" fontSize={11}/><YAxis stroke="#9ca3af" fontSize={11}/><Tooltip contentStyle={{background:'#0b0b0b',border:'1px solid #7c2d12'}}/><Line type="monotone" dataKey="rating" stroke="#fb923c" strokeWidth={2}/></LineChart></ResponsiveContainer></div>:<div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-orange-400 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400 font-mono">NO PERFORMANCE DATA AVAILABLE</p>
                  <p className="text-gray-500 font-mono text-sm mt-2">Play more matches to see your progress</p>
                </div>}
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">MATCH ACTIVITY</CardTitle>
              </CardHeader>
              <CardContent>
                {activityChart.length?<div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityChart} margin={{top:8,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="#173c2c"/><XAxis dataKey="date" stroke="#9ca3af" fontSize={10}/><YAxis allowDecimals={false} stroke="#9ca3af" fontSize={11}/><Tooltip contentStyle={{background:'#0b0b0b',border:'1px solid #166534'}}/><Bar dataKey="matches" fill="#4ade80"/></BarChart></ResponsiveContainer></div>:<div className="text-center py-8">
                  <Activity className="w-12 h-12 text-green-400 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400 font-mono">NO ACTIVITY DATA AVAILABLE</p>
                  <p className="text-gray-500 font-mono text-sm mt-2">Complete matches to see your activity</p>
                </div>}
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
