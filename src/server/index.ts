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
app.use(express.json())

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
    steamProfileUrl: u.steam_profile_url,
    steamVerified: u.steam_verified || false,
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

// PUT /user/profile — now accepts bio, profileVisibility, showOnlineStatus, steamVerified
app.put('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    // Allowed DB columns → frontend field names (camelCase or snake_case both accepted)
    const fieldMap: Record<string, string> = {
      display_name:       'displayName',
      bio:                'bio',
      steam_id:           'steamId',
      steam_avatar:       'steamAvatar',
      steam_profile_url:  'steamProfileUrl',
      steam_verified:     'steamVerified',
      profile_visibility: 'profileVisibility',
      show_online_status: 'showOnlineStatus',
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

// POST /user/steam/link
app.post('/user/steam/link', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { steamId, steamAvatar, steamProfileUrl } = req.body
    const result = await pool.query(
      `UPDATE users SET steam_id=$1, steam_avatar=$2, steam_profile_url=$3 WHERE id=$4 RETURNING *`,
      [steamId, steamAvatar, steamProfileUrl, req.userId]
    )
    return res.json({ profile: toProfile(result.rows[0]) })
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
        p1.username AS player1_username, p1.steam_avatar AS player1_avatar, p1.level AS player1_level,
        p2.username AS player2_username, p2.steam_avatar AS player2_avatar, p2.level AS player2_level
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
      `SELECT tp.*, u.username, u.steam_avatar, u.level, u.is_premium
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
      `SELECT tp.*, u.username, u.steam_avatar, u.level, u.is_premium
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
      `SELECT le.*, u.username, u.steam_avatar, u.level, u.is_premium,
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
      `SELECT f.*, u.username, u.steam_avatar, u.level, u.is_premium, u.last_seen
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
      `SELECT id, username, steam_avatar, level, is_premium
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

// POST /steam/verify-game — checks if user owns Half-Life 1 (App ID 70)
// FIX: now also returns ownsHL1 and vacStatus so SteamCallback gets the right shape
app.post('/steam/verify-game', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { steamId, appId = 70 } = req.body
    const apiKey = process.env.STEAM_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Steam API key not configured' })

    const [gamesRes, banRes] = await Promise.all([
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&appids_filter[0]=${appId}`),
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${apiKey}&steamids=${steamId}`),
    ])
    const gamesData: any = await gamesRes.json()
    const banData: any = await banRes.json()

    const games = gamesData.response?.games || []
    const ownsHL1 = games.length > 0
    const playerBan = banData.players?.[0]
    const hasVacBan = playerBan?.VACBanned || false
    const hasGameBan = playerBan?.NumberOfGameBans > 0

    return res.json({ ownsGame: ownsHL1, ownsHL1, hasVacBan, hasGameBan, games })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

app.get('/steam/profile/:steamId', async (req, res) => {
  try {
    const apiKey = process.env.STEAM_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Steam API key not configured' })
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${req.params.steamId}`
    )
    const data: any = await response.json()
    return res.json({ profile: data.response?.players?.[0] || null })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /steam/link — links Steam ID and fetches+saves the full Steam profile automatically
app.post('/steam/link', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { steamId } = req.body
    if (!steamId) return res.status(400).json({ error: 'steamId required' })

    const apiKey = process.env.STEAM_API_KEY
    let steamAvatar = null
    let steamProfileUrl = null
    let ownsHL1 = false
    let hasVacBan = false

    if (apiKey) {
      // Fetch Steam profile + ownership + bans in parallel
      const [profileRes, gamesRes, banRes] = await Promise.all([
        fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`),
        fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&appids_filter[0]=70`),
        fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${apiKey}&steamids=${steamId}`),
      ])
      const [profileData, gamesData, banData]: [any, any, any] = await Promise.all([
        profileRes.json(), gamesRes.json(), banRes.json()
      ])

      const player = profileData.response?.players?.[0]
      steamAvatar = player?.avatarfull || null
      steamProfileUrl = player?.profileurl || null
      ownsHL1 = (gamesData.response?.games || []).length > 0
      hasVacBan = banData.players?.[0]?.VACBanned || false
    }

    const result = await pool.query(
      `UPDATE users SET steam_id=$1, steam_avatar=$2, steam_profile_url=$3, steam_verified=true
       WHERE id=$4 RETURNING *`,
      [steamId, steamAvatar, steamProfileUrl, req.userId]
    )

    // Return ownsHL1 and vacStatus so SteamCallback can check them
    return res.json({ profile: toProfile(result.rows[0]), ownsHL1, hasVacBan })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {
  console.log(`\n🐘 Sector Nine running on http://localhost:${PORT}`)
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:.*@/, ':***@') || 'not set'}`)
})

export default app
