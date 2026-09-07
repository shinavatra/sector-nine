// =====================================================
// API CLIENT — points at local Express server
// No Supabase. Pure PostgreSQL backend.
// =====================================================

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3001' : '')

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
  if (!API_URL) throw new ApiError('VITE_API_URL is not configured', 500, 'API_URL_NOT_CONFIGURED')

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

export interface PublicPlatformSettings {
  maintenanceMode: boolean
  registrationEnabled: boolean
  announcement: { enabled: boolean; title: string; message: string }
}

export const platformAPI = {
  getSettings: async (): Promise<PublicPlatformSettings> => {
    const data = await apiFetch('/platform/settings')
    if (typeof data?.maintenanceMode !== 'boolean' || typeof data?.registrationEnabled !== 'boolean' || typeof data?.announcement?.enabled !== 'boolean' || typeof data?.announcement?.title !== 'string' || typeof data?.announcement?.message !== 'string') {
      throw new ApiError('Platform settings response is invalid', 502, 'INVALID_PLATFORM_SETTINGS')
    }
    return data
  },
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

  changePassword: async (currentPassword: string, newPassword: string) =>
    apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  signout: () => setSessionToken(null),
}

// =====================================================
// USER PROFILE
// =====================================================

export const userAPI = {
  getProfile: async () =>
    apiFetch('/user/profile'),

  getPublicProfile: async (userId: string) =>
    apiFetch(`/users/${userId}/profile`),

  updateProfile: async (updates: Record<string, any>) =>
    apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(updates) }),

  changeDisplayName: async (displayName: string) =>
    apiFetch('/user/display-name', { method: 'POST', body: JSON.stringify({ displayName }) }),

  upgradeToVIP: async (productId: string) =>
    apiFetch('/user/vip/purchase', { method: 'POST', body: JSON.stringify({ productId, method: 'points' }) }),

  cancelVIP: async () =>
    apiFetch('/user/vip/cancel', { method: 'POST' }),

  purchaseFrame: async (frameId: string) =>
    apiFetch('/user/frame/purchase', { method: 'POST', body: JSON.stringify({ frameId }) }),

  equipBadge: async (badgeId: string) =>
    apiFetch('/user/badge/equip', { method: 'POST', body: JSON.stringify({ badgeId }) }),

  equipFrame: async (frameId: string) =>
    apiFetch('/user/frame/equip', { method: 'POST', body: JSON.stringify({ frameId }) }),

  // Links Steam ID — server also fetches avatar + HL1 ownership automatically
}

// =====================================================
// MATCHMAKING
// =====================================================

export const matchmakingAPI = {
  joinQueue: async (gameId: string, gameMode: string, selectedMaps: string[], preferredRegion = '') =>
    apiFetch('/matchmaking/join', { method: 'POST', body: JSON.stringify({ gameId, gameMode, selectedMaps, preferredRegion }) }),

  leaveQueue: async () =>
    apiFetch('/matchmaking/leave', { method: 'POST' }),

  getStatus: async () =>
    apiFetch('/matchmaking/status'),

  getOptions: async (gameId: string) =>
    apiFetch(`/matchmaking/options?game_id=${encodeURIComponent(gameId)}`),

  sync: async () =>
    apiFetch('/matchmaking/sync', { method: 'POST' }),

  accept: async () =>
    apiFetch('/matchmaking/accept', { method: 'POST' }),

  submitMaps: async (selectedMaps: string[]) =>
    apiFetch('/matchmaking/maps', { method: 'POST', body: JSON.stringify({ selectedMaps }) }),

  banMap: async (mapId: string) =>
    apiFetch('/matchmaking/ban-map', { method: 'POST', body: JSON.stringify({ mapId }) }),

  decline: async () =>
    apiFetch('/matchmaking/decline', { method: 'POST' }),

  getMatch: async (matchId: string) =>
    apiFetch(`/match/${matchId}`),

  getTimeline: async (matchId:string) =>
    apiFetch(`/match/${matchId}/timeline`),

  submitResult: async (matchId: string, winnerId: string, stats: Record<string, any>) =>
    apiFetch(`/match/${matchId}/result`, { method: 'POST', body: JSON.stringify({ winnerId, stats }) }),
}

