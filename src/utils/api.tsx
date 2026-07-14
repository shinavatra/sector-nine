// =====================================================
// API CLIENT — points at local Express server
// No Supabase. Pure PostgreSQL backend.
// =====================================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

let sessionToken: string | null = null

export const setSessionToken = (token: string | null) => {
  sessionToken = token
  if (token) {
    localStorage.setItem('session_token', token)
  } else {
    localStorage.removeItem('session_token')
  }
}

export const getSessionToken = (): string | null => {
  if (sessionToken) return sessionToken
  sessionToken = localStorage.getItem('session_token')
  return sessionToken
}

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers)
  const token = getSessionToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(error.error || `HTTP ${response.status}`, response.status, error.code)
  }
  return response.json()
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// =====================================================
// AUTH
// =====================================================

export const authAPI = {
  signup: async (email: string, password: string, username: string) => {
    const data = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    })
    if (data.session?.access_token) setSessionToken(data.session.access_token)
    return data
  },

  signin: async (email: string, password: string) => {
    const data = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (data.session?.access_token) setSessionToken(data.session.access_token)
    return data
  },

  resetPassword: async (email: string) =>
    apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) }),

  updatePassword: async (resetToken: string, newPassword: string) =>
    apiFetch('/auth/update-password', { method: 'POST', body: JSON.stringify({ resetToken, newPassword }) }),

  signout: () => setSessionToken(null),
}

// =====================================================
// USER PROFILE
// =====================================================

export const userAPI = {
  getProfile: async () =>
    apiFetch('/user/profile'),

  updateProfile: async (updates: Record<string, any>) =>
    apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(updates) }),

  upgradeToVIP: async (method: 'points' | 'payment' = 'points') =>
    apiFetch('/user/vip/purchase', { method: 'POST', body: JSON.stringify({ method }) }),

  cancelVIP: async () =>
    apiFetch('/user/vip/cancel', { method: 'POST' }),

  purchaseBadge: async (badgeId: string, pointsCost: number) =>
    apiFetch('/user/badge/purchase', { method: 'POST', body: JSON.stringify({ badgeId, pointsCost }) }),

  purchaseFrame: async (frameId: string, pointsCost: number) =>
    apiFetch('/user/frame/purchase', { method: 'POST', body: JSON.stringify({ frameId, pointsCost }) }),

  equipBadge: async (badgeId: string) =>
    apiFetch('/user/badge/equip', { method: 'POST', body: JSON.stringify({ badgeId }) }),

  equipFrame: async (frameId: string) =>
    apiFetch('/user/frame/equip', { method: 'POST', body: JSON.stringify({ frameId }) }),

  // Links Steam ID — server also fetches avatar + HL1 ownership automatically
  linkSteam: async (steamId: string) =>
    apiFetch('/steam/link', { method: 'POST', body: JSON.stringify({ steamId }) }),
}

// =====================================================
// MATCHMAKING
// =====================================================

export const matchmakingAPI = {
  joinQueue: async (gameMode: string, selectedMaps: string[]) =>
    apiFetch('/matchmaking/join', { method: 'POST', body: JSON.stringify({ gameMode, selectedMaps }) }),

  leaveQueue: async () =>
    apiFetch('/matchmaking/leave', { method: 'POST' }),

  getMatch: async (matchId: string) =>
    apiFetch(`/match/${matchId}`),

  submitResult: async (matchId: string, winnerId: string, stats: Record<string, any>) =>
    apiFetch(`/match/${matchId}/result`, { method: 'POST', body: JSON.stringify({ winnerId, stats }) }),
}

// =====================================================
// FRIENDS
// =====================================================

export const friendsAPI = {
  getFriends: async () =>
    apiFetch('/friends'),

  searchUsers: async (searchTerm: string) =>
    apiFetch(`/friends/search?q=${encodeURIComponent(searchTerm)}`),

  sendFriendRequest: async (targetUserId: string) =>
    apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ targetUserId }) }),

  acceptRequest: async (requestId: string) =>
    apiFetch('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),
}

