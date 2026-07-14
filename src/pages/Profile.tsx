import { useState, useRef, useEffect } from "react";
import { PlayerProfile } from "../components/PlayerProfile";
import { SteamIntegration } from "../components/SteamIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Progress } from "../components/ui/progress";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { Settings, Edit, Award, Trophy, Target, Zap, Calendar, Users, MessageCircle, UserPlus, Send, Twitter, Youtube, Twitch, ExternalLink, Upload, Camera, Lock, Instagram, Globe, LogOut, Loader2 } from "lucide-react";
import { useUser } from "../contexts/UserContext";
import { authAPI, userAPI } from "../utils/api";
import { toast } from "sonner";
import { avatarBadges, profileFrames, getRarityColor, getRarityGlow } from "../utils/badgeData";

// Achievements are earned through gameplay
const getAchievements = (user: any) => {
  const achievements = [];
  
  // First match achievement
  if (user?.stats?.matchesPlayed > 0) {
    achievements.push({
      id: 1,
      name: "First Contact",
      description: "Complete your first match",
      icon: "🎯",
      rarity: "UNCLASSIFIED",
      progress: 100
    });
  }
  
  // Win achievements
  if (user?.stats?.wins >= 1) {
    achievements.push({
      id: 2,
      name: "First Victory",
      description: "Win your first match",
      icon: "🏆",
      rarity: "UNCLASSIFIED", 
      progress: 100
    });
  }
  
  if (user?.stats?.wins >= 10) {
    achievements.push({
      id: 3,
      name: "Combat Veteran",
      description: "Win 10 matches",
      icon: "⚡",
      rarity: "CLASSIFIED",
      progress: 100
    });
  }
  
  if (user?.stats?.wins >= 50) {
    achievements.push({
      id: 4,
      name: "Arena Master",
      description: "Win 50 matches",
      icon: "🔬",
      rarity: "RESTRICTED",
      progress: 100
    });
  }
  
  // Rating achievements
  if (user?.stats?.rating >= 1500) {
    achievements.push({
      id: 5,
      name: "Rising Star",
      description: "Reach 1500 rating",
      icon: "⭐",
      rarity: "CLASSIFIED",
      progress: 100
    });
  }
  
  if (user?.stats?.rating >= 2000) {
    achievements.push({
      id: 6,
      name: "Lambda Legend",
      description: "Reach 2000 rating",
      icon: "λ",
      rarity: "RESTRICTED",
      progress: 100
    });
  }
  
  return achievements;
};

// Activity is tracked through actual gameplay and API

interface ProfileProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