export const gameServerAPI={
  getStatus:async(gameId:string)=>apiFetch(`/game-servers/status?game_id=${encodeURIComponent(gameId)}`),
}

export const gameAPI={
  getEnabled:async()=>apiFetch('/games'),
}

export const supportAPI={
  getTickets:async()=>apiFetch('/support/tickets'),
  createTicket:async(ticket:{category:string;priority:string;subject:string;description:string})=>
    apiFetch('/support/tickets',{method:'POST',body:JSON.stringify(ticket)}),
}

// =====================================================
// FRIENDS
// =====================================================

export const friendsAPI = {
  getFriends: async () =>
    apiFetch('/friends'),

  getOnline: async () =>
    apiFetch('/friends/online'),

  searchUsers: async (searchTerm: string) =>
    apiFetch(`/friends/search?q=${encodeURIComponent(searchTerm)}`),

  sendFriendRequest: async (targetUserId: string) =>
    apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ targetUserId }) }),

  acceptRequest: async (requestId: string) =>
    apiFetch('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),

  declineRequest: async (requestId: string) =>
    apiFetch(`/friends/requests/${requestId}/decline`, { method: 'POST' }),

  cancelRequest: async (requestId: string) =>
    apiFetch(`/friends/requests/${requestId}`, { method: 'DELETE' }),

  removeFriend: async (friendshipId: string) =>
    apiFetch(`/friends/${friendshipId}`, { method: 'DELETE' }),
}

export const presenceAPI = {
  heartbeat: async () =>
    apiFetch('/presence/heartbeat', { method: 'POST' }),

  offline: async () =>
    apiFetch('/presence/offline', { method: 'POST' }),
}

// =====================================================
// CHAT
// =====================================================

export const chatAPI = {
  getUnread: async () =>
    apiFetch('/chat/unread'),

  getMessages: async (roomId: string) =>
    apiFetch(`/chat/${roomId}`),

  sendMessage: async (roomId: string, message: string) =>
    apiFetch(`/chat/${roomId}`, { method: 'POST', body: JSON.stringify({ message }) }),

  deleteMessage: async (roomId: string, messageId: string) =>
    apiFetch(`/chat/${roomId}/${messageId}`, { method: 'DELETE' }),

  markConversationRead: async (recipientId: string) =>
    apiFetch(`/chat/${recipientId}/read`, { method: 'PUT' }),
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export const notificationsAPI = {
  getNotifications: async () =>
    apiFetch('/notifications'),

  markAsRead: async (notificationId: string) =>
    apiFetch(`/notifications/${notificationId}/read`, { method: 'PUT' }),

  dismiss: async (notificationId: string) =>
    apiFetch(`/notifications/${notificationId}`, { method: 'DELETE' }),

  markAllAsRead: async () =>
    apiFetch('/notifications/read-all', { method: 'PUT' }),

  clearAll: async () =>
    apiFetch('/notifications', { method: 'DELETE' }),
}

// =====================================================
// TOURNAMENTS
// =====================================================

export const tournamentAPI = {
  getAll: async (gameId = 'hl1') =>
    apiFetch(`/tournaments?game_id=${encodeURIComponent(gameId)}`),

  getById: async (id: string) =>
    apiFetch(`/tournaments/${id}`),

  register: async (tournamentId: string) =>
    apiFetch(`/tournament/${tournamentId}/register`, { method: 'POST' }),

  unregister: async (tournamentId: string) =>
    apiFetch(`/tournament/${tournamentId}/register`, { method: 'DELETE' }),

  getParticipants: async (tournamentId: string) =>
    apiFetch(`/tournament/${tournamentId}/participants`),
}

// =====================================================
// STATS & LEADERBOARD
// =====================================================

export const statsAPI = {
  getLeaderboard: async (filters: { scope?: string; game?: string; country?: string; season?: string; search?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value))
    })
    return apiFetch(`/leaderboard?${query.toString()}`)
  },

  getMatchHistory: async (gameId = 'hl1') =>
    apiFetch(`/matches/history?game_id=${encodeURIComponent(gameId)}`),

  getActiveMatches: async (gameId = 'hl1') =>
    apiFetch(`/matches/active?game_id=${encodeURIComponent(gameId)}`),

  getUserStats: async (gameId = 'hl1') =>
    apiFetch(`/user/stats?game_id=${encodeURIComponent(gameId)}`),

  getRatingHistory: async (gameId = 'hl1') =>
    apiFetch(`/user/rating-history?game_id=${encodeURIComponent(gameId)}`),

  // Used by Hub page for platform-wide numbers
  getPlatformStats: async () =>
    apiFetch('/stats/platform'),

  // Used by ladder pages — season is: 'monthly' | 'winter' | 'spring' | 'summer' | 'autumn'
  getLadder: async (season: string, gameId = 'hl1') =>
    apiFetch(`/ladder/${season}?game_id=${encodeURIComponent(gameId)}`),

  getAllSeasons: async (gameId = 'hl1') =>
    apiFetch(`/ladder/seasons?game_id=${encodeURIComponent(gameId)}`),
}

