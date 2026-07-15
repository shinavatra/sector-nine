import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

// =====================================================
// SETUP
// =====================================================

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const JWT_SECRET = process.env.JWT_SECRET || 'sector-nine-dev-secret-change-in-production'
const JWT_EXPIRES = '7d'

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))
app.use(express.json({ limit: '2mb' }))

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

interface AuthRequest extends Request {
  userId?: string
  userEmail?: string
}

const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string }
    req.userId = payload.sub
    req.userEmail = payload.email
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// =====================================================
// PROFILE MAPPER
// Maps a DB user row to the shape the frontend expects
// =====================================================

const toProfile = (u: any) => {
  const wins = u.wins || 0
  const losses = u.losses || 0
  const kills = u.total_kills || 0
  const deaths = u.total_deaths || 0
  const matchesPlayed = wins + losses

  const customAvatarUrl = u.custom_avatar_url || null
  const avatarSource = u.avatar_source === 'custom' ? 'custom' : 'steam'
  const resolvedAvatar = avatarSource === 'custom' && customAvatarUrl ? customAvatarUrl : (u.steam_avatar || null)

  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio || '',
    isPremium: u.is_premium,
    vipSince: u.vip_since,
    vipMethod: u.vip_method,
    points: u.points,
    experience: u.experience,
    level: u.level,
    equippedBadge: u.equipped_badge,
    equippedFrame: u.equipped_frame,
    ownedBadges: u.owned_badges || [],
    ownedFrames: u.owned_frames || [],
    steamId: u.steam_id,
    steamAvatar: u.steam_avatar,
    customAvatarUrl,
    avatarSource,
    resolvedAvatar,
    steamProfileUrl: u.steam_profile_url,
    socialLinks: u.social_links || {},
    notificationPreferences: u.notification_preferences || {
      matchFound: true,
      friendRequests: true,
      tournaments: true,
      messages: true,
      social: true,
    },
    steamVerified: u.steam_verified || false,
    ownsHL1: u.owns_hl1 || false,
    vacBanned: u.vac_banned || false,
    gameBanned: u.game_banned || false,
    lastSteamCheck: u.last_steam_check,
    wins,
    losses,
    winStreak: u.win_streak,
    bestWinStreak: u.best_win_streak,
    totalKills: kills,
    totalDeaths: deaths,
    profileVisibility: u.profile_visibility || 'public',
    showOnlineStatus: u.show_online_status !== false,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    stats: {
      matchesPlayed,
      wins,
      losses,
      kills,
      deaths,
      rating: u.experience || 0,
      // Computed so Stats page always shows real numbers
      winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
      kda: deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? 'Perfect' : '0.00',
    },
  }
}

// =====================================================
// HEALTH
// =====================================================

app.get('/health', (_req, res) => res.json({ ok: true, db: 'postgresql' }))

