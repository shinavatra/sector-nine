import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Settings as SettingsIcon, User, Globe, Eye, MessageCircle, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SettingsProps {
  playerId: string;
}

export function Settings({ playerId }: SettingsProps) {
  const [settings, setSettings] = useState({
    // Profile Settings
    displayName: "Player_001",
    bio: "",
    location: "",
    preferredLanguage: "en",
    
    // Privacy Settings
    profileVisibility: "friends",
    showOnlineStatus: true,
    showMatchHistory: true,
    allowFriendRequests: true,
    allowDirectMessages: true,
    
    // Gameplay Preferences
    preferredGameModes: ["classic", "instagib"],
    autoAcceptMatches: false,
    allowSpectators: true,
    crossPlatformPlay: true,
    
    // Interface Settings
    theme: "dark",
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    
    // Accessibility
    colorBlindSupport: false,
    highContrast: false,
    reducedMotion: false,
    fontSize: "normal"
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem(`player_settings_${playerId}`, JSON.stringify(settings));
    toast.success("Settings saved", {
      description: "Your preferences have been updated",
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Settings */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <User className="w-5 h-5 mr-2" />
            PROFILE CONFIGURATION
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400 font-mono">DISPLAY NAME</Label>
              <Input
                value={settings.displayName}
                onChange={(e) => updateSetting('displayName', e.target.value)}
                className="bg-black/20 border-orange-900/20 text-orange-400 font-mono"
                maxLength={20}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-400 font-mono">LOCATION</Label>
              <Input
                value={settings.location}
                onChange={(e) => updateSetting('location', e.target.value)}
                className="bg-black/20 border-orange-900/20 text-orange-400 font-mono"
                placeholder="Optional"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-gray-400 font-mono">BIO</Label>
            <Textarea
              value={settings.bio}
              onChange={(e) => updateSetting('bio', e.target.value)}
              className="bg-black/20 border-orange-900/20 text-orange-400 font-mono"
              placeholder="Tell others about yourself..."
              maxLength={200}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            PRIVACY & VISIBILITY
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Profile Visibility</Label>
              <p className="text-xs text-gray-500 font-mono">Control who can view your profile</p>
            </div>
            <Select 
              value={settings.profileVisibility} 
              onValueChange={(value) => updateSetting('profileVisibility', value)}
            >
              <SelectTrigger className="w-32 bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-orange-900/20">
                <SelectItem value="public" className="text-orange-400 font-mono">Public</SelectItem>
                <SelectItem value="friends" className="text-orange-400 font-mono">Friends</SelectItem>
                <SelectItem value="private" className="text-orange-400 font-mono">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Show Online Status</Label>
              <p className="text-xs text-gray-500 font-mono">Display when you're online</p>
            </div>
            <Switch 
              checked={settings.showOnlineStatus}
              onCheckedChange={(checked) => updateSetting('showOnlineStatus', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Show Match History</Label>
              <p className="text-xs text-gray-500 font-mono">Allow others to view your match history</p>
            </div>
            <Switch 
              checked={settings.showMatchHistory}
              onCheckedChange={(checked) => updateSetting('showMatchHistory', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Allow Friend Requests</Label>
              <p className="text-xs text-gray-500 font-mono">Receive friend requests from other players</p>
            </div>
            <Switch 
              checked={settings.allowFriendRequests}
              onCheckedChange={(checked) => updateSetting('allowFriendRequests', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Allow Direct Messages</Label>
              <p className="text-xs text-gray-500 font-mono">Receive messages from other players</p>
            </div>
            <Switch 
              checked={settings.allowDirectMessages}
              onCheckedChange={(checked) => updateSetting('allowDirectMessages', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gameplay Preferences */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2" />
            GAMEPLAY PREFERENCES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Auto-Accept Matches</Label>
              <p className="text-xs text-gray-500 font-mono">Automatically accept match invitations</p>
            </div>
            <Switch 
              checked={settings.autoAcceptMatches}
              onCheckedChange={(checked) => updateSetting('autoAcceptMatches', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Allow Spectators</Label>
              <p className="text-xs text-gray-500 font-mono">Let others watch your matches</p>
            </div>
            <Switch 
              checked={settings.allowSpectators}
              onCheckedChange={(checked) => updateSetting('allowSpectators', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Cross-Platform Play</Label>
              <p className="text-xs text-gray-500 font-mono">Play with users on different platforms</p>
            </div>
            <Switch 
              checked={settings.crossPlatformPlay}
              onCheckedChange={(checked) => updateSetting('crossPlatformPlay', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Interface Settings */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            INTERFACE & LOCALIZATION
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400 font-mono">Language</Label>
              <Select 
                value={settings.language} 
                onValueChange={(value) => updateSetting('language', value)}
              >
                <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-orange-900/20">
                  <SelectItem value="en" className="text-orange-400 font-mono">English</SelectItem>
                  <SelectItem value="es" className="text-orange-400 font-mono">Spanish</SelectItem>
                  <SelectItem value="fr" className="text-orange-400 font-mono">French</SelectItem>
                  <SelectItem value="de" className="text-orange-400 font-mono">German</SelectItem>
                  <SelectItem value="ru" className="text-orange-400 font-mono">Russian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-400 font-mono">Timezone</Label>
              <Select 
                value={settings.timezone} 
                onValueChange={(value) => updateSetting('timezone', value)}
              >
                <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-orange-900/20">
                  <SelectItem value="UTC" className="text-orange-400 font-mono">UTC</SelectItem>
                  <SelectItem value="PST" className="text-orange-400 font-mono">PST</SelectItem>
                  <SelectItem value="EST" className="text-orange-400 font-mono">EST</SelectItem>
                  <SelectItem value="CET" className="text-orange-400 font-mono">CET</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">High Contrast Mode</Label>
              <p className="text-xs text-gray-500 font-mono">Enhance visibility for better accessibility</p>
            </div>
            <Switch 
              checked={settings.highContrast}
              onCheckedChange={(checked) => updateSetting('highContrast', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-400 font-mono">Reduced Motion</Label>
              <p className="text-xs text-gray-500 font-mono">Minimize animations and effects</p>
            </div>
            <Switch 
              checked={settings.reducedMotion}
              onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card className="bg-green-900/20 border-green-700/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-green-400 font-mono">SAVE CONFIGURATION</h3>
              <p className="text-gray-400 font-mono text-sm">Apply all changes to your profile</p>
            </div>
            <Button 
              onClick={saveSettings}
              className="bg-green-900/20 border border-green-700 text-green-400 hover:bg-green-900/30 font-mono"
            >
              <Save className="w-4 h-4 mr-2" />
              SAVE SETTINGS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}