import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, friendsAPI, presenceAPI, userAPI } from '../utils/api';
const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%230b0b0b"/%3E%3Ctext x="50" y="68" text-anchor="middle" font-size="62" fill="%23fb923c"%3E%CE%BB%3C/text%3E%3C/svg%3E';

// =====================================================
// TYPES — must match toProfile() in src/server/index.ts
// =====================================================

export interface UserStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  rating: number;
  winRate: number;      // 0–100 percent
  kda: string;          // "1.45" or "Perfect" or "0.00"
}

export interface UserProfile {
  // Identity
  id: string;
  role: 'user' | 'admin';
  email: string;
  username: string;
  displayName: string | null;
  bio: string;

  // VIP / subscription
  isPremium: boolean;
  vipSince: string | null;
  vipMethod: string | null;

  // Economy
  points: number;
  experience: number;
  level: number;

  // Cosmetics
  equippedBadge: string | null;
  equippedFrame: string | null;
  ownedBadges: string[];
  ownedFrames: string[];

  // Steam
  steamId: string | null;
  steamAvatar: string | null;
  customAvatarUrl: string | null;
  avatarSource: 'steam' | 'custom';
  resolvedAvatar: string;
  steamProfileUrl: string | null;
  socialLinks: SocialLinks;
  steamVerified: boolean;
  ownsHL1: boolean;
  vacBanned: boolean;
  gameBanned: boolean;

  // Match history totals
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  totalKills: number;
  totalDeaths: number;

  // Privacy settings
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  notificationPreferences: NotificationPreferences;

  // Timestamps
  createdAt: string;
  lastSeen: string | null;

  // Computed stats block
  stats: UserStats;
}

export interface SocialLinks {
  discord: string | null;
  youtube: string | null;
  twitch: string | null;
  twitter: string | null;
  instagram: string | null;
  website: string | null;
}

export interface NotificationPreferences {
  matchFound: boolean;
  friendRequests: boolean;
  tournaments: boolean;
  messages: boolean;
  social: boolean;
  systemMaintenance: boolean;
  securityAlerts: boolean;
}

interface UserContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  adoptProfile: (profile: unknown) => void;
  changeDisplayName: (displayName: string) => Promise<void>;
  logout: () => void;
  onlineFriends: OnlineFriend[];
  onlineFriendsLoading: boolean;
  onlineFriendsError: string | null;
  refreshOnlineFriends: () => Promise<void>;
}

export interface OnlineFriend {
  id: string;
  username: string;
  displayName: string | null;
  resolvedAvatar: string | null;
  equippedFrame: string | null;
  lastSeen: string;
  isOnline: true;
}