app.get('/pg', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now')
    res.json({ now: result.rows[0].now })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// =====================================================
// AUTH
// =====================================================

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, password and username are required' })
    }
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email.toLowerCase(), username]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already taken' })
    }
    const password_hash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1,$2,$3) RETURNING *`,
      [email.toLowerCase(), username, password_hash]
    )
    const user = result.rows[0]
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.status(201).json({ user: toProfile(user), session: { access_token: token } })
  } catch (err: any) {
    console.error('signup error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /auth/signin
app.post('/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id])
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.json({ user: toProfile(user), session: { access_token: token }, profile: toProfile(user) })
  } catch (err: any) {
    console.error('signin error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// POST /auth/reset-password
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600 * 1000)
    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [token, expires, email.toLowerCase()]
    )
    // TODO: send email with reset link in production
    console.log(`[DEV] Password reset token for ${email}: ${token}`)
    return res.json({ message: 'If that email exists, a reset link was sent.' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /auth/update-password
app.post('/auth/update-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body
    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()',
      [resetToken]
    )
    if (!result.rows[0]) return res.status(400).json({ error: 'Invalid or expired reset token' })
    const hash = await bcrypt.hash(newPassword, 12)
    await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE id=$2',
      [hash, result.rows[0].id]
    )
    return res.json({ message: 'Password updated successfully' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current and new passwords are required' })
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 8 and 128 characters' })
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current password' })
    }
    const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.userId])
    if (!result.rows[0] || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [passwordHash, req.userId])
    return res.json({ message: 'Password changed successfully' })
  } catch (err: any) {
    console.error('change password error:', err.message)
    return res.status(500).json({ error: 'Failed to change password' })
  }
})

// =====================================================
// USER / PROFILE
// =====================================================

// GET /user/profile
app.get('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' })
    await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [req.userId])
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /user/display-name
// The fixed 1500-point price is enforced atomically by PostgreSQL.
app.post('/user/display-name', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (typeof req.body.displayName !== 'string') {
      return res.status(400).json({ error: 'Display name is required' })
    }
    const displayName = req.body.displayName.trim() || null
    if (displayName && displayName.length > 80) {
      return res.status(400).json({ error: 'Display name must be 80 characters or fewer' })
    }

    const result = await pool.query(
      `UPDATE users
       SET display_name=$1,
           points=CASE WHEN display_name IS DISTINCT FROM $1 THEN points-1500 ELSE points END,
           updated_at=NOW()
       WHERE id=$2
         AND (display_name IS NOT DISTINCT FROM $1 OR points >= 1500)
       RETURNING *`,
      [displayName, req.userId]
    )
    if (result.rows[0]) return res.json({ profile: toProfile(result.rows[0]) })

    const exists = await pool.query('SELECT id FROM users WHERE id=$1', [req.userId])
    if (!exists.rows[0]) return res.status(404).json({ error: 'User not found' })
    return res.status(400).json({ error: 'At least 1500 points are required to change display name', code: 'INSUFFICIENT_POINTS' })
  } catch (err: any) {
    console.error('display name change error:', err.message)
    return res.status(500).json({ error: 'Failed to change display name' })
  }
})

// PUT /user/profile
// Steam fields are intentionally excluded: only the backend Steam verification flow may change them.
app.put('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const normalizeUrl = (value: unknown, key: string): string | null => {
      if (value === null || value === '') return null
      if (typeof value !== 'string' || value.length > 2048) throw new Error(`Invalid ${key} URL`)
      const trimmed = value.trim()
      const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      let parsed: URL
      try { parsed = new URL(withProtocol) } catch { throw new Error(`Invalid ${key} URL`) }
      if (parsed.protocol !== 'https:') throw new Error(`${key} URL must use HTTPS`)
      return parsed.toString()
    }

    if (req.body.bio !== undefined && (typeof req.body.bio !== 'string' || req.body.bio.length > 500)) {
      return res.status(400).json({ error: 'Bio must be 500 characters or fewer' })
    }
    if (req.body.profileVisibility !== undefined && !['public', 'friends', 'private'].includes(req.body.profileVisibility)) {
      return res.status(400).json({ error: 'Invalid profile visibility' })
    }
    if (req.body.showOnlineStatus !== undefined && typeof req.body.showOnlineStatus !== 'boolean') {
      return res.status(400).json({ error: 'Invalid online-status preference' })
    }
    if (req.body.avatarSource !== undefined && !['steam', 'custom'].includes(req.body.avatarSource)) {
      return res.status(400).json({ error: 'Invalid avatar source' })
    }
    if (req.body.customAvatarUrl !== undefined) {
      const avatar = req.body.customAvatarUrl
      const validDataImage = typeof avatar === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar)
      if (avatar !== null && avatar !== '' && !validDataImage) {
        try { req.body.customAvatarUrl = normalizeUrl(avatar, 'custom avatar') }
        catch (error: any) { return res.status(400).json({ error: error.message }) }
      }
      if (typeof req.body.customAvatarUrl === 'string' && req.body.customAvatarUrl.length > 1_500_000) {
        return res.status(400).json({ error: 'Custom avatar is too large' })
      }
    }
    if (req.body.socialLinks !== undefined) {
      if (!req.body.socialLinks || typeof req.body.socialLinks !== 'object' || Array.isArray(req.body.socialLinks)) {
        return res.status(400).json({ error: 'Invalid social links' })
      }
      try {
        const keys = ['discord', 'youtube', 'twitch', 'twitter', 'instagram', 'website']
        req.body.socialLinks = Object.fromEntries(keys.map((key) => [key, normalizeUrl(req.body.socialLinks[key], key)]))
      } catch (error: any) {
        return res.status(400).json({ error: error.message })
      }
    }
    if (req.body.notificationPreferences !== undefined) {
      const preferences = req.body.notificationPreferences
      const keys = ['matchFound', 'friendRequests', 'tournaments', 'messages', 'social']
      if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences) ||
          Object.keys(preferences).some((key) => !keys.includes(key)) ||
          keys.some((key) => typeof preferences[key] !== 'boolean')) {
        return res.status(400).json({ error: 'Invalid notification preferences' })
      }
    }

    // Allowed DB columns → frontend field names (camelCase or snake_case both accepted)
    const fieldMap: Record<string, string> = {
      bio:                'bio',
      profile_visibility: 'profileVisibility',
      show_online_status: 'showOnlineStatus',
      custom_avatar_url:  'customAvatarUrl',
      avatar_source:      'avatarSource',
      social_links:       'socialLinks',
      notification_preferences: 'notificationPreferences',
    }
    const updates: string[] = []
    const values: any[] = []
    let i = 1
    for (const [col, camel] of Object.entries(fieldMap)) {
      const val = req.body[col] !== undefined ? req.body[col] : req.body[camel]
      if (val !== undefined) {
        updates.push(`${col}=$${i++}`)
        values.push(val)
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' })
    values.push(req.userId)
    const result = await pool.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      values
    )
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /user/stats
app.get('/user/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT username,level,experience,wins,losses,win_streak,best_win_streak,total_kills,total_deaths FROM users WHERE id=$1',
      [req.userId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    const lb = await pool.query('SELECT rank FROM leaderboard WHERE id=$1', [req.userId])
    return res.json({ stats: { ...result.rows[0], rank: lb.rows[0]?.rank || null } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /stats/platform — Hub page platform-wide numbers
app.get('/stats/platform', async (_req, res) => {
  try {
    const [users, matches, active, tournaments] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM matches WHERE status='completed'"),
      pool.query("SELECT COUNT(*) FROM matches WHERE status='in_progress'"),
      pool.query("SELECT COUNT(*) FROM tournaments WHERE status != 'completed'"),
    ])
    return res.json({
      totalPlayers:      parseInt(users.rows[0].count),
      totalMatches:      parseInt(matches.rows[0].count),
      activeMatches:     parseInt(active.rows[0].count),
      activeTournaments: parseInt(tournaments.rows[0].count),
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// VIP
// =====================================================

app.post('/user/vip/purchase', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { method } = req.body
    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.is_premium) return res.status(400).json({ error: 'Already have VIP status' })

    let newPoints = user.points
    if (method === 'points') {
      if (user.points < 5000) return res.status(400).json({ error: 'Insufficient points (need 5000)' })
      newPoints = user.points - 5000
    }
    const result = await pool.query(
      `UPDATE users SET is_premium=true, vip_since=NOW(), vip_method=$1, points=$2 WHERE id=$3 RETURNING *`,
      [method, newPoints, req.userId]
    )
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/user/vip/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_premium=false, vip_since=NULL, vip_method=NULL WHERE id=$1 RETURNING *`,
      [req.userId]
    )
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// BADGES & FRAMES
// =====================================================

