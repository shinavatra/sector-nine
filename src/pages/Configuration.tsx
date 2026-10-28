import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ArrowLeft, Settings, Shield, Bell, Check, ChevronDown, User, Save, Loader2, Lock, Palette, ExternalLink, Link2, MonitorSmartphone, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useUser } from "../contexts/UserContext";
import { themeDefinitions, ThemeId, ThemeMode, useTheme } from "../contexts/ThemeContext";
import { useGame } from "../contexts/GameContext";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { ReportingSystem } from "../components/ReportingSystem";
import { Friends } from "../components/Friends";
import { FramedAvatar } from "../components/FramedAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { authAPI, userAPI } from "../utils/api";
import { displayPlayerName } from "../utils/displayName";
import { initiateSteamLogin } from "../utils/steamAuth";

type ProfileFrame = {
  id: string;
  name: string;
  style?: string | null;
  metadata?: { assetUrl?: string; thumbnailUrl?: string; purchasable?: boolean };
  owned?: boolean;
  active?: boolean;
};

interface ConfigurationProps {
  onNavigate?: (page: string) => void;
}

export function Configuration({ onNavigate }: ConfigurationProps) {
  const { user, updateProfile, changeDisplayName, adoptProfile } = useUser();
  const { themeMode, preferredTheme, effectiveTheme, availableThemes, saveThemePreferences } = useTheme();
  const {selectedGame,availableGames,setSelectedGame,lockedReason,loading:gameSaving}=useGame();
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
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [connectingSteam,setConnectingSteam]=useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [openSettingsGroup,setOpenSettingsGroup]=useState<string|null>(null);
  const setSettingsGroup=(id:string,open:boolean)=>setOpenSettingsGroup(current=>open?id:current===id?null:current);
  const steamDisplayNameAuthoritative = Boolean(user?.steamVerified && user?.steamPersonaName);
  const canChangeDisplayName = steamDisplayNameAuthoritative || (user?.points ?? 0) >= 1500;
  
  // Notification preferences
  const [notifyMatchFound, setNotifyMatchFound] = useState(true);
  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyTournaments, setNotifyTournaments] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifySocial, setNotifySocial] = useState(true);
  const [notifyPartyInvites,setNotifyPartyInvites]=useState(true);
  const [notifyVipUpdates,setNotifyVipUpdates]=useState(true);
  const [notifyShopPurchases,setNotifyShopPurchases]=useState(true);
  const [notifyWalletTransactions,setNotifyWalletTransactions]=useState(true);
  const [sessions,setSessions]=useState<any[]>([]);
  const [sessionsLoading,setSessionsLoading]=useState(false);

  useEffect(() => {
    if (!saveNotice) return;
    const timeout = window.setTimeout(() => setSaveNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  useEffect(() => {
    if (user) {
      setDisplayName(steamDisplayNameAuthoritative ? displayPlayerName(user) : user.localDisplayName || user.displayName || user.username || "");
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
      setNotifyPartyInvites(user.notificationPreferences.partyInvites);
      setNotifyVipUpdates(user.notificationPreferences.vipUpdates);
      setNotifyShopPurchases(user.notificationPreferences.shopPurchases);
      setNotifyWalletTransactions(user.notificationPreferences.walletTransactions);
    }
  }, [steamDisplayNameAuthoritative, user]);

  useEffect(() => {
    setDraftThemeMode(themeMode);
    setDraftTheme(preferredTheme);
  }, [preferredTheme, themeMode]);

  useEffect(()=>{if(user)void loadSessions()},[user?.id]);

  useEffect(() => {
    let active = true;
    userAPI.getProfileCustomization()
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

  const handleEquipFrame = async (frameId: string | null) => {
    setEquippingFrame(frameId || 'none');
    try {
      const response: any = await userAPI.equipFrame(frameId);
      if (response?.profile) adoptProfile(response.profile);
      setProfileFrames(frames => frames.map(frame => ({ ...frame, active: frameId === frame.id })));
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

  const connectSteam=async()=>{setConnectingSteam(true);try{await initiateSteamLogin('link')}catch(error){setConnectingSteam(false);toast.error('Steam connection failed',{description:error instanceof Error?error.message:'Unable to start Steam authentication'})}};

  const ownedFrames = profileFrames.filter(frame => frame.owned === true && user?.ownedFrames.includes(frame.id));
  const equippedFrame = profileFrames.find(frame => frame.id === user?.equippedFrame);

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
      const savedDisplayName = steamDisplayNameAuthoritative ? displayPlayerName(user) : user?.localDisplayName || user?.displayName || user?.username || '';
      if (!steamDisplayNameAuthoritative && displayName.trim() !== savedDisplayName) {
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
        partyInvites:notifyPartyInvites,
        vipUpdates:notifyVipUpdates,
        shopPurchases:notifyShopPurchases,
        walletTransactions:notifyWalletTransactions,
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

  const loadSessions=async()=>{setSessionsLoading(true);try{const response:any=await authAPI.getSessions();setSessions(Array.isArray(response?.sessions)?response.sessions:[])}catch(error){toast.error('Unable to load sessions',{description:error instanceof Error?error.message:'Request failed'})}finally{setSessionsLoading(false)}};
  const revokeSession=async(sessionId:string)=>{try{await authAPI.revokeSession(sessionId);setSessions(value=>value.filter(session=>session.id!==sessionId));toast.success('Session revoked')}catch(error){toast.error('Unable to revoke session',{description:error instanceof Error?error.message:'Request failed'})}};

  const handleChangeDisplayName = async () => {
    if (!canChangeDisplayName) return;
    const nextName = displayName.trim();
    const currentName = steamDisplayNameAuthoritative ? displayPlayerName(user) : user?.localDisplayName || user?.displayName || user?.username || '';
    if (nextName === currentName) return void toast.info('Display name is unchanged');
    if (steamDisplayNameAuthoritative) return void toast.info('Display name is synced from Steam', { description: 'Local display-name edits apply only when Steam is not verified.' });
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
    <div className="page-container page-container-form container mx-auto px-4 py-8">
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

      <Tabs defaultValue="settings" onValueChange={() => setSaveNotice("")} className="space-y-6">
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
          <SettingsGroup id="account" title="ACCOUNT AND PROFILE" description="Identity, biography, visibility, and presence" open={openSettingsGroup==='account'} onOpenChange={open=>setSettingsGroup('account',open)}>
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">ACCOUNT SETTINGS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label className="text-gray-400 font-mono">Game Selection</Label>
                <Select value={selectedGame.id} onValueChange={async value=>{try{await setSelectedGame(value as typeof selectedGame.id);setSaveNotice('Selected game saved');toast.success('Selected game updated')}catch(error){toast.error('Unable to select game',{description:error instanceof Error?error.message:'The game is unavailable'})}}} disabled={gameSaving}>
                  <SelectTrigger aria-label="Game to play" className="w-full bg-black/20 border-orange-900/20 text-gray-300 font-mono">
                    <SelectValue placeholder="Select game" />
                  </SelectTrigger>
                  <SelectContent className="border-orange-900/30 bg-[#111113] text-gray-200">
                    {availableGames.map(game=><SelectItem key={game.id} value={game.id} disabled={Boolean(lockedReason(game.id))} className="font-mono">{game.name}{lockedReason(game.id)?' — Unavailable':''}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 font-mono">Scopes competitive navigation and data.</p></div>
                <Label className="text-gray-400 font-mono">Theme Selection</Label>
<Select
  value={preferredTheme}
  onValueChange={async (value) => {
    try {
      await saveThemePreferences('manual', value as ThemeId);
      setDraftThemeMode('manual');
      setDraftTheme(value as ThemeId);
      setSaveNotice('Theme preference saved');
    } catch (error) {
      toast.error('Theme update failed', {
        description: error instanceof Error ? error.message : 'Unable to save theme',
      });
    }
  }}
  disabled={isSavingTheme}
>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Display Name</Label>
                  <Input
                    aria-label="Display name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={steamDisplayNameAuthoritative || !canChangeDisplayName || isSaving}
                    maxLength={80}
                    className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                  />
                  <p className="text-xs text-gray-500 font-mono">
                    {steamDisplayNameAuthoritative ? 'Synced from Steam. Local display names apply only when Steam is not verified.' : 'Change display name — 1500 points. Username remains unchanged.'}
                  </p>
                  <Button type="button" variant="outline" onClick={handleChangeDisplayName} disabled={steamDisplayNameAuthoritative || !canChangeDisplayName || isSaving} title={steamDisplayNameAuthoritative ? 'Display name is synced from Steam.' : !canChangeDisplayName ? 'You need 1500 points to change your display name.' : undefined} className="w-full border-orange-900/30 text-orange-400 font-mono">
                    {steamDisplayNameAuthoritative ? 'SYNCED FROM STEAM' : 'EDIT DISPLAY NAME — 1500 POINTS'}
                  </Button>
                  {!steamDisplayNameAuthoritative && !canChangeDisplayName && <p className="text-xs text-gray-500 font-mono">You need 1500 points to change your display name.</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 font-mono">Account Username</Label>
                  <Input
                    aria-label="Account username"
                    value={user?.accountUsername || user?.username || ""}
                    disabled
                    className="bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 font-mono">Internal unique account identity</p>
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
          <Card className="border-orange-900/20 bg-black/40">
            <CardHeader><CardTitle className="flex items-center gap-2 font-mono text-orange-400"><Link2 className="size-5"/>CONNECTED ACCOUNTS</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-orange-900/20 bg-black/25 p-4"><p className="font-mono text-sm text-gray-300">Email account</p><p className="mt-1 break-all text-xs text-gray-500">{user?.email||'No email address'}</p><Badge variant="outline" className="mt-3 border-green-800/40 text-green-300">CONNECTED</Badge></div>
              <div className="rounded border border-orange-900/20 bg-black/25 p-4">{user?.steamId?<div className="flex gap-3"><Avatar className="size-12"><AvatarImage src={user.steamAvatar||''}/><AvatarFallback>ST</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-mono text-sm text-gray-200">{user.steamPersonaName||'Steam account'}</p><p className="break-all text-xs text-gray-500">{user.steamId}</p><Badge variant="outline" className="mt-2 border-green-800/40 text-green-300">STEAM CONNECTED</Badge>{user.steamProfileUrl&&<a href={user.steamProfileUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs text-orange-300 hover:underline">View Steam Profile<ExternalLink className="size-3"/></a>}</div></div>:<div><p className="font-mono text-sm text-gray-300">Steam</p><p className="mt-1 text-xs text-gray-500">Connect through verified Steam OpenID to enable ownership checks and matchmaking.</p><Button type="button" onClick={connectSteam} disabled={connectingSteam} className="mt-3 w-full bg-orange-700 text-black hover:bg-orange-600">{connectingSteam?<><Loader2 className="mr-2 size-4 animate-spin"/>CONNECTING...</>:<>CONNECT STEAM ACCOUNT</>}</Button></div>}</div>
            </CardContent>
          </Card>
          </SettingsGroup>

          <SettingsGroup id="appearance" title="APPEARANCE" description="Theme mode and owned profile frames" open={openSettingsGroup==='appearance'} onOpenChange={open=>setSettingsGroup('appearance',open)}>
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
                      aria-pressed={selected}
                      data-selected={selected || undefined}
                      data-saved={preferredTheme === theme.id || undefined}
                      disabled={!unlocked || isSavingTheme}
                      onClick={() => setDraftTheme(theme.id)}
                      className={`theme-choice min-w-0 rounded border p-4 text-left font-mono transition-colors ${
                        selected ? 'border-orange-500 bg-orange-900/20' : 'border-orange-900/20 bg-black/20'
                      } ${unlocked ? 'text-gray-300 hover:border-orange-700' : 'cursor-not-allowed opacity-65'}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-bold text-orange-300">
                        {theme.name}
                        <span className="flex shrink-0 items-center gap-2">
                          {preferredTheme === theme.id && <span className="theme-choice-saved">SAVED</span>}
                          {selected && <span className="theme-choice-check" aria-label="Selected"><Check className="size-4" /></span>}
                          {!unlocked && <Lock className="size-4" aria-label="Locked" />}
                        </span>
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
                    {equippedFrame?.name || 'No frame equipped'}
                  </p>
                </div>
              </div>
              {framesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" />Loading owned frames...</div>
              ) : (
                <Button type="button" variant="outline" onClick={() => setFrameDialogOpen(true)} className="border-orange-900/40 font-mono text-orange-300">
                  CHANGE FRAME
                </Button>
              )}
              {!framesLoading && ownedFrames.length === 0 && (
                <p className="text-sm text-gray-500">No available owned frames.</p>
              )}
              <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
                <DialogContent className="max-h-[88vh] overflow-hidden border-orange-900/40 bg-neutral-950 p-4 sm:max-w-3xl sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="font-mono text-orange-300">CHANGE PROFILE FRAME</DialogTitle>
                    <DialogDescription>Choose from frames you own. Locked collection items are not shown here.</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[58vh] overflow-y-auto pr-1">
                    {ownedFrames.length === 0 ? (
                      <div className="rounded border border-dashed border-orange-900/30 p-8 text-center font-mono text-sm text-gray-500">You do not own any profile frames yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ownedFrames.map(frame => {
                          const selected = user?.equippedFrame === frame.id;
                          return <button key={frame.id} type="button" disabled={selected || equippingFrame !== null} onClick={() => handleEquipFrame(frame.id)} className={`min-w-0 rounded border p-3 text-left font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${selected ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-orange-900/20 bg-black/30 text-gray-300 hover:border-orange-700'}`}>
                            {frame.metadata?.thumbnailUrl ? <img src={frame.metadata.thumbnailUrl} alt={`${frame.name} preview`} className="mx-auto mb-2 size-24 object-contain" /> : <span className={`mx-auto mb-2 block size-16 rounded-full bg-black/60 ${frame.style || 'ring-2 ring-orange-400'}`} />}
                            <span className="block truncate text-sm font-bold">{frame.name}</span>
                            <span className="mt-1 block text-xs text-orange-300">{selected ? 'EQUIPPED' : equippingFrame === frame.id ? 'EQUIPPING...' : 'EQUIP'}</span>
                          </button>;
                        })}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="border-t border-orange-900/20 pt-4">
                    <Button type="button" variant="outline" disabled={!user?.equippedFrame || equippingFrame !== null} onClick={() => handleEquipFrame(null)} className="border-red-900/40 font-mono text-red-300">REMOVE FRAME</Button>
                    <DialogClose asChild><Button type="button" variant="outline" className="font-mono">CLOSE</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          </SettingsGroup>

          <SettingsGroup id="friends" title="FRIENDS" description="Requests, accepted friends, and player search" open={openSettingsGroup==='friends'} onOpenChange={open=>setSettingsGroup('friends',open)}>
          <Friends
            currentPlayerId={user?.id || ''}
            currentPlayerName={displayPlayerName(user)}
            onNavigate={onNavigate}
          />
          </SettingsGroup>
          
          {/* Persisted social links */}
          <SettingsGroup id="social" title="SOCIAL LINKS" description="Public profile destinations" open={openSettingsGroup==='social'} onOpenChange={open=>setSettingsGroup('social',open)}>
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
          <SettingsGroup id="security" title="SECURITY" description="Update your account password" open={openSettingsGroup==='security'} onOpenChange={open=>setSettingsGroup('security',open)}>
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader><CardTitle className="text-orange-400 font-mono">SECURITY</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input aria-label="Current password" type="password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="Current password" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input aria-label="New password" type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="New password (8+ characters)" className="bg-black/20 border-orange-900/20 font-mono" />
              <Input aria-label="Confirm new password" type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="bg-black/20 border-orange-900/20 font-mono" />
              <div className="flex justify-end"><Button onClick={handleChangePassword} disabled={isChangingPassword||!currentPassword||!newPassword}>{isChangingPassword?<><Loader2 className="mr-2 size-4 animate-spin"/>CHANGING...</>:'CHANGE PASSWORD'}</Button></div>
              <div className="border-t border-orange-900/20 pt-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-mono text-orange-300">ACTIVE SESSIONS</h3><p className="text-xs text-gray-500">Tokens are never displayed.</p></div><Button size="sm" variant="outline" onClick={()=>void loadSessions()} disabled={sessionsLoading}>{sessionsLoading?<Loader2 className="size-4 animate-spin"/>:'REFRESH'}</Button></div>{sessionsLoading&&!sessions.length?<p className="text-sm text-gray-500">Loading sessions…</p>:sessions.length?<div className="space-y-2">{sessions.map(session=><div key={session.id} className="flex flex-col gap-3 rounded border border-orange-900/20 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 font-mono text-sm text-gray-200"><MonitorSmartphone className="size-4 text-orange-400"/>{session.current?'Current session':'Active session'}</p><p className="truncate text-xs text-gray-500">{session.user_agent||'Unknown device'} · Last used {new Date(session.last_used_at).toLocaleString()}</p></div><Button size="sm" variant="outline" className="border-red-900/30 text-red-300" onClick={()=>void revokeSession(session.id)}><Trash2 className="mr-2 size-3"/>REVOKE</Button></div>)}</div>:<p className="text-sm text-gray-500">No active sessions were returned.</p>}</div>
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
                {[['Party Invites',notifyPartyInvites,setNotifyPartyInvites],['VIP Updates',notifyVipUpdates,setNotifyVipUpdates],['Shop Purchases',notifyShopPurchases,setNotifyShopPurchases],['FL Wallet Transactions',notifyWalletTransactions,setNotifyWalletTransactions]].map(([label,checked,setter]:any)=><div key={label} className="flex items-center justify-between gap-4"><div><Label className="font-mono text-gray-400">{label}</Label><p className="font-mono text-xs text-gray-500">Receive {String(label).toLowerCase()} notifications</p></div><Switch aria-label={`${label} notifications`} checked={checked} onCheckedChange={setter}/></div>)}
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

function SettingsGroup({ id,title,description,open,onOpenChange,children }: { id:string;title:string;description:string;open:boolean;onOpenChange:(open:boolean)=>void;children:ReactNode }) {
  return <details id={`configuration-${id}`} open={open} onToggle={event=>{const next=event.currentTarget.open;if(next!==open)onOpenChange(next)}} className="group rounded-lg border border-orange-900/25 bg-black/20">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
      <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-orange-300">{title}</span><span className="mt-1 block text-xs text-gray-500">{description}</span></span>
      <ChevronDown className="size-5 shrink-0 text-orange-500 transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-5 border-t border-orange-900/20 p-4 sm:p-5">{children}</div>
  </details>;
}
