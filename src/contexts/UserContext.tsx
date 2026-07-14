import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, userAPI } from '../utils/api';
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

interface UserContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => void;
}

// =====================================================
// CONTEXT
// =====================================================

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const logout = () => {
    authAPI.signout();
    setUser(null);
  };

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
      logout,
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
  const customAvatarUrl = raw.customAvatarUrl ?? null;
  const avatarSource = raw.avatarSource === 'custom' ? 'custom' : 'steam';
  const resolvedAvatar = avatarSource === 'custom' && customAvatarUrl
    ? customAvatarUrl
    : raw.steamAvatar || defaultAvatar;
  const socialLinks = raw.socialLinks || {};

  return {
    id:                raw.id ?? '',
    email:             raw.email ?? '',
    username:          raw.username ?? '',
    displayName:       raw.displayName ?? null,
    bio:               raw.bio ?? '',
    isPremium:         raw.isPremium ?? false,
    vipSince:          raw.vipSince ?? null,
    vipMethod:         raw.vipMethod ?? null,
    points:            raw.points ?? 0,
    experience:        raw.experience ?? 0,
    level:             raw.level ?? 1,
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
    wins:              raw.wins ?? 0,
    losses:            raw.losses ?? 0,
    winStreak:         raw.winStreak ?? 0,
    bestWinStreak:     raw.bestWinStreak ?? 0,
    totalKills:        raw.totalKills ?? 0,
    totalDeaths:       raw.totalDeaths ?? 0,
    profileVisibility: raw.profileVisibility ?? 'public',
    showOnlineStatus:  raw.showOnlineStatus ?? true,
    createdAt:         raw.createdAt ?? new Date().toISOString(),
    lastSeen:          raw.lastSeen ?? null,
    stats: {
      matchesPlayed: raw.stats?.matchesPlayed ?? 0,
      wins:          raw.stats?.wins ?? 0,
      losses:        raw.stats?.losses ?? 0,
      kills:         raw.stats?.kills ?? 0,
      deaths:        raw.stats?.deaths ?? 0,
      rating:        raw.stats?.rating ?? 0,
      winRate:       raw.stats?.winRate ?? 0,
      kda:           raw.stats?.kda ?? '0.00',
    },
  };
}
