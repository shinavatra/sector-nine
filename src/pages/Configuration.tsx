import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Settings, Shield, Bell, ChevronDown, User, Save, Loader2, Lock, Palette } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useUser } from "../contexts/UserContext";
import { themeDefinitions, ThemeId, ThemeMode, useTheme } from "../contexts/ThemeContext";
import { useGame } from "../contexts/GameContext";
import { toast } from "sonner";

import { ReportingSystem } from "../components/ReportingSystem";
import { Friends } from "../components/Friends";
import { FramedAvatar } from "../components/FramedAvatar";
import { authAPI, storeAPI, userAPI } from "../utils/api";

type ProfileFrame = {
  id: string;
  name: string;
  style?: string | null;
};

interface ConfigurationProps {
  onNavigate?: (page: string) => void;
}

export function Configuration({ onNavigate }: ConfigurationProps) {
  const { user, updateProfile, changeDisplayName, adoptProfile } = useUser();
  const { themeMode, preferredTheme, effectiveTheme, availableThemes, saveThemePreferences } = useTheme();
  const {selectedGame,availableGames,setSelectedGame,loading:gameSaving}=useGame();
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
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(themeMode);
  const [draftTheme, setDraftTheme] = useState<ThemeId>(preferredTheme);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [profileFrames, setProfileFrames] = useState<ProfileFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [equippingFrame, setEquippingFrame] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
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

  useEffect(() => {
    setDraftThemeMode(themeMode);
    setDraftTheme(preferredTheme);
  }, [preferredTheme, themeMode]);

  useEffect(() => {
    let active = true;
    storeAPI.getCatalog()
      .then((response: any) => {
        if (active) setProfileFrames(Array.isArray(response?.frames) ? response.frames : []);
      })
      .catch(() => {
        if (active) setProfileFrames([]);
      })
      .finally(() => {
        if (active) setFramesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleEquipFrame = async (frameId: string) => {
    setEquippingFrame(frameId);
    try {
      const response: any = await userAPI.equipFrame(frameId);
      if (response?.profile) adoptProfile(response.profile);
      setSaveNotice('Profile frame saved');
      toast.success('Profile frame updated');
    } catch (error) {
      toast.error('Unable to update profile frame', {
        description: error instanceof Error ? error.message : 'The server rejected the frame selection.',
      });
    } finally {
      setEquippingFrame(null);
    }
  };

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      await saveThemePreferences(draftThemeMode, draftTheme);
      setSaveNotice('Theme preference saved');
      toast.success('Theme preference saved', {
        description: draftThemeMode === 'follow_game'
          ? 'The interface will follow your selected verified game.'
          : 'Your selected interface is now active.',
      });
    } catch (error) {
      toast.error('Theme update failed', {
        description: error instanceof Error ? error.message : 'The server rejected the theme preference.',
      });
    } finally {
      setIsSavingTheme(false);
    }
  };

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
      setSaveNotice('Account settings saved');
      
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
      setSaveNotice('Notification preferences saved');
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
      setSaveNotice('Display name saved');
      toast.success('Display name changed', { description: '1500 points deducted' });
    } catch (error) {
      toast.error('Display-name change failed', { description: error instanceof Error ? error.message : 'Unable to change display name' });
    } finally { setIsSaving(false); }
  };

  const handleSaveSocialLinks = async () => {
    setIsSavingSocial(true);
    try {
      await updateProfile({ socialLinks: Object.fromEntries(Object.entries(socialLinks).map(([key,value])=>[key,value.trim() || null])) as any });
      setSaveNotice('Social links saved');
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
      setSaveNotice('Password changed successfully');
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

        {saveNotice && <div role="status" aria-live="polite" className="flex items-center gap-2 rounded border border-green-800/40 bg-green-950/30 px-4 py-3 font-mono text-sm text-green-300"><Save className="size-4" />{saveNotice}</div>}

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-5">
          {/* Account Settings */}
          <SettingsGroup title="ACCOUNT AND PROFILE" description="Identity, biography, visibility, and presence" defaultOpen>
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">ACCOUNT SETTINGS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-sm space-y-2">
                <Label className="text-gray-400 font-mono">Game to play</Label>
                <Select value={selectedGame.id} onValueChange={async value=>{try{await setSelectedGame(value as typeof selectedGame.id);setSaveNotice('Selected game saved');toast.success('Selected game updated')}catch(error){toast.error('Unable to select game',{description:error instanceof Error?error.message:'The game is unavailable'})}}} disabled={gameSaving}>
                  <SelectTrigger aria-label="Game to play" className="w-full bg-black/20 border-orange-900/20 text-gray-300 font-mono">
                    <SelectValue placeholder="Select game" />
                  </SelectTrigger>
                  <SelectContent className="border-orange-900/30 bg-[#111113] text-gray-200">
                    {availableGames.map(game=><SelectItem key={game.id} value={game.id} className="font-mono">{game.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 font-mono">Matchmaking, statistics and game-aware pages follow this selection. Theme remains independent unless Follow Selected Game is enabled.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Display Name</Label>
                  <Input
                    aria-label="Display name"
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
                    aria-label="Email address"
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
                    aria-label="Steam ID"
                    value={user?.steamId || "Not linked"}
                    disabled
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Member Since</Label>
                  <Input
                    aria-label="Member since"
                    value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Unknown"}
                    disabled
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-400 font-mono">Bio</Label>
                <Textarea
                  aria-label="Biography"
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
                    <SelectTrigger aria-label="Profile visibility" className="w-32 bg-black/20 border-orange-900/20 text-gray-300 font-mono">
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
                    aria-label="Show online status"
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
          </SettingsGroup>

          <SettingsGroup title="APPEARANCE" description="Theme mode and owned profile frames" defaultOpen>
          <Card className="theme-panel bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-400 font-mono">
                <Palette className="size-5" />
                INTERFACE THEME
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setDraftThemeMode('manual')} className={`rounded border p-4 text-left font-mono transition-colors ${draftThemeMode === 'manual' ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-orange-900/20 bg-black/20 text-gray-400'}`}>
                  <span className="block text-sm font-bold">MANUAL</span>
                  <span className="mt-1 block text-xs">Keep the theme selected below.</span>
                </button>
                <button type="button" onClick={() => setDraftThemeMode('follow_game')} className={`rounded border p-4 text-left font-mono transition-colors ${draftThemeMode === 'follow_game' ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-orange-900/20 bg-black/20 text-gray-400'}`}>
                  <span className="block text-sm font-bold">FOLLOW SELECTED GAME</span>
                  <span className="mt-1 block text-xs">Use that game's theme when access is verified; otherwise use Default.</span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {themeDefinitions.map(theme => {
                  const unlocked = availableThemes.includes(theme.id);
                  const selected = draftTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      disabled={!unlocked || isSavingTheme}
                      onClick={() => setDraftTheme(theme.id)}
                      className={`min-w-0 rounded border p-4 text-left font-mono transition-colors ${
                        selected ? 'border-orange-500 bg-orange-900/20' : 'border-orange-900/20 bg-black/20'
                      } ${unlocked ? 'text-gray-300 hover:border-orange-700' : 'cursor-not-allowed opacity-65'}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-bold text-orange-300">
                        {theme.name}
                        {!unlocked && <Lock className="size-4 shrink-0" aria-label="Locked" />}
                      </span>
                      <span className="mt-2 block text-xs text-gray-500">{theme.description}</span>
                      {!unlocked && <span className="mt-3 block text-[11px] text-amber-400">Verify game ownership to unlock.</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-900/20 pt-4">
                <p className="text-xs font-mono text-gray-500">ACTIVE: {themeDefinitions.find(theme => theme.id === effectiveTheme)?.name.toUpperCase()}</p>
                <Button onClick={handleSaveTheme} disabled={isSavingTheme} className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono">
                  {isSavingTheme ? <><Loader2 className="mr-2 size-4 animate-spin" />SAVING...</> : <><Save className="mr-2 size-4" />SAVE THEME</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">PROFILE FRAME</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <FramedAvatar frameId={user?.equippedFrame} className="configuration-frame-preview">
                  <img
                    src={user?.resolvedAvatar}
                    alt="Current profile frame preview"
                    className="configuration-frame-preview-image rounded-full"
                  />
                </FramedAvatar>
                <div className="min-w-0 font-mono">
                  <p className="text-sm text-gray-300">Current frame</p>
                  <p className="truncate text-xs text-gray-500">
                    {profileFrames.find(frame => frame.id === user?.equippedFrame)?.name || 'Basic frame'}
                  </p>
                </div>
              </div>
              {framesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" />Loading owned frames...</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {profileFrames.filter(frame => user?.ownedFrames.includes(frame.id)).map(frame => {
                    const selected = user?.equippedFrame === frame.id;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        disabled={selected || equippingFrame !== null}
                        onClick={() => handleEquipFrame(frame.id)}
                        className={`min-w-0 rounded border p-3 text-left font-mono transition-colors ${selected ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-orange-900/20 bg-black/20 text-gray-400 hover:border-orange-700'}`}
                      >
                        <span className={`mb-2 block size-8 rounded-full bg-black/60 ${frame.id !== 'fr_basic' ? frame.style || 'ring-2 ring-orange-400' : ''}`} />
                        <span className="block truncate text-sm font-bold">{frame.name}</span>
                        <span className="mt-1 block text-xs">{selected ? 'EQUIPPED' : equippingFrame === frame.id ? 'EQUIPPING...' : 'EQUIP'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!framesLoading && profileFrames.every(frame => !user?.ownedFrames.includes(frame.id)) && (
                <p className="text-sm text-gray-500">No available owned frames.</p>
              )}
            </CardContent>
          </Card>
          </SettingsGroup>

          <SettingsGroup title="FRIENDS" description="Requests, accepted friends, and player search">
          <Friends
            currentPlayerId={user?.id || ''}
            currentPlayerName={user?.displayName || user?.username || ''}
          />
          </SettingsGroup>
          
          {/* Persisted social links */}
          <SettingsGroup title="SOCIAL LINKS" description="Public profile destinations">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SOCIAL MEDIA LINKS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input aria-label="Steam profile URL" value={user?.steamProfileUrl || ''} disabled placeholder="Steam profile URL" className="bg-black/20 border-orange-900/20 text-gray-500 font-mono" />
              <div className="grid gap-4 md:grid-cols-2">
                <Input aria-label="X or Twitter URL" value={socialLinks.twitter} onChange={event=>setSocialLinks({...socialLinks,twitter:event.target.value})} placeholder="X/Twitter URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input aria-label="YouTube URL" value={socialLinks.youtube} onChange={event=>setSocialLinks({...socialLinks,youtube:event.target.value})} placeholder="YouTube URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input aria-label="Twitch URL" value={socialLinks.twitch} onChange={event=>setSocialLinks({...socialLinks,twitch:event.target.value})} placeholder="Twitch URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input aria-label="Discord URL" value={socialLinks.discord} onChange={event=>setSocialLinks({...socialLinks,discord:event.target.value})} placeholder="Discord URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input aria-label="Instagram URL" value={socialLinks.instagram} onChange={event=>setSocialLinks({...socialLinks,instagram:event.target.value})} placeholder="Instagram URL" className="bg-black/20 border-orange-900/20 font-mono" />
                <Input aria-label="Personal website URL" value={socialLinks.website} onChange={event=>setSocialLinks({...socialLinks,website:event.target.value})} placeholder="Personal website" className="bg-black/20 border-orange-900/20 font-mono" />
              </div>
              <div className="flex justify-end gap-3 border-t border-orange-900/20 pt-4">
                <Button variant="outline" onClick={()=>user&&setSocialLinks({twitter:user.socialLinks.twitter||'',youtube:user.socialLinks.youtube||'',twitch:user.socialLinks.twitch||'',discord:user.socialLinks.discord||'',instagram:user.socialLinks.instagram||'',website:user.socialLinks.website||''})}>CANCEL</Button>
                <Button onClick={handleSaveSocialLinks} disabled={isSavingSocial}>{isSavingSocial?<><Loader2 className="mr-2 size-4 animate-spin"/>UPDATING...</>:'UPDATE LINKS'}</Button>
              </div>
            </CardContent>
          </Card>
          </SettingsGroup>
          <SettingsGroup title="SECURITY" description="Update your account password">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader><CardTitle className="text-orange-400 font-mono">SECURITY</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input aria-label="Current password" type="password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="Current password" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input aria-label="New password" type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="New password (8+ characters)" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input aria-label="Confirm new password" type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="bg-black/20 border-orange-900/20 font-mono" />
              <div className="flex justify-end"><Button onClick={handleChangePassword} disabled={isChangingPassword||!currentPassword||!newPassword}>{isChangingPassword?<><Loader2 className="mr-2 size-4 animate-spin"/>CHANGING...</>:'CHANGE PASSWORD'}</Button></div>
            </CardContent>
          </Card>
          </SettingsGroup>
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
                    aria-label="Match found notifications"
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
                    aria-label="Friend request notifications"
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
                    aria-label="Tournament notifications"
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
                    aria-label="Direct message notifications"
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
                    aria-label="Social activity notifications"
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

function SettingsGroup({ title, description, defaultOpen = false, children }: { title: string; description: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group rounded-lg border border-orange-900/25 bg-black/20">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
      <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-orange-300">{title}</span><span className="mt-1 block text-xs text-gray-500">{description}</span></span>
      <ChevronDown className="size-5 shrink-0 text-orange-500 transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-5 border-t border-orange-900/20 p-4 sm:p-5">{children}</div>
  </details>;
}