// =====================================================
// CONTEXT
// =====================================================

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [onlineFriendsLoading, setOnlineFriendsLoading] = useState(false);
  const [onlineFriendsError, setOnlineFriendsError] = useState<string | null>(null);

  const refreshOnlineFriends = async () => {
    setOnlineFriendsLoading(true);
    try {
      const result = await friendsAPI.getOnline();
      setOnlineFriends(Array.isArray(result.friends) ? result.friends : []);
      setOnlineFriendsError(null);
    } catch (error) {
      setOnlineFriendsError(error instanceof Error ? error.message : 'Unable to refresh online friends');
      throw error;
    } finally {
      setOnlineFriendsLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const { profile } = await userAPI.getProfile();
      setUser(normalizeProfile(profile));
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      setUser(null);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const { profile } = await userAPI.updateProfile(updates);
    setUser(normalizeProfile(profile));
  };
  const adoptProfile = (profile: unknown) => setUser(normalizeProfile(profile));

  const changeDisplayName = async (displayName: string) => {
    const { profile } = await userAPI.changeDisplayName(displayName);
    setUser(normalizeProfile(profile));
  };

  const logout = () => {
    void presenceAPI.offline().catch(() => undefined);
    authAPI.signout();
    setUser(null);
    setOnlineFriends([]);
    setOnlineFriendsError(null);
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const poll = async () => { if (active) await refreshOnlineFriends().catch(() => undefined); };
    const heartbeat = async () => { if (active) await presenceAPI.heartbeat().catch(() => undefined); };
    void poll();
    void heartbeat();
    const presenceInterval = window.setInterval(poll, 15000);
    const heartbeatInterval = window.setInterval(heartbeat, 90000);
    return () => {
      active = false;
      window.clearInterval(presenceInterval);
      window.clearInterval(heartbeatInterval);
    };
  }, [user?.id]);

  useEffect(() => {
    const initUser = async () => {
      try {
        const token = localStorage.getItem('session_token');
        if (token) {
          try {
            await refreshProfile();
          } catch {
            authAPI.signout();
          }
        }
      } catch (error) {
        console.error('Failed to initialize user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initUser();
  }, []);

  return (
    <UserContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: user !== null,
      refreshProfile,
      updateProfile,
      adoptProfile,
      changeDisplayName,
      logout,
      onlineFriends,
      onlineFriendsLoading,
      onlineFriendsError,
      refreshOnlineFriends,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// =====================================================
// NORMALIZER
// Fills in safe defaults for any field the server
// might not return yet (e.g. before migration runs)
// =====================================================

function normalizeProfile(raw: any): UserProfile {
  const finiteNumber = (value: unknown, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const customAvatarUrl = raw.customAvatarUrl ?? null;
  const avatarSource = raw.avatarSource === 'custom' ? 'custom' : 'steam';
  const resolvedAvatar = avatarSource === 'custom' && customAvatarUrl
    ? customAvatarUrl
    : raw.steamAvatar || defaultAvatar;
  const socialLinks = raw.socialLinks || {};
  const notificationPreferences = raw.notificationPreferences || {};

  return {
    id:                raw.id ?? '',
    role:              raw.role === 'admin' ? 'admin' : 'user',
    email:             raw.email ?? '',
    username:          raw.username ?? '',
    displayName:       raw.displayName ?? null,
    bio:               raw.bio ?? '',
    isPremium:         raw.isPremium ?? false,
    vipSince:          raw.vipSince ?? null,
    vipMethod:         raw.vipMethod ?? null,
    points:            finiteNumber(raw.points),
    experience:        finiteNumber(raw.experience),
    level:             finiteNumber(raw.level),
    equippedBadge:     raw.equippedBadge ?? null,
    equippedFrame:     raw.equippedFrame ?? null,
    ownedBadges:       raw.ownedBadges ?? [],
    ownedFrames:       raw.ownedFrames ?? [],
    steamId:           raw.steamId ?? null,
    steamAvatar:       raw.steamAvatar ?? null,
    customAvatarUrl,
    avatarSource,
    resolvedAvatar,
    steamProfileUrl:   raw.steamProfileUrl ?? null,
    socialLinks: {
      discord: socialLinks.discord ?? null,
      youtube: socialLinks.youtube ?? null,
      twitch: socialLinks.twitch ?? null,
      twitter: socialLinks.twitter ?? null,
      instagram: socialLinks.instagram ?? null,
      website: socialLinks.website ?? null,
    },
    steamVerified:     raw.steamVerified ?? false,
    ownsHL1:           raw.ownsHL1 ?? false,
    vacBanned:         raw.vacBanned ?? false,
    gameBanned:        raw.gameBanned ?? false,
    wins:              finiteNumber(raw.wins),
    losses:            finiteNumber(raw.losses),
    winStreak:         finiteNumber(raw.winStreak),
    bestWinStreak:     finiteNumber(raw.bestWinStreak),
    totalKills:        finiteNumber(raw.totalKills),
    totalDeaths:       finiteNumber(raw.totalDeaths),
    profileVisibility: raw.profileVisibility ?? 'public',
    showOnlineStatus:  raw.showOnlineStatus ?? true,
    notificationPreferences: {
      matchFound: notificationPreferences.matchFound ?? true,
      friendRequests: notificationPreferences.friendRequests ?? true,
      tournaments: notificationPreferences.tournaments ?? true,
      messages: notificationPreferences.messages ?? true,
      social: notificationPreferences.social ?? true,
      systemMaintenance: notificationPreferences.systemMaintenance ?? true,
      securityAlerts: notificationPreferences.securityAlerts ?? true,
    },
    createdAt:         raw.createdAt ?? new Date().toISOString(),
    lastSeen:          raw.lastSeen ?? null,
    stats: {
      matchesPlayed: finiteNumber(raw.stats?.matchesPlayed, finiteNumber(raw.wins) + finiteNumber(raw.losses)),
      wins:          finiteNumber(raw.stats?.wins, finiteNumber(raw.wins)),
      losses:        finiteNumber(raw.stats?.losses, finiteNumber(raw.losses)),
      kills:         finiteNumber(raw.stats?.kills, finiteNumber(raw.totalKills)),
      deaths:        finiteNumber(raw.stats?.deaths, finiteNumber(raw.totalDeaths)),
      rating:        finiteNumber(raw.stats?.rating, finiteNumber(raw.experience)),
      winRate:       finiteNumber(raw.stats?.winRate),
      kda:           Number.isFinite(Number(raw.stats?.kda)) ? Number(raw.stats.kda).toFixed(2) : '0.00',
    },
  };
}
