import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { ArrowLeft, Server, Users, Map, Settings, Play, Globe, Shield, Clock } from "lucide-react";
import { useState } from "react";

const serverTemplates = [
  {
    id: 'classic-dm',
    name: 'Classic Deathmatch',
    description: 'Standard deathmatch gameplay',
    maxPlayers: 16,
    defaultMaps: ['dm_crossfire', 'dm_bounce', 'dm_undertow'],
    icon: '🎯'
  },
  {
    id: 'instagib',
    name: 'Instagib Mode',
    description: 'One-shot elimination gameplay',
    maxPlayers: 12,
    defaultMaps: ['dm_killbox', 'dm_crossfire', 'dm_lockdown'],
    icon: '⚡'
  },
  {
    id: 'team-dm',
    name: 'Team Deathmatch',
    description: 'Team-based combat',
    maxPlayers: 20,
    defaultMaps: ['dm_crossfire', 'dm_bounce', 'dm_stalkyard'],
    icon: '👥'
  },
  {
    id: 'tournament',
    name: 'Tournament Mode',
    description: 'Competitive tournament settings',
    maxPlayers: 8,
    defaultMaps: ['dm_crossfire', 'dm_bounce'],
    icon: '🏆'
  }
];

const regions = [
  { id: 'us-east', name: 'US East', ping: '15-30ms' },
  { id: 'us-west', name: 'US West', ping: '20-35ms' },
  { id: 'eu-central', name: 'EU Central', ping: '10-25ms' },
  { id: 'asia-pacific', name: 'Asia Pacific', ping: '25-40ms' }
];

interface ServerHostingProps {
  onNavigate?: (page: string) => void;
}

export function ServerHosting({ onNavigate }: ServerHostingProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [serverName, setServerName] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState<number>(16);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');

  const handleCreateServer = () => {
    // In a real app, this would create the server
    console.log('Creating server:', {
      template: selectedTemplate,
      name: serverName,
      region: selectedRegion,
      maxPlayers,
      isPublic,
      password: password || null
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          onClick={() => onNavigate?.('hub')}
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO HUB
        </Button>
        <h1 className="text-4xl font-bold text-orange-400 font-mono flex items-center">
          <Server className="w-8 h-8 mr-3" />
          SERVER HOSTING
        </h1>
        <p className="text-gray-400 font-mono mt-2">Deploy and manage your own combat servers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Server Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Server Templates */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SERVER TEMPLATES</CardTitle>
              <p className="text-gray-400 font-mono text-sm">Choose a pre-configured server template</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serverTemplates.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedTemplate === template.id
                        ? 'bg-orange-900/20 border-orange-400 ring-2 ring-orange-400/50'
                        : 'bg-black/20 border-orange-900/20 hover:border-orange-400/50'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-3xl mb-2">{template.icon}</div>
                        <h3 className="text-orange-400 font-mono text-sm mb-1">{template.name}</h3>
                        <p className="text-gray-400 font-mono text-xs mb-3">{template.description}</p>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 font-mono">Max Players: {template.maxPlayers}</div>
                          <div className="text-xs text-gray-500 font-mono">Maps: {template.defaultMaps.length}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Server Settings */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SERVER CONFIGURATION</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Server Name</Label>
                  <Input
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="Enter server name..."
                    className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Region</Label>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-gray-300 font-mono">
                      <SelectValue placeholder="Select region..." />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-900/20">
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id} className="text-gray-300 font-mono">
                          {region.name} ({region.ping})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Max Players</Label>
                  <Select value={maxPlayers.toString()} onValueChange={(value) => setMaxPlayers(parseInt(value))}>
                    <SelectTrigger className="bg-black/20 border-orange-900/20 text-gray-300 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-900/20">
                      {[4, 6, 8, 10, 12, 16, 20, 24].map((num) => (
                        <SelectItem key={num} value={num.toString()} className="text-gray-300 font-mono">
                          {num} Players
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Server Visibility</Label>
                  <div className="flex items-center space-x-3">
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                    <span className="text-gray-300 font-mono text-sm">
                      {isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              {!isPublic && (
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Server Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter server password..."
                    className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">ADVANCED OPTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Anti-Cheat</Label>
                    <p className="text-xs text-gray-500 font-mono">Enable VAC protection</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Team Balance</Label>
                    <p className="text-xs text-gray-500 font-mono">Auto-balance teams</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Map Voting</Label>
                    <p className="text-xs text-gray-500 font-mono">Allow map votes</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Spectators</Label>
                    <p className="text-xs text-gray-500 font-mono">Allow spectating</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Server Status */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">DEPLOYMENT STATUS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Template:</span>
                  <span className="text-orange-400 font-mono text-sm">
                    {selectedTemplate ? serverTemplates.find(t => t.id === selectedTemplate)?.name : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Region:</span>
                  <span className="text-orange-400 font-mono text-sm">
                    {selectedRegion ? regions.find(r => r.id === selectedRegion)?.name : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Players:</span>
                  <span className="text-orange-400 font-mono text-sm">{maxPlayers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Visibility:</span>
                  <Badge className={`font-mono text-xs ${
                    isPublic 
                      ? 'bg-green-900/20 text-green-400 border-green-900/30'
                      : 'bg-orange-900/20 text-orange-400 border-orange-900/30'
                  }`}>
                    {isPublic ? 'PUBLIC' : 'PRIVATE'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hosting Cost */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">HOSTING COST</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="text-3xl mb-3">💰</div>
                <div className="text-2xl font-bold text-orange-400 font-mono mb-2">
                  {selectedTemplate ? '50 Points' : '0 Points'}
                </div>
                <div className="text-gray-400 font-mono text-sm mb-4">/hour</div>
                <div className="text-xs text-gray-500 font-mono">
                  Premium subscribers get 50% discount
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deploy Button */}
          <Button
            onClick={handleCreateServer}
            disabled={!selectedTemplate || !serverName || !selectedRegion}
            className="w-full bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono py-3"
          >
            <Play className="w-4 h-4 mr-2" />
            DEPLOY SERVER
          </Button>

          {/* Quick Stats */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">HOSTING STATS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Active Servers:</span>
                  <span className="text-green-400 font-mono text-sm">1,247</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Your Servers:</span>
                  <span className="text-orange-400 font-mono text-sm">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-mono text-sm">Total Players:</span>
                  <span className="text-blue-400 font-mono text-sm">15,892</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}