app.get('/badges', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM badges ORDER BY price_points ASC')
    return res.json({ badges: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/frames', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM frames ORDER BY price_points ASC')
    return res.json({ frames: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/user/badge/purchase', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { badgeId, pointsCost } = req.body
    if (!badgeId || pointsCost === undefined) return res.status(400).json({ error: 'Missing badgeId or pointsCost' })
    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.points < pointsCost) return res.status(400).json({ error: `Insufficient points. Have ${user.points}, need ${pointsCost}` })
    if (user.owned_badges?.includes(badgeId)) return res.status(400).json({ error: 'Badge already owned' })
    const newBadges = [...(user.owned_badges || []), badgeId]
    const result = await pool.query(
      `UPDATE users SET points=points-$1, owned_badges=$2 WHERE id=$3 RETURNING *`,
      [pointsCost, newBadges, req.userId]
    )
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/user/frame/purchase', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { frameId, pointsCost } = req.body
    if (!frameId || pointsCost === undefined) return res.status(400).json({ error: 'Missing frameId or pointsCost' })
    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.points < pointsCost) return res.status(400).json({ error: `Insufficient points. Have ${user.points}, need ${pointsCost}` })
    if (user.owned_frames?.includes(frameId)) return res.status(400).json({ error: 'Frame already owned' })
    const newFrames = [...(user.owned_frames || []), frameId]
    const result = await pool.query(
      `UPDATE users SET points=points-$1, owned_frames=$2 WHERE id=$3 RETURNING *`,
      [pointsCost, newFrames, req.userId]
    )
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/user/badge/equip', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { badgeId } = req.body
    const userResult = await pool.query('SELECT owned_badges FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user?.owned_badges?.includes(badgeId)) return res.status(400).json({ error: 'Badge not owned' })
    const result = await pool.query(`UPDATE users SET equipped_badge=$1 WHERE id=$2 RETURNING *`, [badgeId, req.userId])
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/user/frame/equip', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { frameId } = req.body
    const userResult = await pool.query('SELECT owned_frames FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user?.owned_frames?.includes(frameId)) return res.status(400).json({ error: 'Frame not owned' })
    const result = await pool.query(`UPDATE users SET equipped_frame=$1 WHERE id=$2 RETURNING *`, [frameId, req.userId])
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// LEADERBOARD & MATCHES
// =====================================================

app.get('/leaderboard', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leaderboard LIMIT 100')
    return res.json({ leaderboard: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/matches/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
        p1.username AS player1_username, COALESCE(CASE WHEN p1.avatar_source='custom' THEN NULLIF(p1.custom_avatar_url,'') END,p1.steam_avatar) AS player1_avatar, p1.level AS player1_level,
        p2.username AS player2_username, COALESCE(CASE WHEN p2.avatar_source='custom' THEN NULLIF(p2.custom_avatar_url,'') END,p2.steam_avatar) AS player2_avatar, p2.level AS player2_level
       FROM matches m
       JOIN users p1 ON m.player1_id = p1.id
       JOIN users p2 ON m.player2_id = p2.id
       WHERE (m.player1_id=$1 OR m.player2_id=$1) AND m.status='completed'
       ORDER BY m.completed_at DESC LIMIT 20`,
      [req.userId]
    )
    return res.json({ matches: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /matches/active — public, used by ActiveMatches component on Hub
app.get('/matches/active', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM active_matches LIMIT 20')
    return res.json({ matches: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// MATCHMAKING
// =====================================================

// In-memory queue — also persisted to queue_entries table so it survives server restarts
const matchQueue: Map<string, { userId: string; gameMode: string; selectedMaps: string[]; joinedAt: Date }> = new Map()

app.post('/matchmaking/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { gameMode, selectedMaps } = req.body
    const userId = req.userId!


// Check Steam eligibility before allowing matchmaking
const userCheck = await pool.query(
  `SELECT steam_id, steam_verified, owns_hl1, vac_banned, game_banned
   FROM users
   WHERE id=$1`,
  [userId]
)

const user = userCheck.rows[0]

if (!user) {
  return res.status(404).json({
    error: 'User not found'
  })
}

if (!user.steam_id) {
  return res.status(403).json({
    error: 'Connect your Steam account before joining matchmaking',
    code: 'STEAM_NOT_LINKED'
  })
}

if (!user.owns_hl1) {
  return res.status(403).json({
    error: 'Half-Life 1 is required to join matchmaking',
    code: 'HL1_NOT_OWNED'
  })
}

if (user.vac_banned || user.game_banned) {
  return res.status(403).json({
    error: 'This Steam account is not eligible for matchmaking',
    code: 'STEAM_BANNED'
  })
}

if (!user.steam_verified) {
  return res.status(403).json({
    error: 'Steam verification is required before joining matchmaking',
    code: 'STEAM_NOT_VERIFIED'
  })
}

    // Check if banned
    const banCheck = await pool.query(
      `SELECT * FROM bans WHERE user_id=$1 AND is_active=true AND expires_at > NOW() LIMIT 1`,
      [userId]
    )
    if (banCheck.rows.length > 0) {
      const ban = banCheck.rows[0]
      return res.status(403).json({
        error: 'You are banned from matchmaking',
        ban: { reason: ban.reason, expiresAt: ban.expires_at, banLevel: ban.ban_level }
      })
    }

    // Add to in-memory queue + persist
    matchQueue.set(userId, { userId, gameMode, selectedMaps, joinedAt: new Date() })
    await pool.query(
      `INSERT INTO queue_entries (user_id, game_mode, selected_maps)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET game_mode=$2, selected_maps=$3, joined_at=NOW()`,
      [userId, gameMode, selectedMaps]
    )

    // Look for opponent with same game mode
    const opponents = [...matchQueue.entries()].filter(
      ([id, entry]) => id !== userId && entry.gameMode === gameMode
    )

    if (opponents.length > 0) {
      const [opponentId, opponentEntry] = opponents[0]
      const commonMaps = selectedMaps.filter((m: string) => opponentEntry.selectedMaps.includes(m))
      const mapPool = commonMaps.length > 0 ? commonMaps : selectedMaps
      const selectedMap = mapPool[Math.floor(Math.random() * mapPool.length)]

      const matchResult = await pool.query(
        `INSERT INTO matches (match_type, game_mode, player1_id, player2_id, selected_map, maps, status, started_at)
         VALUES ($1,$2,$3,$4,$5,$6,'in_progress',NOW()) RETURNING *`,
        [gameMode, gameMode, userId, opponentId, selectedMap, selectedMaps]
      )
      const match = matchResult.rows[0]

      matchQueue.delete(userId)
      matchQueue.delete(opponentId)
      await pool.query('DELETE FROM queue_entries WHERE user_id=$1 OR user_id=$2', [userId, opponentId])

      // Notify both players
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_match_id)
         VALUES ($1,'match_found','Match Found!','Your match is ready. Good luck!', $2),
                ($3,'match_found','Match Found!','Your match is ready. Good luck!', $2)`,
        [userId, match.id, opponentId]
      )

      // FIX: return status:'matched' so Lobby.tsx correctly detects a match
      return res.json({ status: 'matched', match })
    }

    return res.json({ status: 'queued', position: matchQueue.size })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/matchmaking/leave', requireAuth, async (req: AuthRequest, res) => {
  try {
    matchQueue.delete(req.userId!)
    await pool.query('DELETE FROM queue_entries WHERE user_id=$1', [req.userId])
    return res.json({ status: 'left' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/match/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id=$1', [req.params.id])
    if (!result.rows[0]) return res.status(404).json({ error: 'Match not found' })
    return res.json({ match: result.rows[0] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/match/:id/result', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { winnerId, stats } = req.body
    const matchId = req.params.id

    const matchResult = await pool.query('SELECT * FROM matches WHERE id=$1', [matchId])
    const match = matchResult.rows[0]
    if (!match) return res.status(404).json({ error: 'Match not found' })

    const XP_WIN = 50
    const XP_LOSS = 10
    const p1Won = winnerId === match.player1_id

    await pool.query(
      `UPDATE matches SET status='completed', winner_id=$1, completed_at=NOW(),
       score_p1=$2, score_p2=$3, p1_xp_change=$4, p2_xp_change=$5 WHERE id=$6`,
      [winnerId, stats?.score_p1 || 0, stats?.score_p2 || 0,
       p1Won ? XP_WIN : XP_LOSS,
       p1Won ? XP_LOSS : XP_WIN,
       matchId]
    )

    // Update both players' stats in parallel
    const updatePlayer = (isWinner: boolean, kills: number, deaths: number, playerId: string) =>
      pool.query(
        `UPDATE users SET
          wins = wins + $1,
          losses = losses + $2,
          win_streak = CASE WHEN $1=1 THEN win_streak+1 ELSE 0 END,
          best_win_streak = GREATEST(best_win_streak, CASE WHEN $1=1 THEN win_streak+1 ELSE win_streak END),
          experience = experience + $3,
          total_kills = total_kills + $4,
          total_deaths = total_deaths + $5
         WHERE id=$6`,
        [isWinner ? 1 : 0, isWinner ? 0 : 1, isWinner ? XP_WIN : XP_LOSS, kills, deaths, playerId]
      )

    await Promise.all([
      updatePlayer(p1Won, stats?.p1_kills || 0, stats?.p1_deaths || 0, match.player1_id),
      updatePlayer(!p1Won, stats?.p2_kills || 0, stats?.p2_deaths || 0, match.player2_id),
    ])

    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// TOURNAMENTS
// =====================================================

app.get('/tournaments', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments ORDER BY start_date ASC')
    return res.json({ tournaments: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/tournaments/:id', async (req, res) => {
  try {
    const t = await pool.query('SELECT * FROM tournaments WHERE id=$1', [req.params.id])
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' })
    const p = await pool.query(
      `SELECT tp.*, u.username, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium
       FROM tournament_participants tp JOIN users u ON tp.user_id=u.id
       WHERE tp.tournament_id=$1 ORDER BY tp.placement NULLS LAST, tp.wins DESC`,
      [req.params.id]
    )
    return res.json({ tournament: { ...t.rows[0], participants: p.rows } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/tournament/:id/participants', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tp.*, u.username, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium
       FROM tournament_participants tp JOIN users u ON tp.user_id=u.id
       WHERE tp.tournament_id=$1 ORDER BY tp.wins DESC`,
      [req.params.id]
    )
    return res.json({ participants: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/tournament/:id/register', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tid = req.params.id
    const [tResult, uResult] = await Promise.all([
      pool.query('SELECT * FROM tournaments WHERE id=$1', [tid]),
      pool.query('SELECT * FROM users WHERE id=$1', [req.userId]),
    ])
    const t = tResult.rows[0]
    const u = uResult.rows[0]
    if (!t) return res.status(404).json({ error: 'Tournament not found' })
    if (!u) return res.status(404).json({ error: 'User not found' })
    if (t.requires_vip && !u.is_premium) return res.status(403).json({ error: 'VIP status required' })
    if (t.current_participants >= t.max_participants) return res.status(400).json({ error: 'Tournament is full' })
    const existing = await pool.query(
      'SELECT id FROM tournament_participants WHERE tournament_id=$1 AND user_id=$2',
      [tid, req.userId]
    )
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already registered' })
    const pResult = await pool.query(
      'INSERT INTO tournament_participants (tournament_id, user_id) VALUES ($1,$2) RETURNING *',
      [tid, req.userId]
    )
    await pool.query(
      'UPDATE tournaments SET current_participants=current_participants+1 WHERE id=$1', [tid]
    )
    return res.json({ participant: pResult.rows[0] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// LADDERS
// =====================================================

// GET /ladder/:season — ladder pages (Monthly, Winter, Spring, Summer, Autumn)
app.get('/ladder/:season', async (req, res) => {
  try {
    const season = req.params.season
    // Try exact match first, then partial (e.g. 'monthly' matches 'monthly-2025-01')
    const seasonResult = await pool.query(
      `SELECT * FROM ladder_seasons
       WHERE id=$1 OR (season_type=$1 AND status='active')
       ORDER BY start_date DESC LIMIT 1`,
      [season]
    )
    if (!seasonResult.rows[0]) {
      return res.json({ season: null, entries: [] })
    }
    const s = seasonResult.rows[0]
    const entries = await pool.query(
      `SELECT le.*, u.username, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium,
              ROW_NUMBER() OVER (ORDER BY le.points DESC) as rank
       FROM ladder_entries le
       JOIN users u ON le.user_id = u.id
       WHERE le.season_id=$1
       ORDER BY le.points DESC LIMIT 100`,
      [s.id]
    )
    return res.json({ season: s, entries: entries.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// GET /ladder/seasons — all seasons list
app.get('/ladder/seasons', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ladder_seasons ORDER BY start_date DESC')
    return res.json({ seasons: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// CHAT
// =====================================================

app.get('/chat/:room', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE room=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.room]
    )
    return res.json({ messages: result.rows.reverse() })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/chat/:room', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' })
    const uResult = await pool.query('SELECT username, is_premium FROM users WHERE id=$1', [req.userId])
    const u = uResult.rows[0]
    const result = await pool.query(
      `INSERT INTO chat_messages (user_id, username, message, room, is_premium)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId, u?.username || 'Unknown', message.trim(), req.params.room, u?.is_premium || false]
    )
    return res.json({ message: result.rows[0] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.delete('/chat/:room/:messageId', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query(
      'DELETE FROM chat_messages WHERE id=$1 AND user_id=$2',
      [req.params.messageId, req.userId]
    )
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// FRIENDS
// =====================================================

app.get('/friends', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.username, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium, u.last_seen
       FROM friendships f
       JOIN users u ON (CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END) = u.id
       WHERE f.user_id=$1 OR f.friend_id=$1`,
      [req.userId]
    )
    return res.json({ friends: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/friends/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = req.query.q as string
    if (!q || q.length < 2) return res.json({ users: [] })
    const result = await pool.query(
      `SELECT id, username, COALESCE(CASE WHEN avatar_source='custom' THEN NULLIF(custom_avatar_url,'') END,steam_avatar) AS steam_avatar, level, is_premium
       FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 20`,
      [`%${q}%`, req.userId]
    )
    return res.json({ users: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/friends/request', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetUserId } = req.body
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2)
       ON CONFLICT (user_id, friend_id) DO NOTHING`,
      [req.userId, targetUserId]
    )
    const uResult = await pool.query('SELECT username FROM users WHERE id=$1', [req.userId])
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_user_id)
       VALUES ($1,'friend_request','Friend Request',$2,$3)`,
      [targetUserId, `${uResult.rows[0]?.username} sent you a friend request`, req.userId]
    )
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.post('/friends/accept', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { requestId } = req.body
    await pool.query(
      `UPDATE friendships SET status='accepted' WHERE id=$1 AND friend_id=$2`,
      [requestId, req.userId]
    )
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// NOTIFICATIONS
// =====================================================

app.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    )
    return res.json({ notifications: result.rows })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.put('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId]
    )
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.put('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE notifications SET read=true WHERE user_id=$1', [req.userId])
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// REPORTS & BANS
// =====================================================

app.post('/report', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reportedUserId, reason, description } = req.body
    await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, description) VALUES ($1,$2,$3,$4)`,
      [req.userId, reportedUserId, reason, description]
    )
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/ban/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    // Also auto-expire old bans
    await pool.query(
      `UPDATE bans SET is_active=false WHERE user_id=$1 AND expires_at <= NOW() AND is_active=true`,
      [req.userId]
    )
    const result = await pool.query(
      `SELECT * FROM bans WHERE user_id=$1 AND is_active=true AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    )
    return res.json({ ban: result.rows[0] || null, isBanned: result.rows.length > 0 })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /ban — issue a ban (called when player declines match ready)
app.post('/ban', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, reason } = req.body
    const targetId = userId || req.userId

    // Find current ban level to escalate
    const banHistory = await pool.query(
      'SELECT COUNT(*) FROM bans WHERE user_id=$1',
      [targetId]
    )
    const banLevel = Math.min(parseInt(banHistory.rows[0].count) + 1, 4)
    const durations = [5, 10, 20, 30]
    const durationMinutes = durations[banLevel - 1] || 30
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

    await pool.query(
      `INSERT INTO bans (user_id, reason, ban_level, duration_minutes, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [targetId, reason || 'Match declined', banLevel, durationMinutes, expiresAt]
    )
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1,'ban','Matchmaking Ban',
       'You have been banned from matchmaking for ${durationMinutes} minutes.')`,
      [targetId]
    )
    return res.json({ ok: true, banLevel, durationMinutes, expiresAt })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// STEAM
// =====================================================

const STEAM_CACHE_HOURS = 24

type SteamCheckResult = {
  steamId: string
  steamAvatar: string | null
  steamProfileUrl: string | null
  ownsHL1: boolean
  hasVacBan: boolean
  hasGameBan: boolean
  lastSteamCheck: Date
}

const isFreshSteamCheck = (lastSteamCheck: Date | string | null | undefined) => {
  if (!lastSteamCheck) return false
  const checkedAt = new Date(lastSteamCheck).getTime()
  if (Number.isNaN(checkedAt)) return false
  return Date.now() - checkedAt < STEAM_CACHE_HOURS * 60 * 60 * 1000
}

const fetchSteamJson = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Steam API request failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<any>
}

const fetchSteamData = async (steamId: string): Promise<SteamCheckResult> => {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) throw new Error('Steam API key not configured')

  const encodedKey = encodeURIComponent(apiKey)
  const encodedSteamId = encodeURIComponent(steamId)

  const [profileData, gamesData, banData] = await Promise.all([
    fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodedKey}&steamids=${encodedSteamId}`
    ),
    fetchSteamJson(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodedKey}&steamid=${encodedSteamId}&appids_filter[0]=70`
    ),
    fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${encodedKey}&steamids=${encodedSteamId}`
    ),
  ])

  const player = profileData.response?.players?.[0]
  if (!player) {
    throw new Error('Steam profile not found or is unavailable')
  }

  const games = gamesData.response?.games || []
  const playerBan = banData.players?.[0]

  return {
    steamId,
    steamAvatar: player.avatarfull || null,
    steamProfileUrl: player.profileurl || null,
    ownsHL1: games.some((game: any) => Number(game.appid) === 70),
    hasVacBan: Boolean(playerBan?.VACBanned),
    hasGameBan: Number(playerBan?.NumberOfGameBans || 0) > 0,
    lastSteamCheck: new Date(),
  }
}

const saveSteamData = async (userId: string, steam: SteamCheckResult) => {
  // steam_verified means eligible for Sector Nine matchmaking:
  // valid profile + owns HL1 + no VAC or game ban.
  const steamVerified = steam.ownsHL1 && !steam.hasVacBan && !steam.hasGameBan

  const result = await pool.query(
    `UPDATE users SET
       steam_id=$1,
       steam_avatar=$2,
       steam_profile_url=$3,
       steam_verified=$4,
       owns_hl1=$5,
       vac_banned=$6,
       game_banned=$7,
       last_steam_check=$8
     WHERE id=$9
     RETURNING *`,
    [
      steam.steamId,
      steam.steamAvatar,
      steam.steamProfileUrl,
      steamVerified,
      steam.ownsHL1,
      steam.hasVacBan,
      steam.hasGameBan,
      steam.lastSteamCheck,
      userId,
    ]
  )

  return result.rows[0]
}

const steamResultFromUser = (user: any): SteamCheckResult => ({
  steamId: user.steam_id,
  steamAvatar: user.steam_avatar || null,
  steamProfileUrl: user.steam_profile_url || null,
  ownsHL1: Boolean(user.owns_hl1),
  hasVacBan: Boolean(user.vac_banned),
  hasGameBan: Boolean(user.game_banned),
  lastSteamCheck: new Date(user.last_steam_check),
})

const getOptionalUserId = (req: Request): string | null => {
  const header = req.headers.authorization
  if (!header) return null
  if (!header.startsWith('Bearer ')) throw new Error('INVALID_SESSION')

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), JWT_SECRET) as { sub: string }
    return payload.sub
  } catch {
    throw new Error('INVALID_SESSION')
  }
}

const verifySteamOpenIdResponse = async (callbackParams: unknown): Promise<string> => {
  if (!callbackParams || typeof callbackParams !== 'object' || Array.isArray(callbackParams)) {
    throw new Error('INVALID_STEAM_CALLBACK')
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(callbackParams as Record<string, unknown>)) {
    if (key.startsWith('openid.') && typeof value === 'string') params.set(key, value)
  }

  if (params.get('openid.mode') !== 'id_res') throw new Error('INVALID_STEAM_CALLBACK')

  const claimedId = params.get('openid.claimed_id')
  const identity = params.get('openid.identity')
  const claimedMatch = claimedId?.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)
  if (!claimedMatch || identity !== claimedId) throw new Error('INVALID_STEAM_CALLBACK')

  params.set('openid.mode', 'check_authentication')
  const response = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!response.ok) throw new Error('STEAM_OPENID_UNAVAILABLE')

  const verification = await response.text()
  const isValid = verification
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === 'is_valid:true')
  if (!isValid) throw new Error('INVALID_STEAM_CALLBACK')

  return claimedMatch[1]
}

// POST /steam/auth
// Verifies Steam's signed OpenID callback before either signing in an existing
// linked user or linking Steam to the currently authenticated email account.
app.post('/steam/auth', async (req, res) => {
  try {
    const authenticatedUserId = getOptionalUserId(req)
    const steamId = await verifySteamOpenIdResponse(req.body)

    const linkedResult = await pool.query('SELECT * FROM users WHERE steam_id=$1 LIMIT 1', [steamId])
    let user = linkedResult.rows[0]

    if (!user) {
      if (!authenticatedUserId) {
        return res.status(404).json({
          error: 'Register or sign in with email/password, then connect this Steam account.',
          code: 'STEAM_ACCOUNT_NOT_LINKED',
        })
      }

      const authenticatedResult = await pool.query('SELECT * FROM users WHERE id=$1', [authenticatedUserId])
      user = authenticatedResult.rows[0]
      if (!user) return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' })
    }

    // A fresh linked record already contains the profile, ownership, and ban data.
    // Otherwise make exactly one parallel Steam Web API refresh and cache it.
    if (user.steam_id !== steamId || !isFreshSteamCheck(user.last_steam_check)) {
      const steam = await fetchSteamData(steamId)
      user = await saveSteamData(user.id, steam)
    }

    await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id])
    const profile = toProfile(user)
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    return res.json({ user: profile, profile, session: { access_token: token } })
  } catch (err: any) {
    if (err.message === 'INVALID_SESSION') {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_SESSION' })
    }
    if (err.message === 'INVALID_STEAM_CALLBACK') {
      return res.status(401).json({ error: 'Steam OpenID verification failed', code: 'INVALID_STEAM_CALLBACK' })
    }
    if (err.message === 'STEAM_OPENID_UNAVAILABLE') {
      return res.status(502).json({ error: 'Steam OpenID verification is unavailable', code: err.message })
    }
    console.error('steam auth error:', err.message)
    return res.status(500).json({ error: 'Steam authentication failed' })
  }
})

// POST /steam/link
// Links a SteamID64, fetches profile/ownership/ban data once, and caches it for 24 hours.
const linkSteamHandler = async (req: AuthRequest, res: Response) => {
  try {
    const steamId = String(req.body?.steamId || '').trim()

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({ error: 'A valid 17-digit SteamID64 is required' })
    }

    const existing = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    const user = existing.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Avoid spending more Steam API calls when the same account was checked recently.
    if (user.steam_id === steamId && isFreshSteamCheck(user.last_steam_check)) {
      const cached = steamResultFromUser(user)
      return res.json({
        profile: toProfile(user),
        ownsHL1: cached.ownsHL1,
        hasVacBan: cached.hasVacBan,
        hasGameBan: cached.hasGameBan,
        cached: true,
      })
    }

    const steam = await fetchSteamData(steamId)
    const updatedUser = await saveSteamData(req.userId!, steam)

    return res.json({
      profile: toProfile(updatedUser),
      ownsHL1: steam.ownsHL1,
      hasVacBan: steam.hasVacBan,
      hasGameBan: steam.hasGameBan,
      cached: false,
    })
  } catch (err: any) {
    console.error('steam link error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

app.post('/steam/link', requireAuth, linkSteamHandler)

// Backwards-compatible alias for older frontend code.
app.post('/user/steam/link', requireAuth, linkSteamHandler)

// POST /steam/verify-game
// Uses the database cache when possible. A force=true body field refreshes Steam immediately.
app.post('/steam/verify-game', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requestedSteamId = String(req.body?.steamId || '').trim()
    const force = req.body?.force === true

    const userResult = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    const steamId = requestedSteamId || user.steam_id
    if (!steamId || !/^\d{17}$/.test(steamId)) {
      return res.status(400).json({ error: 'A valid 17-digit SteamID64 is required' })
    }

    if (!force && user.steam_id === steamId && isFreshSteamCheck(user.last_steam_check)) {
      const cached = steamResultFromUser(user)
      return res.json({
        ownsGame: cached.ownsHL1,
        ownsHL1: cached.ownsHL1,
        hasVacBan: cached.hasVacBan,
        hasGameBan: cached.hasGameBan,
        cached: true,
        lastSteamCheck: user.last_steam_check,
      })
    }

    const steam = await fetchSteamData(steamId)

    // Save only to the authenticated user's own profile.
    const updatedUser = await saveSteamData(req.userId!, steam)

    return res.json({
      ownsGame: steam.ownsHL1,
      ownsHL1: steam.ownsHL1,
      hasVacBan: steam.hasVacBan,
      hasGameBan: steam.hasGameBan,
      cached: false,
      lastSteamCheck: updatedUser.last_steam_check,
    })
  } catch (err: any) {
    console.error('steam verify error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// GET /steam/profile/:steamId
// Public profile lookup. Uses the local cache only for an already-linked account.
app.get('/steam/profile/:steamId', async (req, res) => {
  try {
    const steamId = String(req.params.steamId || '').trim()
    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({ error: 'A valid 17-digit SteamID64 is required' })
    }

    const cachedUser = await pool.query(
      `SELECT steam_id, steam_avatar, steam_profile_url, last_steam_check
       FROM users
       WHERE steam_id=$1
       LIMIT 1`,
      [steamId]
    )

    const cached = cachedUser.rows[0]
    if (cached && isFreshSteamCheck(cached.last_steam_check)) {
      return res.json({
        profile: {
          steamid: cached.steam_id,
          avatarfull: cached.steam_avatar,
          profileurl: cached.steam_profile_url,
        },
        cached: true,
      })
    }

    const apiKey = process.env.STEAM_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Steam API key not configured' })

    const data = await fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`
    )

    return res.json({ profile: data.response?.players?.[0] || null, cached: false })
  } catch (err: any) {
    console.error('steam profile error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// START
// =====================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐘 Sector Nine running on port ${PORT}`)
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:.*@/, ':***@') || 'not set'}`)
})

export default app