export function Profile({ onNavigate, isPremium }: ProfileProps) {
  const { user, refreshProfile, updateProfile, logout } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [bioText, setBioText] = useState(user?.bio || "No bio set yet. Click edit to add your story!");
  const [displayName, setDisplayName] = useState(user?.username || "");
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'friends' | 'private'>(user?.profileVisibility || 'public');
  const [showOnlineStatus, setShowOnlineStatus] = useState(user?.showOnlineStatus !== false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState(user?.customAvatarUrl || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    twitter: user?.socialLinks.twitter || '',
    youtube: user?.socialLinks.youtube || '',
    twitch: user?.socialLinks.twitch || '',
    discord: user?.socialLinks.discord || '',
    instagram: user?.socialLinks.instagram || '',
    website: user?.socialLinks.website || ''
  });
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEquippingBadge, setIsEquippingBadge] = useState(false);
  const [isEquippingFrame, setIsEquippingFrame] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBioText(user.bio || '');
    setDisplayName(user.displayName || user.username);
    setProfileVisibility(user.profileVisibility);
    setShowOnlineStatus(user.showOnlineStatus);
    setCustomAvatarUrl(user.customAvatarUrl || '');
    setSocialLinks({
      twitter: user.socialLinks.twitter || '', youtube: user.socialLinks.youtube || '',
      twitch: user.socialLinks.twitch || '', discord: user.socialLinks.discord || '',
      instagram: user.socialLinks.instagram || '', website: user.socialLinks.website || ''
    });
  }, [user]);
  
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleSearch = async () => {
    if (searchTerm.length < 2) return;
    
    setIsSearching(true);
    try {
      const { friendsAPI } = await import('../utils/api');
      const result = await friendsAPI.searchUsers(searchTerm);
      setSearchResults(result.users || []);
    } catch (error) {
      toast.error('Search failed', {
        description: 'Failed to search for users',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', {
        description: 'Please upload an image file',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      return;
    }

    // Data images are stored in PostgreSQL; keep the payload bounded.
    if (file.size > 1024 * 1024) {
      toast.error('File too large', {
        description: 'Maximum file size is 1MB',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        try {
          // Avatar upload via file not supported — avatar comes from Steam
          await updateProfile({ customAvatarUrl: base64Data, avatarSource: 'custom' });
          toast.success('Avatar updated', {
            description: 'Your profile picture has been updated successfully',
            className: 'bg-green-900/90 border-green-700 text-green-100'
          });
        } catch (error) {
          toast.error('Upload failed', {
            description: error instanceof Error ? error.message : 'Failed to upload avatar',
            className: 'bg-red-900/90 border-red-700 text-red-100'
          });
        } finally {
          setIsUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Upload failed', {
        description: 'Failed to process image',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      setIsUploadingAvatar(false);
    }
  };

  const handleEquipBadge = async (badgeId: string) => {
    setIsEquippingBadge(true);
    try {
      await userAPI.equipBadge(badgeId);
      await refreshProfile();
      toast.success('Badge equipped', {
        description: 'Your avatar badge has been updated',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error) {
      toast.error('Equip failed', {
        description: 'Failed to equip badge',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsEquippingBadge(false);
    }
  };

  const handleEquipFrame = async (frameId: string) => {
    setIsEquippingFrame(true);
    try {
      await userAPI.equipFrame(frameId);
      await refreshProfile();
      toast.success('Frame equipped', {
        description: 'Your profile frame has been updated',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error) {
      toast.error('Equip failed', {
        description: 'Failed to equip frame',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsEquippingFrame(false);
    }
  };

  const saveResearcherInfo = async () => {
    if (displayName.trim().length > 80 || bioText.length > 500) {
      toast.error('Invalid profile', { description: 'Display name or bio is too long' });
      return;
    }
    setIsSavingSettings(true);
    try {
      await updateProfile({ displayName: displayName.trim() || null, bio: bioText, profileVisibility, showOnlineStatus });
      setIsEditingProfile(false);
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Update failed', { description: error instanceof Error ? error.message : 'Unable to save profile' });
    } finally { setIsSavingSettings(false); }
  };

  const cancelResearcherEdit = () => {
    if (!user) return;
    setDisplayName(user.displayName || user.username);
    setBioText(user.bio || '');
    setProfileVisibility(user.profileVisibility);
    setShowOnlineStatus(user.showOnlineStatus);
    setIsEditingProfile(false);
  };

  const saveSocialLinks = async () => {
    setIsSavingSocial(true);
    try {
      await updateProfile({ socialLinks: Object.fromEntries(Object.entries(socialLinks).map(([key, value]) => [key, value.trim() || null])) as any });
      toast.success('Social links updated');
    } catch (error) {
      toast.error('Update failed', { description: error instanceof Error ? error.message : 'Unable to save social links' });
    } finally { setIsSavingSocial(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return toast.error('New password confirmation does not match');
    setIsChangingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password changed');
    } catch (error) {
      toast.error('Password change failed', { description: error instanceof Error ? error.message : 'Unable to change password' });
    } finally { setIsChangingPassword(false); }
  };
  
  // Create player data from user context
  const playerData = {
    name: user?.displayName || user?.username || "Guest",
    avatar: user?.resolvedAvatar || "",
    rank: isPremium ? "VIP RESEARCHER" : `LEVEL ${user?.level || 0} RESEARCHER`,
    level: user?.level || 0,
    experience: user?.experience || 0,
    maxExperience: 300, // 300 XP per level
    wins: user?.stats?.wins || 0,
    losses: user?.stats?.losses || 0,
    kda: user?.stats?.kills && user?.stats?.deaths 
      ? (user.stats.kills / Math.max(user.stats.deaths, 1)).toFixed(2)
      : "0.00",
    mainGames: ["Half-Life 1"]
  };
  
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'TOP SECRET': return 'bg-red-900/20 text-red-400 border-red-900/30';
      case 'CLASSIFIED': return 'bg-orange-900/20 text-orange-400 border-orange-900/30';
      case 'RESTRICTED': return 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30';
      case 'CONFIDENTIAL': return 'bg-blue-900/20 text-blue-400 border-blue-900/30';
      case 'UNCLASSIFIED': return 'bg-green-900/20 text-green-400 border-green-900/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-yellow-400';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 font-mono">PERSONNEL FILE</h1>
        <p className="text-gray-400 font-mono mt-1">Researcher profile and security clearance information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <PlayerProfile player={playerData} />
          
          {/* Steam Integration */}
          <SteamIntegration />
          
          {/* Social Media Links */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SOCIAL LINKS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {user?.steamProfileUrl ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
                  onClick={() => window.open(user.steamProfileUrl!, '_blank', 'noopener,noreferrer')}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <span>Steam</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              ) : null}
              
              {socialLinks.twitter ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-blue-900/30 text-blue-400 hover:bg-blue-900/10 font-mono"
                  onClick={() => window.open(socialLinks.twitter, '_blank', 'noopener,noreferrer')}
                >
                  <Twitter className="w-5 h-5 mr-3" />
                  <span>Twitter</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              ) : null}
              
              {socialLinks.youtube ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-red-900/30 text-red-400 hover:bg-red-900/10 font-mono"
                  onClick={() => window.open(socialLinks.youtube, '_blank', 'noopener,noreferrer')}
                >
                  <Youtube className="w-5 h-5 mr-3" />
                  <span>YouTube</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              ) : null}
              
              {socialLinks.twitch ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-purple-900/30 text-purple-400 hover:bg-purple-900/10 font-mono"
                  onClick={() => window.open(socialLinks.twitch, '_blank', 'noopener,noreferrer')}
                >
                  <Twitch className="w-5 h-5 mr-3" />
                  <span>Twitch</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              ) : null}
              
              {socialLinks.discord ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start border-indigo-900/30 text-indigo-400 hover:bg-indigo-900/10 font-mono"
                  onClick={() => window.open(socialLinks.discord, '_blank', 'noopener,noreferrer')}
                >
                  <MessageCircle className="w-5 h-5 mr-3" />
                  <span>Discord</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              ) : null}

              {socialLinks.instagram ? <Button variant="outline" className="w-full justify-start" onClick={() => window.open(socialLinks.instagram, '_blank', 'noopener,noreferrer')}><Instagram className="w-5 h-5 mr-3" />Instagram<ExternalLink className="w-3 h-3 ml-auto" /></Button> : null}
              {socialLinks.website ? <Button variant="outline" className="w-full justify-start" onClick={() => window.open(socialLinks.website, '_blank', 'noopener,noreferrer')}><Globe className="w-5 h-5 mr-3" />Website<ExternalLink className="w-3 h-3 ml-auto" /></Button> : null}
              
              {!user?.steamProfileUrl && !Object.values(socialLinks).some(Boolean) ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 font-mono text-sm">No social links added</p>
                  <p className="text-gray-500 font-mono text-xs mt-1">Add links in Settings tab</p>
                </div>
              ) : null}
            </CardContent>
          </Card>


          
          {/* Quick Stats */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">QUICK STATS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-sm">Platform Points</span>
                <span className="text-yellow-400 font-mono font-bold">{user?.points?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-sm">Current Rating</span>
                <span className="text-green-400 font-mono">{user?.stats?.rating || 1000}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-sm">Win Rate</span>
                <span className="text-orange-400 font-mono">
                  {user?.stats && user.stats.matchesPlayed > 0 
                    ? Math.round((user.stats.wins / user.stats.matchesPlayed) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-sm">Total Matches</span>
                <span className="text-orange-400 font-mono">{user?.stats?.matchesPlayed || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono text-sm">K/D Ratio</span>
                <span className="text-orange-400 font-mono">{playerData.kda}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 bg-black/40 border border-orange-900/20">
              <TabsTrigger value="overview" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                OVERVIEW
              </TabsTrigger>
              <TabsTrigger value="badges" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                BADGES
              </TabsTrigger>
              <TabsTrigger value="matches" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                MATCHES
              </TabsTrigger>
              <TabsTrigger value="achievements" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                ACHIEVEMENTS
              </TabsTrigger>
              <TabsTrigger value="friends" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                FRIENDS
              </TabsTrigger>
              <TabsTrigger value="settings" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                SETTINGS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Profile Info */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">RESEARCHER INFORMATION</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar className="w-20 h-20 border-2 border-orange-900/30">
                        <AvatarImage src={playerData.avatar} alt={playerData.name} />
                        <AvatarFallback className="bg-orange-900/20 text-orange-400 text-xl">
                          {playerData.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        size="sm"
                        className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30"
                        onClick={handleAvatarClick}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-orange-400 font-mono">{playerData.name}</h3>
                      <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono mt-1">
                        {playerData.rank}
                      </Badge>
                      <div className="mt-2 text-gray-400 font-mono text-sm">
                        Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'} • Last seen: Online now
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
                      onClick={() => setIsEditingProfile(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      EDIT
                    </Button>
                  </div>

                  {isEditingProfile && (
                    <div className="pt-4 border-t border-orange-900/20 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm text-gray-400 font-mono">Display Name</label><Input value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 bg-black/20 border-orange-900/20" /></div>
                        <div><label className="text-sm text-gray-400 font-mono">Profile Visibility</label><Select value={profileVisibility} onValueChange={(value) => setProfileVisibility(value as typeof profileVisibility)}><SelectTrigger className="mt-1 bg-black/20 border-orange-900/20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="friends">Friends</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select></div>
                      </div>
                      <div><label className="text-sm text-gray-400 font-mono">Bio</label><Textarea value={bioText} maxLength={500} onChange={(e) => setBioText(e.target.value)} className="mt-1 bg-black/20 border-orange-900/20" /></div>
                      <div className="flex items-center justify-between"><label className="text-sm text-gray-400 font-mono">Show Online Status</label><Switch checked={showOnlineStatus} onCheckedChange={setShowOnlineStatus} /></div>
                      <div className="flex gap-3 justify-end"><Button variant="outline" onClick={cancelResearcherEdit}>CANCEL</Button><Button onClick={saveResearcherInfo} disabled={isSavingSettings}>{isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SAVE'}</Button></div>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-orange-900/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-mono text-green-400">BIO SECTION</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-900/30 text-green-400 hover:bg-green-900/10 font-mono"
                        onClick={() => setIsEditingBio(!isEditingBio)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {isEditingBio ? 'CANCEL' : 'EDIT'}
                      </Button>
                    </div>
                    {isEditingBio ? (
                      <div className="space-y-2">
                        <Textarea
                          value={bioText}
                          onChange={(e) => setBioText(e.target.value)}
                          className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                          rows={4}
                          maxLength={500}
                        />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 font-mono">
                            {bioText.length}/500 characters
                          </span>
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await updateProfile({ bio: bioText });
                                setIsEditingBio(false);
                                toast.success('Bio updated', {
                                  description: 'Your bio has been updated successfully',
                                  className: 'bg-green-900/90 border-green-700 text-green-100'
                                });
                              } catch (error) {
                                toast.error('Update failed', {
                                  description: 'Failed to update bio',
                                  className: 'bg-red-900/90 border-red-700 text-red-100'
                                });
                              }
                            }}
                            className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono"
                          >
                            SAVE BIO
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-300 font-mono text-sm leading-relaxed">
                        {user?.bio || "No bio set yet. Click edit to add your story!"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">RECENT ACTIVITY</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-8 bg-black/20 border border-orange-900/20 rounded-lg">
                    <Target className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                    <div className="text-gray-400 font-mono text-sm mb-2">
                      Activity tracking coming soon
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      Your recent matches, achievements, and social activity will appear here
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Status */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">PERSONNEL SYSTEM STATUS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-sm">Account Status</span>
                    <Badge className="bg-green-900/20 text-green-400 border-green-900/30 font-mono">
                      {user?.id ? 'ACTIVE' : 'SUSPENDED'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-sm">Security Clearance</span>
                    <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
                      {isPremium ? `VIP - LEVEL ${user?.level || 0}` : `LEVEL ${user?.level || 0}`}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-sm">Steam Integration</span>
                    <Badge className={user?.steamId ? "bg-green-900/20 text-green-400 border-green-900/30 font-mono" : "bg-red-900/20 text-red-400 border-red-900/30 font-mono"}>
                      {user?.steamId ? 'LINKED' : 'NOT LINKED'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-sm">Account Type</span>
                    <Badge className={isPremium ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-mono" : "bg-gray-900/20 text-gray-400 border-gray-900/30 font-mono"}>
                      {isPremium ? 'VIP MEMBER' : 'STANDARD'}
                    </Badge>
                  </div>
                  
                  <div className="pt-2 border-t border-orange-900/20">
                    <div className="text-xs text-gray-500 font-mono">
                      Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'} • Online now
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="badges" className="space-y-6">
              {/* Avatar Badges */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono flex items-center justify-between">
                    <span>AVATAR BADGES</span>
                    <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30">
                      {avatarBadges.length} Available
                    </Badge>
                  </CardTitle>
                  <div className="text-sm text-gray-400 font-mono">
                    Customize your profile with unique avatar badges
                  </div>
                </CardHeader>
                <CardContent>
                  {avatarBadges.filter(badge => user?.ownedBadges?.includes(badge.id)).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {avatarBadges.filter(badge => user?.ownedBadges?.includes(badge.id)).map((badge) => {
                        const isEquipped = user?.equippedBadge === badge.id;
                        
                        return (
                          <div 
                            key={badge.id} 
                            className={`relative p-4 border rounded-lg text-center cursor-pointer transition-all ${
                              isEquipped
                                ? `bg-orange-900/30 border-orange-400 ${getRarityGlow(badge.rarity)}`
                                : `bg-orange-900/20 border-orange-900/30 hover:border-orange-900/50 ${getRarityGlow(badge.rarity)}`
                            }`}
                            onClick={() => handleEquipBadge(badge.id)}
                          >
                            <div className="text-4xl mb-2">{badge.icon}</div>
                            <div className="text-xs font-mono text-orange-400 mb-1">{badge.name}</div>
                            <Badge className={`text-xs font-mono ${getRarityColor(badge.rarity)}`}>
                              {badge.rarity}
                            </Badge>
                            
                            {isEquipped && (
                              <div className="mt-2">
                                <Badge className="bg-green-900/20 text-green-400 border-green-900/30 text-xs">
                                  EQUIPPED
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-black/20 border border-orange-900/20 rounded-lg">
                      <Award className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                      <div className="text-gray-400 font-mono text-sm mb-4">
                        No badges owned yet. Purchase badges from the Store!
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => onNavigate?.('store')}
                      className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                    >
                      VISIT STORE
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Frames */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono flex items-center justify-between">
                    <span>PROFILE FRAMES</span>
                    <Badge className="bg-orange-900/20 text-orange-400 border-orange-900/30">
                      {profileFrames.length} Available
                    </Badge>
                  </CardTitle>
                  <div className="text-sm text-gray-400 font-mono">
                    Enhance your profile with distinctive frames
                  </div>
                </CardHeader>
                <CardContent>
                  {profileFrames.filter(frame => user?.ownedFrames?.includes(frame.id)).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {profileFrames.filter(frame => user?.ownedFrames?.includes(frame.id)).map((frame) => {
                        const isEquipped = user?.equippedFrame === frame.id;
                        
                        return (
                          <div 
                            key={frame.id} 
                            className={`relative p-4 border rounded-lg text-center cursor-pointer transition-all ${
                              isEquipped
                                ? `bg-orange-900/30 border-orange-400 ${getRarityGlow(frame.rarity)}`
                                : `bg-orange-900/20 border-orange-900/30 hover:border-orange-900/50 ${getRarityGlow(frame.rarity)}`
                            }`}
                            onClick={() => handleEquipFrame(frame.id)}
                          >
                            <div className="text-4xl mb-2">{frame.icon}</div>
                            <div className="text-xs font-mono text-orange-400 mb-1">{frame.name}</div>
                            <Badge className={`text-xs font-mono ${getRarityColor(frame.rarity)}`}>
                              {frame.rarity}
                            </Badge>
                            
                            {isEquipped && (
                              <div className="mt-2">
                                <Badge className="bg-green-900/20 text-green-400 border-green-900/30 text-xs">
                                  EQUIPPED
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-black/20 border border-orange-900/20 rounded-lg">
                      <Trophy className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                      <div className="text-gray-400 font-mono text-sm mb-4">
                        No frames owned yet. Purchase frames from the Store!
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 text-center">
                    <Button
                      onClick={() => onNavigate?.('store')}
                      className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                    >
                      VISIT STORE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matches" className="space-y-6">
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">MATCH HISTORY</CardTitle>
                  <div className="text-sm text-gray-400 font-mono">
                    Your competitive match history and performance data
                  </div>
                </CardHeader>
                <CardContent>
                  {user?.stats && user.stats.matchesPlayed > 0 ? (
                    <>
                      <div className="space-y-4">
                        <div className="text-center p-8 bg-black/20 border border-orange-900/20 rounded-lg">
                          <div className="text-gray-400 font-mono text-sm">
                            Match history will be displayed here once you complete your first match
                          </div>
                          <Button
                            onClick={() => onNavigate?.('lobby')}
                            className="mt-4 bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                          >
                            Start Matchmaking
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-orange-900/20">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-green-400 font-mono">
                              {user.stats.matchesPlayed > 0 
                                ? Math.round((user.stats.wins / user.stats.matchesPlayed) * 100) 
                                : 0}%
                            </div>
                            <div className="text-xs text-gray-400 font-mono">Win Rate</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-400 font-mono">{playerData.kda}</div>
                            <div className="text-xs text-gray-400 font-mono">K/D Ratio</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-400 font-mono">{user.stats.matchesPlayed}</div>
                            <div className="text-xs text-gray-400 font-mono">Total Matches</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-12 bg-black/20 border border-orange-900/20 rounded-lg">
                      <Trophy className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                      <div className="text-gray-400 font-mono text-sm mb-4">
                        No matches played yet. Start your competitive journey now!
                      </div>
                      <Button
                        onClick={() => onNavigate?.('lobby')}
                        className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                      >
                        Start Matchmaking
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6">
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">RESEARCH ACHIEVEMENTS</CardTitle>
                  <div className="text-sm text-gray-400 font-mono">
                    Earned through competitive gameplay
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const userAchievements = getAchievements(user);
                    return userAchievements.length > 0 ? (
                      <div className="grid gap-4">
                        {userAchievements.map((achievement) => (
                          <div 
                            key={achievement.id} 
                            className="p-4 border rounded-lg bg-orange-900/10 border-orange-900/30"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="text-2xl">{achievement.icon}</div>
                                <div>
                                  <div className="font-mono text-orange-400">{achievement.name}</div>
                                  <div className="text-sm text-gray-400 font-mono">{achievement.description}</div>
                                  <Badge className={`mt-1 font-mono ${getRarityColor(achievement.rarity)}`}>
                                    {achievement.rarity}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-green-400 font-mono">UNLOCKED</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-12 bg-black/20 border border-orange-900/20 rounded-lg">
                        <Award className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                        <div className="text-gray-400 font-mono text-sm mb-4">
                          No achievements unlocked yet
                        </div>
                        <div className="text-xs text-gray-500 font-mono mb-4">
                          Complete matches and improve your skills to unlock achievements
                        </div>
                        <Button
                          onClick={() => onNavigate?.('lobby')}
                          className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                        >
                          Start Playing
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="friends" className="space-y-6">
              {/* Friend Search */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">SEARCH OPERATIVES</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <Input 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by username..."
                      className="flex-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button 
                      onClick={handleSearch}
                      disabled={isSearching || searchTerm.length < 2}
                      className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono disabled:opacity-50"
                    >
                      {isSearching ? 'SEARCHING...' : 'SEARCH'}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <div key={result.id} className="flex items-center justify-between p-3 bg-black/20 border border-orange-900/20 rounded">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10 border-2 border-orange-900/30">
                              <AvatarImage src={result.avatar} alt={result.username} />
                              <AvatarFallback className="bg-orange-900/20 text-orange-400">
                                {result.username.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-orange-400 font-mono">{result.username}</span>
                                {result.isPremium && (
                                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs">
                                    VIP
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                Security Level {result.level || 1}
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            onClick={async () => {
                              try {
                                const { friendsAPI } = await import('../utils/api');
                                await friendsAPI.sendFriendRequest(result.id);
                                toast.success('Friend request sent', {
                                  className: 'bg-green-900/90 border-green-700 text-green-100'
                                });
                              } catch (error) {
                                toast.error('Failed to send request', {
                                  className: 'bg-red-900/90 border-red-700 text-red-100'
                                });
                              }
                            }}
                            className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            ADD
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <div className="text-center p-8 bg-black/20 border border-orange-900/20 rounded-lg">
                      <div className="text-gray-400 font-mono text-sm">
                        No operatives found matching "{searchTerm}"
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Friends List */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">FRIENDS & MESSAGES</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-12 bg-black/20 border border-orange-900/20 rounded-lg">
                    <Users className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                    <div className="text-gray-400 font-mono text-sm mb-2">
                      No friends added yet
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      Use the search above to find and add friends
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">ACCOUNT SETTINGS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 font-mono">Display Name</label>
                      <Input 
                        value={displayName}
                        disabled
                        className="mt-1 bg-black/20 border-orange-900/20 text-gray-500 font-mono cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        Name changes require 1300 platform points
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 font-mono">Bio</label>
                      <Textarea 
                        value={bioText}
                        onChange={(e) => setBioText(e.target.value)}
                        className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                        rows={3}
                        maxLength={500}
                      />
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        {bioText.length}/500 characters
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 font-mono">Privacy Settings</label>
                      <div className="mt-2 space-y-2">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" checked={showOnlineStatus} onChange={(e) => setShowOnlineStatus(e.target.checked)} className="form-checkbox" />
                          <span className="text-gray-300 font-mono text-sm">Show online status</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" disabled className="form-checkbox" />
                          <span className="text-gray-500 font-mono text-sm">Allow friend requests (not available)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" disabled className="form-checkbox" />
                          <span className="text-gray-500 font-mono text-sm">Show match history (not available)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-orange-900/20 flex space-x-4">
                    <Button 
                      onClick={async () => {
                        setIsSavingSettings(true);
                        try {
                          await updateProfile({ bio: bioText, showOnlineStatus });
                          toast.success('Bio updated', {
                            description: 'Your profile bio has been updated successfully',
                            className: 'bg-green-900/90 border-green-700 text-green-100'
                          });
                        } catch (error) {
                          toast.error('Update failed', {
                            description: 'Failed to update bio',
                            className: 'bg-red-900/90 border-red-700 text-red-100'
                          });
                        } finally {
                          setIsSavingSettings(false);
                        }
                      }}
                      disabled={isSavingSettings}
                      className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono disabled:opacity-50"
                    >
                      {isSavingSettings ? 'SAVING...' : 'SAVE BIO'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono"
                      onClick={() => {
                        setBioText(user?.bio || "No bio set yet. Click edit to add your story!");
                        toast.info('Changes cancelled', {
                          className: 'bg-gray-900/90 border-gray-700 text-gray-100'
                        });
                      }}
                    >
                      CANCEL
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader><CardTitle className="text-orange-400 font-mono">AVATAR SETTINGS</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Input value={customAvatarUrl} onChange={(e) => setCustomAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.png" className="bg-black/20 border-orange-900/20" />
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={async () => { try { await updateProfile({ customAvatarUrl: customAvatarUrl.trim(), avatarSource: 'custom' }); toast.success('Custom avatar selected'); } catch (error) { toast.error('Avatar update failed', { description: error instanceof Error ? error.message : undefined }); } }}>USE CUSTOM URL</Button>
                    <Button variant="outline" onClick={handleAvatarClick}>UPLOAD IMAGE</Button>
                    <Button variant="outline" disabled={!user?.steamAvatar} onClick={async () => { await updateProfile({ avatarSource: 'steam' }); toast.success('Steam avatar selected'); }}>USE STEAM AVATAR</Button>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">Changing the active avatar never overwrites the stored Steam avatar.</p>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader><CardTitle className="text-orange-400 font-mono">SECURITY & SESSION</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="bg-black/20 border-orange-900/20" />
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ characters)" className="bg-black/20 border-orange-900/20" />
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="bg-black/20 border-orange-900/20" />
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={changePassword} disabled={isChangingPassword || !currentPassword || !newPassword}>{isChangingPassword ? 'CHANGING...' : 'CHANGE PASSWORD'}</Button>
                    <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><LogOut className="w-4 h-4 mr-2" />LOG OUT</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Log out of Sector Nine?</AlertDialogTitle><AlertDialogDescription>Your local session token will be cleared.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>CANCEL</AlertDialogCancel><AlertDialogAction onClick={() => { logout(); onNavigate?.('auth'); }}>LOG OUT</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media Settings */}
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono">SOCIAL MEDIA LINKS</CardTitle>
                  <div className="text-sm text-gray-400 font-mono">
                    Add your social media profiles to appear in your personnel file
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 font-mono">Steam Profile URL</label>
                    <Input 
                      value={user?.steamProfileUrl || ''}
                      disabled
                      placeholder="https://steamcommunity.com/id/your_profile"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 font-mono">X/Twitter URL</label>
                    <Input 
                      value={socialLinks.twitter}
                      onChange={(e) => setSocialLinks({...socialLinks, twitter: e.target.value})}
                      placeholder="https://x.com/your_username"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 font-mono">YouTube URL</label>
                    <Input 
                      value={socialLinks.youtube}
                      onChange={(e) => setSocialLinks({...socialLinks, youtube: e.target.value})}
                      placeholder="https://youtube.com/@channel"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 font-mono">Twitch URL</label>
                    <Input 
                      value={socialLinks.twitch}
                      onChange={(e) => setSocialLinks({...socialLinks, twitch: e.target.value})}
                      placeholder="https://twitch.tv/your_name"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 font-mono">Discord URL</label>
                    <Input 
                      value={socialLinks.discord}
                      onChange={(e) => setSocialLinks({...socialLinks, discord: e.target.value})}
                      placeholder="https://discord.com/users/..."
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>
                  <div><label className="text-sm text-gray-400 font-mono">Instagram URL</label><Input value={socialLinks.instagram} onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})} placeholder="https://instagram.com/your_name" className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono" /></div>
                  <div><label className="text-sm text-gray-400 font-mono">Personal Website</label><Input value={socialLinks.website} onChange={(e) => setSocialLinks({...socialLinks, website: e.target.value})} placeholder="https://example.com" className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono" /></div>
                  
                  <div className="pt-4 border-t border-orange-900/20 flex space-x-4">
                    <Button 
                      onClick={saveSocialLinks}
                      disabled={isSavingSocial}
                      className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono disabled:opacity-50"
                    >
                      {isSavingSocial ? 'UPDATING...' : 'UPDATE LINKS'}
                    </Button>
                    <Button variant="outline" onClick={() => user && setSocialLinks({ twitter: user.socialLinks.twitter || '', youtube: user.socialLinks.youtube || '', twitch: user.socialLinks.twitch || '', discord: user.socialLinks.discord || '', instagram: user.socialLinks.instagram || '', website: user.socialLinks.website || '' })}>CANCEL</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
