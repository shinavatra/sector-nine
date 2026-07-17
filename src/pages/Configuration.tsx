import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Settings, Shield, Bell, User, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";
import { toast } from "sonner";

import { ReportingSystem } from "../components/ReportingSystem";
import { authAPI } from "../utils/api";

interface ConfigurationProps {
  onNavigate?: (page: string) => void;
}

export function Configuration({ onNavigate }: ConfigurationProps) {
  const { user, updateProfile, changeDisplayName } = useUser();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'friends' | 'private'>("friends");
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ twitter:'', youtube:'', twitch:'', discord:'', instagram:'', website:'' });
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const canChangeDisplayName = (user?.points ?? 0) >= 1500;
  
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
      setSocialLinks({
        twitter:user.socialLinks.twitter || '', youtube:user.socialLinks.youtube || '',
        twitch:user.socialLinks.twitch || '', discord:user.socialLinks.discord || '',
        instagram:user.socialLinks.instagram || '', website:user.socialLinks.website || '',
      });
      setNotifyMatchFound(user.notificationPreferences.matchFound);
      setNotifyFriendRequests(user.notificationPreferences.friendRequests);
      setNotifyTournaments(user.notificationPreferences.tournaments);
      setNotifyMessages(user.notificationPreferences.messages);
      setNotifySocial(user.notificationPreferences.social);
    }
  }, [user]);

  const handleSaveSettings = async () => {
    if (displayName.trim().length > 80) {
      toast.error('Display name must be 80 characters or fewer');
      return;
    }
    setIsSaving(true);
    try {
      const savedDisplayName = user?.displayName || user?.username || '';
      if (displayName.trim() !== savedDisplayName) {
        if (!window.confirm('Change display name — 1500 points?')) return;
        await changeDisplayName(displayName.trim());
      }
      await updateProfile({
        bio,
        profileVisibility,
        showOnlineStatus,
      });
      
      toast.success('Settings updated', {
        description: 'Your configuration has been saved',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error) {
      toast.error('Update failed', {
        description: error instanceof Error ? error.message : 'Failed to save settings',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ notificationPreferences: {
        matchFound: notifyMatchFound,
        friendRequests: notifyFriendRequests,
        tournaments: notifyTournaments,
        messages: notifyMessages,
        social: notifySocial,
        systemMaintenance: user?.notificationPreferences.systemMaintenance ?? true,
        securityAlerts: user?.notificationPreferences.securityAlerts ?? true,
      } });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error('Unable to save notification preferences', {
        description: error instanceof Error ? error.message : 'The server rejected the update',
      });
    } finally { setIsSaving(false); }
  };

  const handleChangeDisplayName = async () => {
    if (!canChangeDisplayName) return;
    const nextName = displayName.trim();
    const currentName = user?.displayName || user?.username || '';
    if (nextName === currentName) return void toast.info('Display name is unchanged');
    if (!nextName || nextName.length > 80) return void toast.error('Display name must be between 1 and 80 characters');
    if (!window.confirm('Change display name — 1500 points?')) return;
    setIsSaving(true);
    try {
      await changeDisplayName(nextName);
      toast.success('Display name changed', { description: '1500 points deducted' });
    } catch (error) {
      toast.error('Display-name change failed', { description: error instanceof Error ? error.message : 'Unable to change display name' });
    } finally { setIsSaving(false); }
  };

  const handleSaveSocialLinks = async () => {
    setIsSavingSocial(true);
    try {
      await updateProfile({ socialLinks: Object.fromEntries(Object.entries(socialLinks).map(([key,value])=>[key,value.trim() || null])) as any });
      toast.success('Social links updated');
    } catch (error) {
      toast.error('Unable to update social links', { description:error instanceof Error?error.message:'The server rejected the update' });
    } finally { setIsSavingSocial(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return void toast.error('New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return void toast.error('New password confirmation does not match');
    setIsChangingPassword(true);
    try {
      await authAPI.changePassword(currentPassword,newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password changed');
    } catch (error) {
      toast.error('Password change failed', { description:error instanceof Error?error.message:'Unable to change password' });
    } finally { setIsChangingPassword(false); }
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
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="settings" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <User className="w-4 h-4 mr-2" />
            ACCOUNT
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
                    disabled={!canChangeDisplayName || isSaving}
                    maxLength={80}
                    className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  />
                  <p className="text-xs text-gray-500 font-mono">
                    Change display name — 1500 points. Username remains unchanged.
                  </p>
                  <Button type="button" variant="outline" onClick={handleChangeDisplayName} disabled={!canChangeDisplayName || isSaving} title={!canChangeDisplayName ? 'You need 1500 points to change your display name.' : undefined} className="w-full border-orange-900/30 text-orange-400 font-mono">
                    EDIT DISPLAY NAME — 1500 POINTS
                  </Button>
                  {!canChangeDisplayName && <p className="text-xs text-gray-500 font-mono">You need 1500 points to change your display name.</p>}
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
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 font-mono text-right">
                  {bio.length}/500 characters
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
          
          {/* Persisted social links */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SOCIAL MEDIA LINKS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={user?.steamProfileUrl || ''} disabled placeholder="Steam profile URL" className="bg-black/20 border-orange-900/20 text-gray-500 font-mono" />
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={socialLinks.twitter} onChange={event=>setSocialLinks({...socialLinks,twitter:event.target.value})} placeholder="X/Twitter URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input value={socialLinks.youtube} onChange={event=>setSocialLinks({...socialLinks,youtube:event.target.value})} placeholder="YouTube URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input value={socialLinks.twitch} onChange={event=>setSocialLinks({...socialLinks,twitch:event.target.value})} placeholder="Twitch URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input value={socialLinks.discord} onChange={event=>setSocialLinks({...socialLinks,discord:event.target.value})} placeholder="Discord URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input value={socialLinks.instagram} onChange={event=>setSocialLinks({...socialLinks,instagram:event.target.value})} placeholder="Instagram URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input value={socialLinks.website} onChange={event=>setSocialLinks({...socialLinks,website:event.target.value})} placeholder="Personal website" className="bg-black/20 border-orange-900/20 font-mono" />
              </div>
              <div className="flex justify-end gap-3 border-t border-orange-900/20 pt-4">
                <Button variant="outline" onClick={()=>user&&setSocialLinks({twitter:user.socialLinks.twitter||'',youtube:user.socialLinks.youtube||'',twitch:user.socialLinks.twitch||'',discord:user.socialLinks.discord||'',instagram:user.socialLinks.instagram||'',website:user.socialLinks.website||''})}>CANCEL</Button>
                <Button onClick={handleSaveSocialLinks} disabled={isSavingSocial}>{isSavingSocial?<><Loader2 className="mr-2 size-4 animate-spin"/>UPDATING...</>:'UPDATE LINKS'}</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader><CardTitle className="text-orange-400 font-mono">SECURITY</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input type="password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="Current password" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="New password (8+ characters)" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="bg-black/20 border-orange-900/20 font-mono" />
              <div className="flex justify-end"><Button onClick={handleChangePassword} disabled={isChangingPassword||!currentPassword||!newPassword}>{isChangingPassword?<><Loader2 className="mr-2 size-4 animate-spin"/>CHANGING...</>:'CHANGE PASSWORD'}</Button></div>
            </CardContent>
          </Card>
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
                  onClick={handleSaveNotifications}
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