// =====================================================
// CHAT
// =====================================================

export const chatAPI = {
  getMessages: async (roomId: string) =>
    apiFetch(`/chat/${roomId}`),

  sendMessage: async (roomId: string, message: string) =>
    apiFetch(`/chat/${roomId}`, { method: 'POST', body: JSON.stringify({ message }) }),

  deleteMessage: async (roomId: string, messageId: string) =>
    apiFetch(`/chat/${roomId}/${messageId}`, { method: 'DELETE' }),
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export const notificationsAPI = {
  getNotifications: async () =>
    apiFetch('/notifications'),

  markAsRead: async (notificationId: string) =>
    apiFetch(`/notifications/${notificationId}/read`, { method: 'PUT' }),

  markAllAsRead: async () =>
    apiFetch('/notifications/read-all', { method: 'PUT' }),
}

// =====================================================
// TOURNAMENTS
// =====================================================

export const tournamentAPI = {
  getAll: async () =>
    apiFetch('/tournaments'),

  getById: async (id: string) =>
    apiFetch(`/tournaments/${id}`),

  register: async (tournamentId: string) =>
    apiFetch(`/tournament/${tournamentId}/register`, { method: 'POST' }),

  getParticipants: async (tournamentId: string) =>
    apiFetch(`/tournament/${tournamentId}/participants`),
}

// =====================================================
// STATS & LEADERBOARD
// =====================================================

export const statsAPI = {
  getLeaderboard: async () =>
    apiFetch('/leaderboard'),

  getMatchHistory: async () =>
    apiFetch('/matches/history'),

  getActiveMatches: async () =>
    apiFetch('/matches/active'),

  getUserStats: async () =>
    apiFetch('/user/stats'),

  // Used by Hub page for platform-wide numbers
  getPlatformStats: async () =>
    apiFetch('/stats/platform'),

  // Used by ladder pages — season is: 'monthly' | 'winter' | 'spring' | 'summer' | 'autumn'
  getLadder: async (season: string) =>
    apiFetch(`/ladder/${season}`),

  getAllSeasons: async () =>
    apiFetch('/ladder/seasons'),
}

// =====================================================
// STORE
// =====================================================

export const storeAPI = {
  getBadges: async () =>
    apiFetch('/badges'),

  getFrames: async () =>
    apiFetch('/frames'),
}

// =====================================================
// REPORTING & BANS
// =====================================================

export const reportAPI = {
  reportPlayer: async (reportedUserId: string, reason: string, description: string) =>
    apiFetch('/report', { method: 'POST', body: JSON.stringify({ reportedUserId, reason, description }) }),

  getBanStatus: async () =>
    apiFetch('/ban/status'),

  // Called when a player declines a match ready — escalates their ban level
  issueBan: async (reason: string, userId?: string) =>
    apiFetch('/ban', { method: 'POST', body: JSON.stringify({ reason, userId }) }),
}

// =====================================================
// STEAM
// =====================================================

export const steamAPI = {
  authenticate: async (callbackParams: Record<string, string>) => {
    const data = await apiFetch('/steam/auth', {
      method: 'POST',
      body: JSON.stringify(callbackParams),
    })
    if (data.session?.access_token) setSessionToken(data.session.access_token)
    return data
  },

  // Checks if a Steam ID owns a game (appId 70 = Half-Life 1)
  verifyGameOwnership: async (steamId: string, appId: number = 70) =>
    apiFetch('/steam/verify-game', { method: 'POST', body: JSON.stringify({ steamId, appId }) }),

  // Gets a Steam user's public profile info
  getProfile: async (steamId: string) =>
    apiFetch(`/steam/profile/${steamId}`),

  // Links Steam ID to account — server fetches avatar + HL1 ownership automatically
  linkAccount: async (steamId: string) =>
    apiFetch('/steam/link', { method: 'POST', body: JSON.stringify({ steamId }) }),

  // Gets owned games list for a Steam ID — used by SteamIntegration component
  getGames: async (steamId: string) =>
    apiFetch(`/steam/profile/${steamId}`),
}