// =====================================================
// STORE
// =====================================================

export const storeAPI = {
  getCatalog: async () =>
    apiFetch('/store/catalog'),

  getPurchaseHistory: async () =>
    apiFetch('/store/purchases'),
}

export const achievementAPI = {
  getBadges: async () =>
    apiFetch('/badges'),
}

export const newsAPI = {
  list: async ({page=1,limit=5,q='',category=''}:{page?:number;limit?:number;q?:string;category?:string}={}) => {
    const params=new URLSearchParams({page:String(page),limit:String(limit),q,category})
    return apiFetch(`/news?${params.toString()}`)
  },
  get: async (id:string) =>
    apiFetch(`/news/${encodeURIComponent(id)}`),
  getComments: async (id:string) =>
    apiFetch(`/news/${encodeURIComponent(id)}/comments`),
  addComment: async (id:string,content:string,parentId?:string) =>
    apiFetch(`/news/${encodeURIComponent(id)}/comments`,{method:'POST',body:JSON.stringify({content,parentId})}),
  deleteComment: async (commentId:string) =>
    apiFetch(`/news/comments/${encodeURIComponent(commentId)}`,{method:'DELETE'}),
}

export const communityAPI={
  getEvents:async(gameId='')=>apiFetch(`/community/events?game_id=${encodeURIComponent(gameId)}`),
  getActivity:async()=>apiFetch('/community/activity'),
  getProfileComments:async(userId:string)=>apiFetch(`/users/${encodeURIComponent(userId)}/comments`),
  addProfileComment:async(userId:string,content:string)=>apiFetch(`/users/${encodeURIComponent(userId)}/comments`,{method:'POST',body:JSON.stringify({content})}),
  deleteProfileComment:async(commentId:string)=>apiFetch(`/profile-comments/${encodeURIComponent(commentId)}`,{method:'DELETE'}),
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

  getBlockedPlayers: async () =>
    apiFetch('/blocks'),

  blockPlayer: async (blockedUserId: string) =>
    apiFetch('/blocks', { method: 'POST', body: JSON.stringify({ blockedUserId }) }),

  unblockPlayer: async (blockedUserId: string) =>
    apiFetch(`/blocks/${encodeURIComponent(blockedUserId)}`, { method: 'DELETE' }),
}

// =====================================================
// STEAM
// =====================================================

export const steamAPI = {
  startAuthentication: async () =>
    apiFetch('/steam/auth/start'),

  authenticate: async (callbackParams: Record<string, string>, state: string) => {
    const data = await apiFetch('/steam/auth', {
      method: 'POST',
      body: JSON.stringify({callbackParams,state}),
    })
    if (data.session?.access_token) setSessionToken(data.session.access_token)
    return data
  },

  // Checks if a Steam ID owns a game (appId 70 = Half-Life 1)
  verifyGameOwnership: async (_steamId?: string, _appId: number = 70) =>
    apiFetch('/steam/verify-game', { method: 'POST' }),

  getStatus: async () =>
    apiFetch('/steam/status'),

  refresh: async () =>
    apiFetch('/steam/refresh', { method: 'POST' }),

  // Gets a Steam user's public profile info
  getProfile: async (steamId: string) =>
    apiFetch(`/steam/profile/${steamId}`),

  // Links Steam ID to account — server fetches avatar + HL1 ownership automatically
  // Gets owned games list for a Steam ID — used by SteamIntegration component
}
