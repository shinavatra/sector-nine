import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Settings, Shield, Bell, User, Users2, Save, Globe, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import { toast } from "sonner";

import { Friends } from "../components/Friends";
import { BanSystem } from "../components/BanSystem";
import { ReportingSystem } from "../components/ReportingSystem";

interface ConfigurationProps {
  onNavigate?: (page: string) => void;
}

export function Configuration({ onNavigate }: ConfigurationProps) {
  const { user, updateProfile } = useUser();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'friends' | 'private'>("friends");
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Notification preferences
  const [notifyMatchFound, setNotifyMatchFound] = useState(true);
  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyTournaments, setNotifyTournaments] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifySocial, setNotifySocial] = useState(true);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || "");
      setBio(user.bio || "");
      setProfileVisibility(user.profileVisibility || "friends");
      setShowOnlineStatus(user.showOnlineStatus !== false);
    }
    // Load notification prefs from localStorage
    try {
      const prefs = JSON.parse(localStorage.getItem('notif_prefs') || '{}');
      if (prefs.matchFound !== undefined) setNotifyMatchFound(prefs.matchFound);
      if (prefs.friendRequests !== undefined) setNotifyFriendRequests(prefs.friendRequests);
      if (prefs.tournaments !== undefined) setNotifyTournaments(prefs.tournaments);
      if (prefs.messages !== undefined) setNotifyMessages(prefs.messages);
      if (prefs.social !== undefined) setNotifySocial(prefs.social);
    } catch {}
  }, [user]);

  const handleSaveSettings = async () => {
    if (displayName.trim().length > 80) {
      toast.error('Display name must be 80 characters or fewer');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || null,
        bio,
        profileVisibility,
        showOnlineStatus,
        // notification preferences stored locally only (no DB column yet)
      });
      // save notification prefs to localStorage
      localStorage.setItem('notif_prefs', JSON.stringify({
        matchFound: notifyMatchFound,
        friendRequests: notifyFriendRequests,
        tournaments: notifyTournaments,
        messages: notifyMessages,
        social: notifySocial,
      }));
      
      toast.success('Settings updated', {
        description: 'Your configuration has been saved',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error) {
      toast.error('Update failed', {
        description: 'Failed to save settings',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsSaving(false);
    }
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
          <Settings className="w-8 h-8 mr-3" />
          SYSTEM CONFIGURATION
        </h1>
        <p className="text-gray-400 font-mono mt-2">Configure your tactical systems and preferences</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="settings" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <User className="w-4 h-4 mr-2" />
            ACCOUNT
          </TabsTrigger>
          <TabsTrigger value="friends" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <Users2 className="w-4 h-4 mr-2" />
            FRIENDS
          </TabsTrigger>
          <TabsTrigger value="privacy" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <Shield className="w-4 h-4 mr-2" />
            PRIVACY
          </TabsTrigger>
          <TabsTrigger value="notifications" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <Bell className="w-4 h-4 mr-2" />
            ALERTS
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Account Settings */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">ACCOUNT SETTINGS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Display Name</Label>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  />
                  <p className="text-xs text-gray-500 font-mono">
                    Your username remains unchanged
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Email Address</Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    type="email"
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 font-mono">
                    Contact support to change email
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Steam ID</Label>
                  <Input
                    value={user?.steamId || "Not linked"}
                    disabled
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Member Since</Label>
                  <Input
                    value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Unknown"}
                    disabled
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-400 font-mono">Bio</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others about yourself..."
                  className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 font-mono text-right">
                  {bio.length}/200 characters
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Profile Visibility</Label>
                    <p className="text-xs text-gray-500 font-mono">Control who can view your profile</p>
                  </div>
                  <Select value={profileVisibility} onValueChange={(value) => setProfileVisibility(value as typeof profileVisibility)}>
                    <SelectTrigger className="w-32 bg-black/20 border-orange-900/20 text-gray-300 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-orange-900/20">
                      <SelectItem value="public" className="text-gray-300 font-mono">Public</SelectItem>
                      <SelectItem value="friends" className="text-gray-300 font-mono">Friends</SelectItem>
                      <SelectItem value="private" className="text-gray-300 font-mono">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Show Online Status</Label>
                    <p className="text-xs text-gray-500 font-mono">Let others see when you're online</p>
                  </div>
                  <Switch 
                    checked={showOnlineStatus}
                    onCheckedChange={setShowOnlineStatus}
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      SAVING...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Community Links */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">COMMUNITY LINKS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://discord.gg/sector9', '_blank')}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  OFFICIAL DISCORD
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
                
                <Button
                  variant="outline"
                  className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono justify-start"
                  onClick={() => window.open('https://reddit.com/r/sector9', '_blank')}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  REDDIT COMMUNITY
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Friends Tab */}
        <TabsContent value="friends" className="space-y-6">
          <Friends currentPlayerId={user?.id || "current_user"} currentPlayerName={user?.username || "Player"} />
        </TabsContent>

        {/* Privacy & Reporting Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <ReportingSystem currentPlayerId={user?.id || "current_user"} />
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">NOTIFICATION PREFERENCES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Match Found</Label>
                    <p className="text-xs text-gray-500 font-mono">Notify when match is ready</p>
                  </div>
                  <Switch 
                    checked={notifyMatchFound}
                    onCheckedChange={setNotifyMatchFound}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Friend Requests</Label>
                    <p className="text-xs text-gray-500 font-mono">Notify about new friend requests</p>
                  </div>
                  <Switch 
                    checked={notifyFriendRequests}
                    onCheckedChange={setNotifyFriendRequests}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Tournament Updates</Label>
                    <p className="text-xs text-gray-500 font-mono">Updates about tournaments</p>
                  </div>
                  <Switch 
                    checked={notifyTournaments}
                    onCheckedChange={setNotifyTournaments}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Direct Messages</Label>
                    <p className="text-xs text-gray-500 font-mono">Notifications for new messages</p>
                  </div>
                  <Switch 
                    checked={notifyMessages}
                    onCheckedChange={setNotifyMessages}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-400 font-mono">Social Activity</Label>
                    <p className="text-xs text-gray-500 font-mono">Friend activity and achievements</p>
                  </div>
                  <Switch 
                    checked={notifySocial}
                    onCheckedChange={setNotifySocial}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      SAVING...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      SAVE PREFERENCES
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
