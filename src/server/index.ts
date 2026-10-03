import express, { Request, Response, NextFunction } from 'express'
import cors, { CorsOptions } from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db'
import dotenv from 'dotenv'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { createAdminRouter } from './admin'
import { onlineUserPredicate } from './presence'
import { provisionMatchServer, startGameServerMonitor } from './rcon'
import { SUPPORTED_REGIONS, isSupportedRegionId } from '../shared/regions'
import { resolveSteamLoginUser } from './steamAuthAccount'
import { authSessionRejection, AuthTokenPayload } from './authSession'

dotenv.config()

// =====================================================
// SETUP
// =====================================================

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const serveFrontend = process.env.SERVE_FRONTEND === 'true'
type LogLevel = 'info' | 'warn' | 'error'
const configuredLogLevel=String(process.env.LOG_LEVEL||'info').toLowerCase()
if(!['info','warn','error'].includes(configuredLogLevel))throw new Error('LOG_LEVEL must be info, warn, or error')
const logPriority:Record<LogLevel,number>={info:10,warn:20,error:30}
const logEvent = (level: LogLevel, event: string, details: Record<string, unknown> = {}) => {
  if(logPriority[level]<logPriority[configuredLogLevel as LogLevel])return
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...details })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}
const developmentJwtSecret = 'sector-nine-dev-secret-change-in-production'
const configuredJwtSecret = process.env.JWT_SECRET
if (process.env.NODE_ENV === 'production' &&
    (!configuredJwtSecret || configuredJwtSecret === developmentJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production')
}
const JWT_SECRET = configuredJwtSecret || developmentJwtSecret
const JWT_EXPIRES = '7d'
const passwordResetEnabled=process.env.PASSWORD_RESET_ENABLED==='true'
const publicAppUrl=String(process.env.PUBLIC_APP_URL||process.env.APP_ORIGIN||'').split(',')[0].trim().replace(/\/$/,'')
const smtpPort=Number(process.env.SMTP_PORT||587)
const smtpConfigured=Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM&&publicAppUrl&&Number.isInteger(smtpPort)&&smtpPort>0&&smtpPort<=65535)
const SMTP_CONNECTION_TIMEOUT_MS=10_000
const SMTP_GREETING_TIMEOUT_MS=10_000
const SMTP_SOCKET_TIMEOUT_MS=15_000
const smtpSecure=process.env.SMTP_SECURE==='true'
const smtpAuthConfigured=Boolean(process.env.SMTP_USER&&process.env.SMTP_PASS)
const sanitizeSmtpLogText=(value:any)=>String(value||'Unknown SMTP error')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-email]')
  .replace(/token=[^&\s"']+/gi,'token=[redacted]')
const classifySmtpFailure=(error:any)=>{
  const code=String(error?.code||'').toUpperCase()
  const command=String(error?.command||'').toUpperCase()
  const syscall=String(error?.syscall||'').toLowerCase()
  const message=String(error?.message||'').toLowerCase()
  const responseCode=Number(error?.responseCode||0)
  if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'dns'
  if(code==='ETIMEDOUT'||(syscall==='connect'&&command==='CONN'))return 'tcp_connection_timeout'
  if(command==='GREET')return 'greeting_timeout'
  if(code==='EAUTH'||[534,535].includes(responseCode))return 'authentication'
  if(code==='ETLS'||message.includes('tls')||message.includes('ssl')||message.includes('certificate'))return 'tls'
  if(responseCode>=400)return 'smtp_rejection'
  return 'other'
}
const smtpTimeoutType=(error:any)=>{
  const code=String(error?.code||'').toUpperCase()
  const command=String(error?.command||'').toUpperCase()
  if(code==='ETIMEDOUT'&&command==='CONN')return 'connection'
  if(code==='ETIMEDOUT'&&command==='GREET')return 'greeting'
  if(code==='ETIMEDOUT')return 'socket'
  return null
}
const safeSmtpErrorDetails=(error:any)=>({
  smtpHost:process.env.SMTP_HOST||null,
  hostname:error?.hostname||process.env.SMTP_HOST||null,
  smtpPort,
  smtpSecure,
  smtpAuthConfigured,
  connectionTimeoutMs:SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeoutMs:SMTP_GREETING_TIMEOUT_MS,
  socketTimeoutMs:SMTP_SOCKET_TIMEOUT_MS,
  failureType:classifySmtpFailure(error),
  timeoutType:smtpTimeoutType(error),
  errorCode:error?.code||null,
  errorCommand:error?.command||null,
  responseCode:error?.responseCode||null,
  syscall:error?.syscall||null,
  message:sanitizeSmtpLogText(error?.message),
})
if(process.env.NODE_ENV==='production'){
  const databaseUrl=process.env.DATABASE_URL||''
  const steamApiKey=process.env.STEAM_API_KEY||''
  const rconEncryptionKey=process.env.RCON_ENCRYPTION_KEY||''
  if(!/^postgres(?:ql)?:\/\//i.test(databaseUrl))throw new Error('DATABASE_URL must be a PostgreSQL connection URL in production')
  if(!steamApiKey||/^(your_|replace_|example)/i.test(steamApiKey))throw new Error('STEAM_API_KEY must be configured in production')
  if(!/^[0-9a-f]{64}$/i.test(rconEncryptionKey))throw new Error('RCON_ENCRYPTION_KEY must contain 64 hexadecimal characters in production')
  if(!passwordResetEnabled)throw new Error('PASSWORD_RESET_ENABLED must be true in production')
  if(!smtpConfigured)throw new Error('SMTP_HOST, SMTP_PORT, SMTP_FROM, and PUBLIC_APP_URL are required in production')
  if(!publicAppUrl.startsWith('https://'))throw new Error('PUBLIC_APP_URL must use HTTPS in production')
  if(/example\.(com|test)/i.test(String(process.env.SMTP_HOST)))throw new Error('SMTP_HOST must not use an example domain in production')
}
const mailTransport=smtpConfigured?nodemailer.createTransport({
  host:process.env.SMTP_HOST,
  port:smtpPort,
  secure:smtpSecure,
  connectionTimeout:SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeout:SMTP_GREETING_TIMEOUT_MS,
  socketTimeout:SMTP_SOCKET_TIMEOUT_MS,
  ...(smtpAuthConfigured?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}:{}),
}):null
if(mailTransport&&passwordResetEnabled){
  logEvent('info','smtp_transport_configured',{
    smtpHost:process.env.SMTP_HOST,
    smtpPort,
    smtpSecure,
    smtpAuthConfigured,
    connectionTimeoutMs:SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeoutMs:SMTP_GREETING_TIMEOUT_MS,
    socketTimeoutMs:SMTP_SOCKET_TIMEOUT_MS,
  })
  mailTransport.verify()
    .then(()=>logEvent('info','smtp_transport_verify_succeeded',{
      smtpHost:process.env.SMTP_HOST,
      smtpPort,
      smtpSecure,
      smtpAuthConfigured,
    }))
    .catch(error=>logEvent('error','smtp_transport_verify_failed',safeSmtpErrorDetails(error)))
}
const runtimeSettingDefaults:any={maintenance_mode:false,registration_enabled:true,platform_announcement:{enabled:false,title:'',message:''},matchmaking_defaults:{gameMode:'classic-deathmatch',selectedMaps:['dm_crossfire'],queueTimeoutMinutes:15},xp_defaults:{win:50,loss:10},points_defaults:{startingBalance:1000,win:0,loss:0}}
const parseStoredSetting=(value:any)=>{if(typeof value!=='string')return value;try{return JSON.parse(value)}catch{return value}}
const storedBoolean=(value:any,fallback:boolean)=>{const parsed=parseStoredSetting(value);return typeof parsed==='boolean'?parsed:fallback}
const storedObject=(value:any,fallback:Record<string,any>)=>{const parsed=parseStoredSetting(value);return parsed&&!Array.isArray(parsed)&&typeof parsed==='object'?{...fallback,...parsed}:{...fallback}}
const getPlatformSettings=async()=>{
  const rows=(await pool.query('SELECT key,value FROM platform_settings WHERE key=ANY($1::text[])',[Object.keys(runtimeSettingDefaults)])).rows
  const stored=Object.fromEntries(rows.map(row=>[row.key,parseStoredSetting(row.value)]))
  const announcement=storedObject(stored.platform_announcement,runtimeSettingDefaults.platform_announcement)
  return{
    maintenance_mode:storedBoolean(stored.maintenance_mode,runtimeSettingDefaults.maintenance_mode),
    registration_enabled:storedBoolean(stored.registration_enabled,runtimeSettingDefaults.registration_enabled),
    platform_announcement:{enabled:storedBoolean(announcement.enabled,false),title:typeof announcement.title==='string'?announcement.title:'',message:typeof announcement.message==='string'?announcement.message:''},
    matchmaking_defaults:storedObject(stored.matchmaking_defaults,runtimeSettingDefaults.matchmaking_defaults),
    xp_defaults:storedObject(stored.xp_defaults,runtimeSettingDefaults.xp_defaults),
    points_defaults:storedObject(stored.points_defaults,runtimeSettingDefaults.points_defaults),
  }
}

// Shared SQL keeps high-frequency account reads and presence writes consistent.
const selectUserByIdSql = 'SELECT * FROM users WHERE id=$1'
const touchUserPresenceSql = 'UPDATE users SET last_seen=NOW() WHERE id=$1'
const supportedGameIds = ['hl1', 'cs16', 'l4d2', 'cod4'] as const
type SupportedGameId = typeof supportedGameIds[number]
const isSupportedGameId = (value: unknown): value is SupportedGameId =>
  typeof value === 'string' && supportedGameIds.includes(value as SupportedGameId)
const noServerInSelectedRegionError = 'No available server in selected region.'
const validUserId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const userVerifiedGames = (user: any): SupportedGameId[] => {
  const stored = Array.isArray(user?.verified_game_ids) ? user.verified_game_ids : []
  return [...new Set([
    ...(user?.steam_verified && user?.owns_hl1 ? ['hl1'] : []),
    ...stored.filter(isSupportedGameId),
  ])] as SupportedGameId[]
}
const gameEligibilityError = (user: any, gameId: SupportedGameId) => {
  if (!user?.steam_id) return { status: 403, code: 'STEAM_NOT_LINKED', error: 'Connect your Steam account before selecting a competitive game.' }
  if (user.vac_banned || user.game_banned) return { status: 403, code: 'STEAM_BANNED', error: 'This Steam account is not eligible for competitive play.' }
  if (!userVerifiedGames(user).includes(gameId)) return { status: 403, code: 'GAME_NOT_VERIFIED', error: `Ownership or access for ${gameId} has not been verified.` }
  return null
}

const sendDatabaseError = (res: Response, error: any) => {
  const migrationRequired = error?.code === '42703' || error?.code === '42P01'
  logEvent('error', 'database_request_failed', {
    requestId: res.locals.requestId,
    databaseCode: error?.code,
    message: error?.message || 'Unknown database error',
  })
  return res.status(migrationRequired ? 503 : 500).json({
    code: migrationRequired ? 'DATABASE_MIGRATION_REQUIRED' : 'DATABASE_ERROR',
    error: migrationRequired ? 'A database migration is required' : 'Database request failed',
    requestId: res.locals.requestId,
  })
}

const sendInternalError = (
  res: Response,
  error: any,
  event = 'request_failed',
  status = 500,
  code = 'INTERNAL_ERROR',
) => {
  logEvent('error', event, {
    requestId: res.locals.requestId,
    message: error?.message || 'Unknown request error',
  })
  return res.status(status).json({
    error: status === 502 ? 'Upstream service request failed' : 'Internal server error',
    code,
    requestId: res.locals.requestId,
  })
}

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase()
const configuredOrigins = String(process.env.APP_ORIGIN || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('APP_ORIGIN must list the allowed frontend origin in production')
}
const developmentOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000']
const allowedOrigins = new Set(process.env.NODE_ENV === 'production' ? configuredOrigins : [...developmentOrigins, ...configuredOrigins])
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}
app.options(/.*/, cors(corsOptions))
app.use(cors(corsOptions))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (error.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: error.message, code: 'CORS_ORIGIN_DENIED' })
  }
  next(error)
})
app.use(express.json({ limit: '2mb' }))
app.use((req: Request, res: Response, next: NextFunction) => {
  const suppliedRequestId = req.get('x-request-id')
  const requestId = suppliedRequestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID()
  const startedAt = process.hrtime.bigint()
  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    logEvent(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'http_request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    })
  })
  next()
})
for (const parameter of ['id', 'userId', 'recipientId', 'commentId', 'messageId', 'requestId', 'friendshipId']) {
  app.param(parameter, (_req, res, next, value) => {
    if (validUserId(value)) return next()
    return res.status(400).json({
      error: `Invalid ${parameter} parameter`,
      code: 'INVALID_UUID_PARAMETER',
      requestId: res.locals.requestId,
    })
  })
}

const limiter = (windowMs: number, limit: number) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.', code: 'RATE_LIMITED' },
})
app.use('/auth', limiter(15 * 60 * 1000, 20))
app.use('/steam', limiter(5 * 60 * 1000, 40))
app.use('/game-server', limiter(60 * 1000, 180))
app.use('/admin', limiter(60 * 1000, 180))
app.use('/matchmaking', limiter(60 * 1000, 120))
app.use('/news', limiter(60 * 1000, 120))
app.use('/users', limiter(60 * 1000, 120))
app.use('/profile-comments', limiter(60 * 1000, 60))
app.use('/chat', limiter(60 * 1000, 120))
app.use('/friends', limiter(60 * 1000, 90))
app.use('/report', limiter(60 * 60 * 1000, 10))
app.use('/support', limiter(60 * 60 * 1000, 20))

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
  let payload: AuthTokenPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as typeof payload
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  if (!validUserId(payload.sub)) return res.status(401).json({ error: 'Invalid or expired token' })
  logEvent('info', 'auth_jwt_decoded', { userId: payload.sub, authVersion: Number(payload.av || 0) })
  try {
    const account=(await pool.query('SELECT email,role,auth_version,deleted_at,steam_id FROM users WHERE id=$1',[payload.sub])).rows[0]
    const rejectionReason = authSessionRejection(payload, account)
    logEvent('info', 'auth_session_lookup', {
      userId: payload.sub,
      found: Boolean(account),
      active: Boolean(account && !account.deleted_at),
      authVersion: account ? Number(account.auth_version || 0) : null,
    })
    if(rejectionReason){
      logEvent('warn', 'auth_session_rejected', { reason: rejectionReason, userId: payload.sub })
      return res.status(401).json({error:'Session is no longer active',code:'SESSION_REVOKED'})
    }
    logEvent('info','authenticated_identity',{
      userId:payload.sub,
      role:account.role,
      authProvider:account.email?'password':account.steam_id?'steam':'unknown',
      hasSteamId:Boolean(account.steam_id),
    })
    req.userId = payload.sub
    req.userEmail = account.email
    return next()
  } catch(error:any) {
    return sendDatabaseError(res,error)
  }
}

const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header) return next()
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Invalid authorization header' })
  let payload: AuthTokenPayload
  try {
    payload = jwt.verify(header.slice(7), JWT_SECRET) as typeof payload
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  if(!validUserId(payload.sub))return res.status(401).json({error:'Invalid or expired token'})
  try{
    const account=(await pool.query('SELECT email,auth_version,deleted_at FROM users WHERE id=$1',[payload.sub])).rows[0]
    const rejectionReason = authSessionRejection(payload, account)
    if(rejectionReason)return res.status(401).json({error:'Session is no longer active',code:'SESSION_REVOKED'})
    req.userId=payload.sub
    req.userEmail=account.email
    return next()
  }catch(error:any){return sendDatabaseError(res,error)}
}

const canViewUserProfile = async (viewerId: string | undefined, profileUserId: string) => {
  const user = (await pool.query('SELECT id,profile_visibility FROM users WHERE id=$1 AND deleted_at IS NULL', [profileUserId])).rows[0]
  if (!user) return { exists: false, allowed: false }
  if (viewerId === profileUserId || user.profile_visibility === 'public') return { exists: true, allowed: true }
  if (user.profile_visibility === 'friends' && viewerId) {
    const friendship = await pool.query(
      `SELECT id FROM friendships WHERE status='accepted'
       AND ((user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)) LIMIT 1`,
      [viewerId, profileUserId],
    )
    return { exists: true, allowed: Boolean(friendship.rows[0]) }
  }
  return { exists: true, allowed: false }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizedEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const validPassword = (value: unknown) => typeof value === 'string' && value.length >= 8 && value.length <= 128
const sanitizeDisplayName = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}
const resolveDisplayName = (user: any) =>
  sanitizeDisplayName(user?.steam_verified && user?.steam_persona_name ? user.steam_persona_name : '') ||
  sanitizeDisplayName(user?.display_name) ||
  sanitizeDisplayName(user?.username) ||
  'Player'
const displayNameSql = (alias: string) =>
  `COALESCE(NULLIF(BTRIM(CASE WHEN ${alias}.steam_verified=true THEN ${alias}.steam_persona_name ELSE NULL END),''),NULLIF(BTRIM(${alias}.display_name),''),${alias}.username)`

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
  const verifiedGameIds = Array.isArray(u.verified_game_ids) ? u.verified_game_ids : []
  const availableThemes = Array.from(new Set([
    'default',
    ...(u.steam_verified && u.owns_hl1 ? ['hl1'] : []),
    ...verifiedGameIds.filter((gameId: string) => ['hl1', 'cs16', 'l4d2', 'cod4'].includes(gameId)),
  ]))

  return {
    id: u.id,
    email: u.email,
    username: u.username,
    accountUsername: u.username,
    role: u.role || 'user',
    displayName: resolveDisplayName(u),
    localDisplayName: u.display_name || null,
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
    countryCode: u.country_code || null,
    socialLinks: u.social_links || {},
    notificationPreferences: u.notification_preferences || {
      matchFound: true,
      friendRequests: true,
      tournaments: true,
      messages: true,
      social: true,
      systemMaintenance: true,
      securityAlerts: true,
    },
    steamVerified: u.steam_verified || false,
    ownsHL1: u.owns_hl1 || false,
    vacBanned: u.vac_banned || false,
    gameBanned: u.game_banned || false,
    steamPersonaName: u.steam_persona_name || null,
    steamLevel: u.steam_level == null ? null : Number(u.steam_level),
    steamVisibility: u.steam_visibility == null ? null : Number(u.steam_visibility),
    steamGamesVisible: Boolean(u.steam_games_visible),
    steamVacBanCount: Number(u.steam_vac_ban_count || 0),
    steamGameBanCount: Number(u.steam_game_ban_count || 0),
    lastSteamCheck: u.last_steam_check,
    wins,
    losses,
    winStreak: u.win_streak,
    bestWinStreak: u.best_win_streak,
    totalKills: kills,
    totalDeaths: deaths,
    profileVisibility: u.profile_visibility || 'public',
    showOnlineStatus: u.show_online_status !== false,
    themeMode: u.theme_mode === 'follow_game' ? 'follow_game' : 'manual',
    preferredTheme: ['default', 'hl1', 'cs16', 'l4d2', 'cod4'].includes(u.preferred_theme) ? u.preferred_theme : 'default',
    availableThemes,
    preferredGameId: isSupportedGameId(u.preferred_game_id) ? u.preferred_game_id : 'hl1',
    verifiedGames: userVerifiedGames(u),
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

app.get(['/health','/health/live'], (_req, res) => res.json({ ok: true }))
app.get('/health/ready', async (_req, res) => {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Database readiness timeout')),2000)),
    ])
    return res.json({ ok: true, database: 'ready' })
  } catch {
    return res.status(503).json({ ok: false, database: 'unavailable' })
  }
})
app.get('/platform/settings',async(_req,res)=>{try{const settings=await getPlatformSettings();res.json({maintenanceMode:settings.maintenance_mode,registrationEnabled:settings.registration_enabled,announcement:settings.platform_announcement})}catch(err:any){sendDatabaseError(res,err)}})

const finalizeServerReportedMatch=async(db:any,matchId:string,winnerId:string,reported:any)=>{
  const match=(await db.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE',[matchId])).rows[0]
  if(!match)throw new Error('Assigned match not found')
  if(match.status==='completed')return match
  if(match.status!=='in_progress')throw new Error('Only an in-progress match can be completed')
  if(![match.player1_id,match.player2_id].includes(winnerId))throw new Error('Winner must be a match participant')
  const values:Record<string,number>={}
  for(const key of ['score_p1','score_p2','p1_kills','p1_deaths','p2_kills','p2_deaths']){const value=Number(reported?.[key]??0);if(!Number.isInteger(value)||value<0||value>100000)throw new Error(`Invalid match statistic: ${key}`);values[key]=value}
  const settings=await getPlatformSettings(),p1Won=winnerId===match.player1_id,p1Delta=p1Won?25:-20,p2Delta=p1Won?-20:25
  const rankState=async(playerId:string)=>{const row=(await db.query(`SELECT COALESCE(own.rating,1000)::int rating,(COUNT(other.user_id)+1)::int rank FROM (SELECT $1::uuid user_id,$2::text game_id) target LEFT JOIN user_game_stats own ON own.user_id=target.user_id AND own.game_id=target.game_id LEFT JOIN user_game_stats other ON other.game_id=target.game_id AND other.rating>COALESCE(own.rating,1000) GROUP BY own.rating`,[playerId,match.game_id])).rows[0];return{rating:Number(row.rating),rank:Number(row.rank)}}
  const [p1Before,p2Before]=await Promise.all([rankState(match.player1_id),rankState(match.player2_id)])
  await db.query(`UPDATE matches SET status='completed',winner_id=$1,completed_at=NOW(),score_p1=$2,score_p2=$3,p1_xp_change=$4,p2_xp_change=$5,p1_rating_change=$6,p2_rating_change=$7,result_source='game_server' WHERE id=$8`,[winnerId,values.score_p1,values.score_p2,p1Won?settings.xp_defaults.win:settings.xp_defaults.loss,p1Won?settings.xp_defaults.loss:settings.xp_defaults.win,p1Delta,p2Delta,matchId])
  const updatePlayer=async(playerId:string,isWinner:boolean,kills:number,deaths:number)=>{
    const ratingDelta=isWinner?25:-20,xp=isWinner?settings.xp_defaults.win:settings.xp_defaults.loss,points=isWinner?settings.points_defaults.win:settings.points_defaults.loss
    await db.query(
      `INSERT INTO user_game_stats(user_id,game_id,rating,points,experience,level,wins,losses,kills,deaths,matches_played,win_streak,best_win_streak,placement_matches_played,placement_complete)
       VALUES($1,$2,GREATEST(0,1000+$3::int),$4::int,$5::int,GREATEST(1,FLOOR(($5::int)::numeric/300)::int+1),$6::int,$7::int,$8::int,$9::int,1,$6::int,$6::int,1,FALSE)
       ON CONFLICT(user_id,game_id) DO UPDATE SET
         rating=GREATEST(0,user_game_stats.rating+$3::int),points=user_game_stats.points+$4::int,
         experience=user_game_stats.experience+$5::int,level=GREATEST(1,FLOOR((user_game_stats.experience+$5::int)::numeric/300)::int+1),
         wins=user_game_stats.wins+$6::int,losses=user_game_stats.losses+$7::int,kills=user_game_stats.kills+$8::int,deaths=user_game_stats.deaths+$9::int,
         matches_played=user_game_stats.matches_played+1,placement_matches_played=LEAST(5,user_game_stats.placement_matches_played+1),
         placement_complete=(user_game_stats.placement_matches_played+1)>=5,
         win_streak=CASE WHEN $6::int=1 THEN user_game_stats.win_streak+1 ELSE 0 END,
         best_win_streak=GREATEST(user_game_stats.best_win_streak,CASE WHEN $6::int=1 THEN user_game_stats.win_streak+1 ELSE user_game_stats.win_streak END),updated_at=NOW()`,
      [playerId,match.game_id,ratingDelta,points,xp,isWinner?1:0,isWinner?0:1,kills,deaths])
    if(match.game_id==='hl1')await db.query(`UPDATE users SET wins=wins+$1,losses=losses+$2,win_streak=CASE WHEN $1=1 THEN win_streak+1 ELSE 0 END,best_win_streak=GREATEST(best_win_streak,CASE WHEN $1=1 THEN win_streak+1 ELSE win_streak END),experience=experience+$3,points=points+$4,total_kills=total_kills+$5,total_deaths=total_deaths+$6 WHERE id=$7`,[isWinner?1:0,isWinner?0:1,xp,points,kills,deaths,playerId])
  }
  await updatePlayer(match.player1_id,p1Won,values.p1_kills,values.p1_deaths);await updatePlayer(match.player2_id,!p1Won,values.p2_kills,values.p2_deaths)
  const [p1After,p2After]=await Promise.all([rankState(match.player1_id),rankState(match.player2_id)])
  await db.query(`INSERT INTO rating_history(user_id,game_id,match_id,rating_before,rating_after,rating_delta,rank_before,rank_after) VALUES($1,$2,$3,$4,$5,$6,$7,$8),($9,$2,$3,$10,$11,$12,$13,$14)`,[match.player1_id,match.game_id,matchId,p1Before.rating,p1After.rating,p1Delta,p1Before.rank,p1After.rank,match.player2_id,p2Before.rating,p2After.rating,p2Delta,p2Before.rank,p2After.rank])
  await db.query(`INSERT INTO match_events(match_id,sequence,event_type,occurred_at,details) VALUES($1,1,'match_started',COALESCE($2,NOW()),jsonb_build_object('map',$3::text,'source','server_agent')) ON CONFLICT(match_id,sequence) DO NOTHING`,[matchId,match.started_at,match.selected_map])
  await db.query(`INSERT INTO match_events(match_id,sequence,event_type,actor_user_id,occurred_at,details) VALUES($1,2,'match_completed',$2::uuid,NOW(),jsonb_build_object('winnerId',$2::uuid,'scoreP1',$3::int,'scoreP2',$4::int,'source','server_agent')) ON CONFLICT(match_id,sequence) DO UPDATE SET actor_user_id=EXCLUDED.actor_user_id,occurred_at=EXCLUDED.occurred_at,details=EXCLUDED.details`,[matchId,winnerId,values.score_p1,values.score_p2])
  await db.query("UPDATE game_servers SET current_match_id=NULL,status='online',updated_at=NOW() WHERE current_match_id=$1",[matchId])
  return match
}

app.post('/game-server/:id/heartbeat',async(req,res)=>{
  const authorization=String(req.headers.authorization||''),token=authorization.startsWith('Bearer ')?authorization.slice(7):''
  if(!token)return res.status(401).json({error:'Server agent token required'})
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex')
  const playerCount=Number(req.body.playerCount),mapName=typeof req.body.map==='string'?req.body.map.trim().slice(0,100):null
  const players=Array.isArray(req.body.players)?req.body.players.slice(0,128).map((player:any)=>({name:String(player?.name||'').slice(0,100),steamId:player?.steamId?String(player.steamId).slice(0,40):null})):[]
  if(!Number.isInteger(playerCount)||playerCount<0||playerCount>256)return res.status(400).json({error:'Invalid player count'})
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const server=(await db.query('SELECT id,current_match_id,server_token_hash FROM game_servers WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!server||!server.server_token_hash){await db.query('ROLLBACK');return res.status(401).json({error:'Invalid server agent token'})}
    const expected=Buffer.from(server.server_token_hash,'hex'),actual=Buffer.from(tokenHash,'hex')
    if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual)){await db.query('ROLLBACK');return res.status(401).json({error:'Invalid server agent token'})}
    await db.query("UPDATE game_servers SET current_players=$1,current_map=$2,last_heartbeat=NOW(),last_error=NULL,telemetry=$3,status=CASE WHEN current_match_id IS NULL THEN 'online' ELSE 'in_use' END,updated_at=NOW() WHERE id=$4",[playerCount,mapName,JSON.stringify({players,source:'agent'}),server.id])
    await db.query('INSERT INTO game_server_player_snapshots(server_id,player_count,map_name,players) VALUES($1,$2,$3,$4)',[server.id,playerCount,mapName,JSON.stringify(players)])
    if(server.current_match_id&&req.body.matchState==='running'){
      await db.query("UPDATE matches SET status='in_progress',started_at=COALESCE(started_at,NOW()),result_source='game_server' WHERE id=$1 AND status='pending'",[server.current_match_id])
      await db.query("INSERT INTO match_events(match_id,sequence,event_type,occurred_at,details) VALUES($1,1,'match_started',NOW(),jsonb_build_object('map',$2::text,'source','server_agent')) ON CONFLICT(match_id,sequence) DO NOTHING",[server.current_match_id,mapName])
    }
    if(server.current_match_id&&req.body.matchState==='completed'){
      await finalizeServerReportedMatch(db,server.current_match_id,String(req.body.winnerId||''),req.body.stats)
    }
    const demoUrl=typeof req.body.demoUrl==='string'?req.body.demoUrl.trim():''
    if(server.current_match_id&&demoUrl){let parsed:URL;try{parsed=new URL(demoUrl)}catch{await db.query('ROLLBACK');return res.status(400).json({error:'Invalid demo URL'})}if(!['http:','https:'].includes(parsed.protocol)||demoUrl.length>2000){await db.query('ROLLBACK');return res.status(400).json({error:'Invalid demo URL'})}await db.query('UPDATE matches SET demo_url=$1,demo_uploaded_at=NOW() WHERE id=$2',[demoUrl,server.current_match_id])}
    await db.query('COMMIT')
    return res.json({ok:true,matchId:server.current_match_id||null})
  }catch(err:any){await db.query('ROLLBACK');return err?.message===noServerInSelectedRegionError?res.status(409).json({error:noServerInSelectedRegionError,code:'NO_SERVER_IN_SELECTED_REGION'}):sendDatabaseError(res,err)}finally{db.release()}
})

app.get('/game-servers/status',async(req,res)=>{
  const gameId=String(req.query.game_id||'hl1')
  if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
  try{
    const servers=await pool.query(
      `SELECT id,name,game_id,region,ip_address public_host,port,max_slots,status,current_players,current_map,last_heartbeat,
              CASE WHEN jsonb_typeof(telemetry->'players')='array' THEN telemetry->'players' ELSE '[]'::jsonb END players
       FROM game_servers WHERE game_id=$1 ORDER BY region,name`,[gameId])
    return res.json({servers:servers.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.get('/games',async(_req,res)=>{
  try{
    const names:Record<SupportedGameId,string>={hl1:'Half-Life 1',cs16:'Counter-Strike 1.6',l4d2:'Left 4 Dead 2',cod4:'Call of Duty 4 Promod'}
    const result=await pool.query(`SELECT game_id FROM game_matchmaking_config WHERE enabled=true ORDER BY CASE game_id WHEN 'hl1' THEN 0 WHEN 'cs16' THEN 1 WHEN 'l4d2' THEN 2 ELSE 3 END`)
    return res.json({games:result.rows.map(row=>({id:row.game_id,name:names[row.game_id as SupportedGameId]}))})
  }catch(err:any){return sendDatabaseError(res,err)}
})

// Published news only. Drafts and unpublished records are never selected here.
app.get('/news', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
  const limit = Math.min(20, Math.max(1, Number.parseInt(String(req.query.limit || '5'), 10) || 5))
  const q = String(req.query.q || '').trim().slice(0, 200)
  const category = String(req.query.category || '').trim().slice(0, 50)
  const where = `n.is_published=true
    AND ($1='' OR to_tsvector('simple',n.title||' '||n.summary||' '||n.content) @@ websearch_to_tsquery('simple',$1))
    AND ($2='' OR n.category=$2)`
  try {
    const [items, total, categories] = await Promise.all([
      pool.query(
        `SELECT n.id,n.title,n.summary,n.content,n.category,n.is_pinned,n.comments_enabled,
                n.published_at,n.created_at,n.updated_at,
                COALESCE(${displayNameSql('u')},'Sector Nine') author_name,
                0::int comment_count
         FROM news_articles n
         LEFT JOIN users u ON u.id=n.author_id
         WHERE ${where}
         ORDER BY n.published_at DESC,n.id DESC
         LIMIT $3 OFFSET $4`,
        [q, category, limit, (page - 1) * limit],
      ),
      pool.query(`SELECT COUNT(*)::int total FROM news_articles n WHERE ${where}`, [q, category]),
      pool.query(`SELECT DISTINCT category FROM news_articles WHERE is_published=true ORDER BY category`),
    ])
    return res.json({
      items: items.rows,
      total: total.rows[0].total,
      page,
      limit,
      categories: categories.rows.map((row) => row.category),
    })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.get('/news/:id', async (req, res) => {
  try {
    const article = (await pool.query(
      `SELECT n.id,n.title,n.summary,n.content,n.category,n.is_pinned,n.comments_enabled,
              n.published_at,n.created_at,n.updated_at,
              COALESCE(${displayNameSql('u')},'Sector Nine') author_name,
              0::int comment_count
       FROM news_articles n
       LEFT JOIN users u ON u.id=n.author_id
       WHERE n.id=$1 AND n.is_published=true
       `,
      [req.params.id],
    )).rows[0]
    if (!article) return res.status(404).json({ error: 'News article not found', code: 'NEWS_NOT_FOUND' })
    return res.json({ article })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.get('/news/:id/comments',async(req,res)=>{
  try{
    const article=(await pool.query('SELECT id,comments_enabled FROM news_articles WHERE id=$1 AND is_published=true',[req.params.id])).rows[0]
    if(!article)return res.status(404).json({error:'News article not found',code:'NEWS_NOT_FOUND'})
    const comments=await pool.query(
      `SELECT c.id,c.article_id,c.user_id,c.parent_id,c.content,c.created_at,c.updated_at,
              COALESCE(${displayNameSql('u')},'Deleted user') author_name,
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) author_avatar
       FROM news_comments c LEFT JOIN users u ON u.id=c.user_id
       WHERE c.article_id=$1 AND c.is_deleted=false ORDER BY c.created_at,c.id`,[req.params.id])
    return res.json({comments:comments.rows,commentsEnabled:article.comments_enabled})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/news/:id/comments',requireAuth,async(req:AuthRequest,res)=>{
  const content=String(req.body.content||'').trim(),parentId=req.body.parentId||null
  if(!content||content.length>5000)return res.status(400).json({error:'Comment must contain 1 to 5000 characters',code:'INVALID_COMMENT'})
  try{
    const article=(await pool.query('SELECT id,comments_enabled FROM news_articles WHERE id=$1 AND is_published=true',[req.params.id])).rows[0]
    if(!article)return res.status(404).json({error:'News article not found',code:'NEWS_NOT_FOUND'})
    if(!article.comments_enabled)return res.status(409).json({error:'Comments are disabled for this article',code:'COMMENTS_DISABLED'})
    if(parentId){const parent=(await pool.query('SELECT id FROM news_comments WHERE id=$1 AND article_id=$2 AND is_deleted=false',[parentId,req.params.id])).rows[0];if(!parent)return res.status(400).json({error:'Reply target was not found',code:'INVALID_PARENT_COMMENT'})}
    const comment=(await pool.query(
      `WITH inserted AS (INSERT INTO news_comments(article_id,user_id,parent_id,content) VALUES($1,$2,$3,$4) RETURNING *)
       SELECT i.*,${displayNameSql('u')} author_name,
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) author_avatar
       FROM inserted i JOIN users u ON u.id=i.user_id`,[req.params.id,req.userId,parentId,content])).rows[0]
    return res.status(201).json({comment})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.delete('/news/comments/:commentId',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const result=await pool.query('UPDATE news_comments SET is_deleted=true,content=\'[deleted]\' WHERE id=$1 AND user_id=$2 AND is_deleted=false RETURNING id',[req.params.commentId,req.userId])
    if(!result.rows[0])return res.status(404).json({error:'Comment not found or not owned by you',code:'COMMENT_NOT_FOUND'})
    return res.json({ok:true})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.get('/users/:id/comments',optionalAuth,async(req:AuthRequest,res)=>{
  try{
    const access=await canViewUserProfile(req.userId,req.params.id)
    if(!access.exists)return res.status(404).json({error:'User not found',code:'USER_NOT_FOUND'})
    if(!access.allowed)return res.status(403).json({error:'This profile is not visible to you',code:'PROFILE_PRIVATE'})
    const comments=await pool.query(
      `SELECT c.id,c.profile_user_id,c.author_user_id,c.content,c.created_at,c.updated_at,
              COALESCE(${displayNameSql('u')},'Deleted user') author_name,
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) author_avatar
       FROM profile_comments c LEFT JOIN users u ON u.id=c.author_user_id
       WHERE c.profile_user_id=$1 AND c.is_deleted=false ORDER BY c.created_at DESC,c.id DESC LIMIT 100`,[req.params.id])
    return res.json({comments:comments.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/users/:id/comments',requireAuth,async(req:AuthRequest,res)=>{
  const content=String(req.body.content||'').trim()
  if(!content||content.length>1000)return res.status(400).json({error:'Comment must contain 1 to 1000 characters',code:'INVALID_COMMENT'})
  try{
    const access=await canViewUserProfile(req.userId,req.params.id)
    if(!access.exists)return res.status(404).json({error:'User not found',code:'USER_NOT_FOUND'})
    if(!access.allowed)return res.status(403).json({error:'This profile is not visible to you',code:'PROFILE_PRIVATE'})
    const comment=(await pool.query(
      `WITH inserted AS (INSERT INTO profile_comments(profile_user_id,author_user_id,content) VALUES($1,$2,$3) RETURNING *)
       SELECT i.*,${displayNameSql('u')} author_name,
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) author_avatar
       FROM inserted i JOIN users u ON u.id=i.author_user_id`,[req.params.id,req.userId,content])).rows[0]
    return res.status(201).json({comment})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.delete('/profile-comments/:commentId',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const result=await pool.query(
      `UPDATE profile_comments SET is_deleted=true,content='[deleted]'
       WHERE id=$1 AND is_deleted=false AND (author_user_id=$2 OR profile_user_id=$2) RETURNING id`,[req.params.commentId,req.userId])
    if(!result.rows[0])return res.status(404).json({error:'Comment not found or cannot be removed',code:'COMMENT_NOT_FOUND'})
    return res.json({ok:true})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.get('/community/events',async(req,res)=>{
  const gameId=String(req.query.game_id||'').trim()
  if(gameId&&!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
  try{
    const events=await pool.query(
      `SELECT id,title,description,event_type,game_id,starts_at,ends_at
       FROM community_events WHERE is_published=true AND ends_at>NOW() AND ($1='' OR game_id IS NULL OR game_id=$1)
       ORDER BY starts_at,id LIMIT 50`,[gameId])
    return res.json({events:events.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.get('/community/activity',async(_req,res)=>{
  try{
    const activity=await pool.query(
      `SELECT * FROM (
         SELECT 'match'::text type,m.id::text id,m.completed_at occurred_at,m.game_id,
                CASE WHEN COALESCE(w.profile_visibility,'public')='public'
                     THEN COALESCE(${displayNameSql('w')},'A player') ELSE 'A player' END actor_name,
                'won a ranked match on '||COALESCE(m.selected_map,'an unselected map') detail
         FROM matches m LEFT JOIN users w ON w.id=m.winner_id WHERE m.status='completed' AND m.completed_at IS NOT NULL
         UNION ALL
         SELECT 'tournament_registration',tp.id::text,tp.registered_at,t.game_id,
                CASE WHEN COALESCE(u.profile_visibility,'public')='public'
                     THEN COALESCE(${displayNameSql('u')},'A player') ELSE 'A player' END,
                'registered for '||t.name
         FROM tournament_participants tp JOIN tournaments t ON t.id=tp.tournament_id LEFT JOIN users u ON u.id=tp.user_id
         UNION ALL
         SELECT 'profile_comment',c.id::text,c.created_at,NULL,
                CASE WHEN COALESCE(u.profile_visibility,'public')='public'
                     THEN COALESCE(${displayNameSql('u')},'A player') ELSE 'A player' END,
                'left a profile comment'
         FROM profile_comments c
         JOIN users profile_owner ON profile_owner.id=c.profile_user_id
         LEFT JOIN users u ON u.id=c.author_user_id
         WHERE c.is_deleted=false AND COALESCE(profile_owner.profile_visibility,'public')='public'
       ) activity ORDER BY occurred_at DESC,id DESC LIMIT 40`)
    return res.json({activity:activity.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

// =====================================================
// AUTH
// =====================================================

// POST /auth/signup
app.post('/auth/signup', async (req, res) => {
  try {
    const settings=await getPlatformSettings()
    if(settings.maintenance_mode)return res.status(503).json({error:'Platform registration is unavailable during maintenance',code:'MAINTENANCE_MODE'})
    if(!settings.registration_enabled)return res.status(403).json({error:'New account registration is currently disabled',code:'REGISTRATION_DISABLED'})
    const email = normalizedEmail(req.body?.email)
    const password = req.body?.password
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : ''
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'A valid email is required' })
    if (!validPassword(password)) return res.status(400).json({ error: 'Password must be between 8 and 128 characters' })
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, underscores, or hyphens' })
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email, username]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already taken' })
    }
    const password_hash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash,points) VALUES ($1,$2,$3,$4) RETURNING *`,
      [email, username, password_hash,settings.points_defaults.startingBalance]
    )
    const user = result.rows[0]
    const token = jwt.sign({ sub: user.id, email: user.email, av: Number(user.auth_version||0) }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.status(201).json({ user: toProfile(user), session: { access_token: token } })
  } catch (err: any) {
    return sendInternalError(res, err, 'signup_failed')
  }
})

// POST /auth/signin
app.post('/auth/signin', async (req, res) => {
  try {
    const email = normalizedEmail(req.body?.email)
    const password = req.body?.password
    if (!emailPattern.test(email) || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Valid email and password are required' })
    const result = await pool.query('SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL', [email])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    await pool.query(touchUserPresenceSql, [user.id])
    await pool.query(
      `INSERT INTO login_history(user_id,method,success,ip,user_agent) VALUES($1,'password',true,$2,$3)`,
      [user.id, req.ip || null, req.get('user-agent') || null]
    ).catch(() => undefined)
    const token = jwt.sign({ sub: user.id, email: user.email, av: Number(user.auth_version||0) }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.json({ user: toProfile(user), session: { access_token: token }, profile: toProfile(user) })
  } catch (err: any) {
    return sendInternalError(res, err, 'signin_failed')
  }
})

// POST /auth/reset-password
app.post('/auth/reset-password', async (req, res) => {
  try {
    const email = normalizedEmail(req.body?.email)
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'A valid email is required' })
    if(!passwordResetEnabled||!mailTransport||!smtpConfigured){
      return res.status(503).json({error:'Password reset email is not configured',code:'EMAIL_NOT_CONFIGURED'})
    }
    const user=(await pool.query('SELECT id,email FROM users WHERE email=$1 AND deleted_at IS NULL',[email])).rows[0]
    if(!user)return res.json({ message: 'If that email exists, a reset link was sent.' })
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash=crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + 3600 * 1000)
    await pool.query(
      'UPDATE users SET reset_token=NULL,reset_token_hash=$1,reset_token_expires=$2 WHERE id=$3',
      [tokenHash, expires, user.id]
    )
    try{
      const resetUrl=`${publicAppUrl}/new-password?token=${encodeURIComponent(token)}`
      await mailTransport.sendMail({
        from:process.env.SMTP_FROM,
        to:user.email,
        subject:'Reset your Sector Nine password',
        text:`A password reset was requested for your Sector Nine account. Open this link within one hour: ${resetUrl}\n\nIf you did not request this, ignore this message.`,
        html:`<p>A password reset was requested for your Sector Nine account.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request this, ignore this message.</p>`,
      })
    }catch(error){
      logEvent('error','password_reset_smtp_send_failed',safeSmtpErrorDetails(error))
      await pool.query('UPDATE users SET reset_token=NULL,reset_token_hash=NULL,reset_token_expires=NULL WHERE id=$1',[user.id])
      throw error
    }
    return res.json({ message: 'If that email exists, a reset link was sent.' })
  } catch (err: any) {
    return sendInternalError(res, err, 'password_reset_delivery_failed', 502, 'EMAIL_DELIVERY_FAILED')
  }
})

// POST /auth/update-password
app.post('/auth/update-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body
    if (typeof resetToken !== 'string' || resetToken.length !== 64 || !/^[a-f0-9]+$/.test(resetToken)) return res.status(400).json({ error: 'Invalid or expired reset token' })
    if (!validPassword(newPassword)) return res.status(400).json({ error: 'New password must be between 8 and 128 characters' })
    const resetTokenHash=crypto.createHash('sha256').update(resetToken).digest('hex')
    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token_hash=$1 AND reset_token_expires > NOW()',
      [resetTokenHash]
    )
    if (!result.rows[0]) return res.status(400).json({ error: 'Invalid or expired reset token' })
    const hash = await bcrypt.hash(newPassword, 12)
    await pool.query(
      'UPDATE users SET password_hash=$1, auth_version=auth_version+1, reset_token=NULL,reset_token_hash=NULL,reset_token_expires=NULL WHERE id=$2',
      [hash, result.rows[0].id]
    )
    return res.json({ message: 'Password updated successfully' })
  } catch (err: any) {
    return sendInternalError(res, err)
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
    await pool.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1,updated_at=NOW() WHERE id=$2', [passwordHash, req.userId])
    return res.json({ message: 'Password changed successfully' })
  } catch (err: any) {
    return sendInternalError(res, err, 'change_password_failed')
  }
})

// =====================================================
// USER / PROFILE
// =====================================================

// GET /user/profile
app.get('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(selectUserByIdSql, [req.userId])
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' })
    await pool.query(touchUserPresenceSql, [req.userId])
    logEvent('info','profile_identity_returned',{userId:result.rows[0].id,role:result.rows[0].role})
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    if (err?.code === '42703' && String(err.message).includes('notification_preferences')) {
      return res.status(503).json({
        error: 'Notification preferences are unavailable until database migration 008_notification_preferences_keys.sql is applied.',
        code: 'NOTIFICATION_PREFERENCES_MIGRATION_REQUIRED',
      })
    }
    return sendInternalError(res, err)
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
           points=CASE
             WHEN steam_verified=true AND NULLIF(BTRIM(steam_persona_name),'') IS NOT NULL THEN points
             WHEN display_name IS DISTINCT FROM $1 THEN points-1500
             ELSE points
           END,
           updated_at=NOW()
       WHERE id=$2
         AND (
           display_name IS NOT DISTINCT FROM $1
           OR steam_verified=true AND NULLIF(BTRIM(steam_persona_name),'') IS NOT NULL
           OR points >= 1500
         )
       RETURNING *`,
      [displayName, req.userId]
    )
    if (result.rows[0]) return res.json({ profile: toProfile(result.rows[0]) })

    const exists = await pool.query('SELECT id FROM users WHERE id=$1', [req.userId])
    if (!exists.rows[0]) return res.status(404).json({ error: 'User not found' })
    return res.status(400).json({ error: 'At least 1500 points are required to change display name', code: 'INSUFFICIENT_POINTS' })
  } catch (err: any) {
    return sendInternalError(res, err, 'display_name_change_failed')
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
      if (req.body.customAvatarUrl) req.body.avatarSource = 'custom'
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
      const keys = ['matchFound', 'friendRequests', 'tournaments', 'messages', 'social', 'systemMaintenance', 'securityAlerts']
      if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences) ||
          Object.keys(preferences).some((key) => !keys.includes(key)) ||
          keys.some((key) => typeof preferences[key] !== 'boolean')) {
        return res.status(400).json({ error: 'Invalid notification preferences' })
      }
    }
    if (req.body.themeMode !== undefined && !['manual', 'follow_game'].includes(req.body.themeMode)) {
      return res.status(400).json({ error: 'Invalid theme mode', code: 'INVALID_THEME_MODE' })
    }
    if (req.body.preferredTheme !== undefined) {
      const preferredTheme = req.body.preferredTheme
      if (!['default', 'hl1', 'cs16', 'l4d2', 'cod4'].includes(preferredTheme)) {
        return res.status(400).json({ error: 'Invalid preferred theme', code: 'INVALID_THEME' })
      }
      if (preferredTheme !== 'default') {
        const access = await pool.query(
          `SELECT steam_verified, owns_hl1, COALESCE(verified_game_ids, ARRAY[]::TEXT[]) AS verified_game_ids
             FROM users WHERE id=$1`,
          [req.userId],
        )
        if (!access.rows[0]) return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
        const allowed = preferredTheme === 'hl1'
          ? Boolean(access.rows[0].steam_verified && access.rows[0].owns_hl1) || access.rows[0].verified_game_ids.includes('hl1')
          : access.rows[0].verified_game_ids.includes(preferredTheme)
        if (!allowed) {
          return res.status(403).json({ error: 'Verify ownership of this game before using its theme.', code: 'THEME_LOCKED' })
        }
      }
    }
    if (req.body.preferredGameId !== undefined) {
      if (!isSupportedGameId(req.body.preferredGameId)) {
        return res.status(400).json({ error: 'Invalid preferred game', code: 'INVALID_GAME_ID' })
      }
      const result = await pool.query(
        'SELECT steam_id,steam_verified,owns_hl1,vac_banned,game_banned,verified_game_ids FROM users WHERE id=$1',
        [req.userId],
      )
      if (!result.rows[0]) return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
      const eligibility = gameEligibilityError(result.rows[0], req.body.preferredGameId)
      if (eligibility) return res.status(eligibility.status).json(eligibility)
      const activeCompetition=await pool.query(
        `SELECT 1 FROM queue_entries WHERE user_id=$1
         UNION ALL
         SELECT 1 FROM matches WHERE status IN ('pending','in_progress') AND (player1_id=$1 OR player2_id=$1)
         LIMIT 1`,
        [req.userId],
      )
      if(activeCompetition.rows[0])return res.status(409).json({error:'Leave the queue or finish the active match before changing games.',code:'GAME_CHANGE_BLOCKED'})
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
      theme_mode:          'themeMode',
      preferred_theme:     'preferredTheme',
      preferred_game_id:   'preferredGameId',
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
    if (err?.code === '42703' && (String(err.message).includes('theme_mode') || String(err.message).includes('preferred_theme') || String(err.message).includes('verified_game_ids') || String(err.message).includes('preferred_game_id'))) {
      return res.status(503).json({
        error: 'Theme preferences are unavailable until database migration 024_theme_preferences.sql is applied.',
        code: 'THEME_PREFERENCES_MIGRATION_REQUIRED',
      })
    }
    if (err?.code === '42703' && String(err.message).includes('notification_preferences')) {
      return res.status(503).json({
        error: 'Notification preferences are unavailable until database migration 008_notification_preferences_keys.sql is applied.',
        code: 'NOTIFICATION_PREFERENCES_MIGRATION_REQUIRED',
      })
    }
    return sendInternalError(res, err)
  }
})

// GET /user/stats
app.get('/user/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result = await pool.query(
      `SELECT u.username,gs.game_id,gs.rating,gs.points,gs.level,gs.experience,gs.wins,gs.losses,
              gs.win_streak,gs.best_win_streak,gs.kills AS total_kills,gs.deaths AS total_deaths,
              gs.matches_played,
              CASE WHEN gs.matches_played>0 THEN ROUND(gs.wins::numeric/gs.matches_played*100,2) ELSE 0 END win_rate
       FROM users u LEFT JOIN user_game_stats gs ON gs.user_id=u.id AND gs.game_id=$2
       WHERE u.id=$1`,
      [req.userId,gameId]
    )
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' })
    const lb = await pool.query('SELECT COUNT(*)::int+1 rank FROM user_game_stats WHERE game_id=$1 AND rating>(SELECT COALESCE(rating,0) FROM user_game_stats WHERE user_id=$2 AND game_id=$1)',[gameId,req.userId])
    return res.json({ stats: { ...result.rows[0], rank: lb.rows[0]?.rank || null } })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/user/rating-history',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result=await pool.query(
      `SELECT * FROM (
         SELECT rh.id,rh.match_id,rh.rating_before,rh.rating_after,rh.rating_delta,
                rh.rank_before,rh.rank_after,rh.created_at,m.selected_map,m.score_p1,m.score_p2
         FROM rating_history rh JOIN matches m ON m.id=rh.match_id
         WHERE rh.user_id=$1 AND rh.game_id=$2
         ORDER BY rh.created_at DESC,rh.id DESC LIMIT 50
       ) history ORDER BY created_at,id`,
      [req.userId,gameId],
    )
    return res.json({history:result.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

// GET /stats/platform — Hub page platform-wide numbers
app.get('/stats/platform', async (_req, res) => {
  try {
    const [users, matches, active, tournaments] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM matches WHERE status='completed'"),
      pool.query("SELECT COUNT(*) FROM matches WHERE status='in_progress'"),
      pool.query("SELECT COUNT(*) FROM tournaments WHERE game_id='hl1' AND status IN ('registration','in_progress')"),
    ])
    return res.json({
      totalPlayers:      parseInt(users.rows[0].count),
      totalMatches:      parseInt(matches.rows[0].count),
      activeMatches:     parseInt(active.rows[0].count),
      activeTournaments: parseInt(tournaments.rows[0].count),
    })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// =====================================================
// STORE & VIP
// =====================================================

app.get('/store/catalog', async (_req, res) => {
  try {
    const [products, frames] = await Promise.all([
      pool.query(
        `SELECT id,product_type,name,description,price_points,price_eur_cents,
                billing_period,vip_only,featured,metadata
         FROM store_products
         WHERE is_active=true
         ORDER BY featured DESC,created_at DESC,id`,
      ),
      pool.query(
        `SELECT id,name,description,style,rarity,price_points,vip_only,featured
         FROM frames
         WHERE is_active=true
         ORDER BY featured DESC,price_points ASC,id`,
      ),
    ])
    return res.json({ products: products.rows, frames: frames.rows })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.get('/store/purchases',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const result=await pool.query(
      `SELECT id,product_id,product_type,item_name,points_amount,euro_amount_cents,
              payment_method,status,metadata,created_at
       FROM store_transactions
       WHERE user_id=$1
       ORDER BY created_at DESC,id DESC
       LIMIT 50`,
      [req.userId],
    )
    return res.json({purchases:result.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/user/vip/purchase', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect()
  try {
    const productId=typeof req.body?.productId==='string'?req.body.productId.trim():''
    if(!productId){
      return res.status(400).json({error:'VIP product is required',code:'STORE_PRODUCT_REQUIRED'})
    }
    if(req.body?.method!==undefined&&req.body.method!=='points'){
      return res.status(400).json({error:'Online payment requires a verified payment provider callback',code:'PAYMENT_PROVIDER_REQUIRED'})
    }
    await db.query('BEGIN')
    const product=(await db.query(
      `SELECT id,name,price_points,billing_period FROM store_products
       WHERE id=$1 AND product_type='vip' AND is_active=true FOR SHARE`,
      [productId],
    )).rows[0]
    if(!product||product.price_points==null){
      await db.query('ROLLBACK')
      return res.status(404).json({error:'VIP product is unavailable',code:'STORE_PRODUCT_UNAVAILABLE'})
    }
    const result=await db.query(
      `UPDATE users
       SET is_premium=true,vip_since=NOW(),vip_method='points',points=points-$1,
           vip_expires_at=NOW()+CASE $2
             WHEN 'month' THEN INTERVAL '1 month'
             WHEN 'year' THEN INTERVAL '1 year'
             ELSE INTERVAL '1 month'
           END
       WHERE id=$3 AND deleted_at IS NULL
         AND (is_premium=false OR vip_expires_at<=NOW())
         AND points>=$1
       RETURNING *`,
      [product.price_points,product.billing_period,req.userId],
    )
    if(!result.rows[0]){
      const user=(await db.query('SELECT points,is_premium FROM users WHERE id=$1',[req.userId])).rows[0]
      await db.query('ROLLBACK')
      if(!user)return res.status(404).json({error:'User not found',code:'USER_NOT_FOUND'})
      if(user.is_premium)return res.status(409).json({error:'VIP is already active',code:'VIP_ALREADY_ACTIVE'})
      return res.status(400).json({error:`Insufficient points. Have ${user.points}, need ${product.price_points}`,code:'INSUFFICIENT_POINTS'})
    }
    await db.query(
      `INSERT INTO store_transactions(user_id,product_id,product_type,item_name,points_amount,payment_method,metadata)
       VALUES($1,$2,'vip',$3,$4,'points',jsonb_build_object('billingPeriod',$5::text))`,
      [req.userId,product.id,product.name,product.price_points,product.billing_period],
    )
    await db.query('COMMIT')
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    await db.query('ROLLBACK')
    return sendDatabaseError(res,err)
  } finally {
    db.release()
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
    return sendInternalError(res, err)
  }
})

// =====================================================
// BADGES & FRAMES
// =====================================================

app.get('/badges', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,name,description,icon,rarity,type,vip_only,featured,metadata,created_at
       FROM badges WHERE is_active=true ORDER BY featured DESC,name`,
    )
    return res.json({ badges: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/frames', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM frames WHERE is_active=true ORDER BY featured DESC,price_points ASC')
    return res.json({ frames: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.post('/user/badge/purchase', requireAuth, (_req, res) =>
  res.status(410).json({
    error:'Badges are achievements and cannot be purchased',
    code:'BADGES_NOT_PURCHASABLE',
  })
)

app.post('/user/frame/purchase', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect()
  try {
    const { frameId } = req.body
    if(typeof frameId!=='string'||!frameId)return res.status(400).json({error:'Invalid frame purchase'})
    await db.query('BEGIN')
    const frame=(await db.query('SELECT id,name,price_points,vip_only,is_active FROM frames WHERE id=$1 FOR SHARE',[frameId])).rows[0]
    if(!frame||!frame.is_active){await db.query('ROLLBACK');return res.status(404).json({error:'Frame is unavailable'})}
    const result = await db.query(
      `UPDATE users u SET points=u.points-f.price_points,owned_frames=array_append(COALESCE(u.owned_frames,'{}'::text[]),f.id)
       FROM frames f WHERE u.id=$1 AND f.id=$2 AND f.is_active=true AND (NOT f.vip_only OR u.is_premium=true)
       AND u.points>=f.price_points AND NOT(f.id=ANY(COALESCE(u.owned_frames,'{}'::text[]))) RETURNING u.*`,
      [req.userId,frameId]
    )
    if(!result.rows[0]){const u=(await db.query('SELECT points,owned_frames,is_premium FROM users WHERE id=$1',[req.userId])).rows[0];await db.query('ROLLBACK');if(!u)return res.status(404).json({error:'User not found'});if(u.owned_frames?.includes(frameId))return res.status(409).json({error:'Frame already owned'});if(frame.vip_only&&!u.is_premium)return res.status(403).json({error:'VIP status required'});return res.status(400).json({error:`Insufficient points. Have ${u.points}, need ${frame.price_points}`})}
    await db.query(
      `INSERT INTO store_transactions(user_id,product_id,product_type,item_name,points_amount,payment_method)
       VALUES($1,$2,'frame',$3,$4,'points')`,
      [req.userId,frame.id,frame.name,frame.price_points],
    )
    await db.query('COMMIT')
    return res.json({ profile: toProfile(result.rows[0]) })
  } catch (err: any) {
    await db.query('ROLLBACK')
    return sendDatabaseError(res,err)
  }finally{db.release()}
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
    return sendInternalError(res, err)
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
    return sendInternalError(res, err)
  }
})

app.get('/users/:userId/profile',optionalAuth,async(req:AuthRequest,res)=>{
  try{
    const access=await canViewUserProfile(req.userId,req.params.userId)
    if(!access.exists)return res.status(404).json({error:'Profile not found'})
    if(!access.allowed)return res.status(403).json({error:'This profile is not visible to you',code:'PROFILE_PRIVATE'})
    const result=await pool.query(
      `SELECT id,username,${displayNameSql('users')} AS display_name,bio,level,experience,wins,losses,total_kills,total_deaths,equipped_frame,
              is_premium,steam_verified,country_code,created_at,last_seen,(${onlineUserPredicate('users')}) AS is_online,
              COALESCE(CASE WHEN avatar_source='custom' THEN NULLIF(custom_avatar_url,'') END,steam_avatar) AS resolved_avatar
       FROM users WHERE id=$1 AND deleted_at IS NULL`,[req.params.userId])
    const u=result.rows[0]
    return res.json({profile:{id:u.id,username:u.username,displayName:u.display_name,bio:u.bio,level:u.level,experience:u.experience,wins:u.wins,losses:u.losses,totalKills:u.total_kills,totalDeaths:u.total_deaths,equippedFrame:u.equipped_frame,isPremium:u.is_premium,steamVerified:u.steam_verified,countryCode:u.country_code,createdAt:u.created_at,lastSeen:u.last_seen,isOnline:u.is_online,resolvedAvatar:u.resolved_avatar}})
  }catch(err:any){return sendDatabaseError(res,err)}
})

// =====================================================
// LEADERBOARD & MATCHES
// =====================================================

app.get('/leaderboard', async (req, res) => {
  try {
    const scope=req.query.scope==='seasonal'?'seasonal':'global'
    const search=String(req.query.search||'').trim().slice(0,80)
    const country=String(req.query.country||'').trim().toUpperCase()
    const game=String(req.query.game_id||req.query.game||'hl1').trim()
    const page=Math.max(1,Number.parseInt(String(req.query.page||'1'),10)||1)
    const pageSize=Math.min(50,Math.max(5,Number.parseInt(String(req.query.pageSize||'20'),10)||20))
    const offset=(page-1)*pageSize
    if(country&& !/^[A-Z]{2}$/.test(country))return res.status(400).json({error:'Invalid country filter',code:'INVALID_COUNTRY'})
    if(!isSupportedGameId(game))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})

    const [seasonsResult,gamesResult,countriesResult]=await Promise.all([
      pool.query("SELECT id,name,season_type,game_id,start_date,end_date,status FROM ladder_seasons ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,start_date DESC"),
      Promise.resolve({rows:supportedGameIds.map(game_id=>({game_id}))}),
      pool.query("SELECT DISTINCT country_code FROM users WHERE deleted_at IS NULL AND country_code IS NOT NULL ORDER BY country_code"),
    ])
    const seasons=seasonsResult.rows
    let selectedSeason:any=null
    let rows:any[]=[]
    if(scope==='seasonal'){
      const requestedSeason=String(req.query.season||'').trim()
      selectedSeason=requestedSeason?seasons.find(item=>item.id===requestedSeason):seasons.find(item=>item.status==='active'&&item.game_id===game)
      if(selectedSeason){
        const result=await pool.query(
          `WITH ranked AS (
             SELECT u.id,u.username,${displayNameSql('u')} AS display_name,u.steam_avatar,u.is_premium,u.level,u.experience,
                    le.wins,le.losses,le.win_streak,le.points AS score,
                    CASE WHEN le.wins+le.losses>0 THEN ROUND(le.wins::numeric/(le.wins+le.losses)*100,2) ELSE 0 END AS win_rate,
                    u.country_code,(${onlineUserPredicate('u')}) AS is_online,
                    COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS "resolvedAvatar",
                    u.equipped_frame AS "equippedFrame",
                    ROW_NUMBER() OVER(ORDER BY le.points DESC,le.wins DESC,u.username) AS rank
             FROM ladder_entries le JOIN users u ON u.id=le.user_id
             WHERE le.season_id=$1 AND u.deleted_at IS NULL
           ),filtered AS (
             SELECT * FROM ranked
             WHERE ($2='' OR username ILIKE '%'||$2||'%' OR COALESCE(display_name,'') ILIKE '%'||$2||'%')
               AND ($3='' OR country_code=$3)
           )
           SELECT *,COUNT(*) OVER()::int AS total_count FROM filtered ORDER BY rank LIMIT $4 OFFSET $5`,
          [selectedSeason.id,search,country,pageSize,offset]
        )
        rows=result.rows
      }
    }else{
      const result=await pool.query(
        `WITH ranked AS (
           SELECT u.id,u.username,${displayNameSql('u')} AS display_name,u.steam_avatar,u.is_premium,
                  gs.level,gs.experience,gs.wins,gs.losses,gs.win_streak,gs.best_win_streak,
                  CASE WHEN gs.matches_played>0 THEN ROUND(gs.wins::numeric/gs.matches_played*100,2) ELSE 0 END AS win_rate,
                  gs.rating AS score,u.country_code,(${onlineUserPredicate('u')}) AS is_online,
                  COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS "resolvedAvatar",
                  u.equipped_frame AS "equippedFrame",
                  rh.rank_before,
                  ROW_NUMBER() OVER(ORDER BY gs.rating DESC,gs.experience DESC,u.username) AS rank
           FROM user_game_stats gs JOIN users u ON u.id=gs.user_id
           LEFT JOIN LATERAL (
             SELECT rank_before FROM rating_history
             WHERE user_id=u.id AND game_id=gs.game_id
             ORDER BY created_at DESC,id DESC LIMIT 1
           ) rh ON TRUE
           WHERE gs.game_id=$3 AND gs.placement_complete=true AND u.deleted_at IS NULL
         ),filtered AS (
           SELECT * FROM ranked
           WHERE ($1='' OR username ILIKE '%'||$1||'%' OR COALESCE(display_name,'') ILIKE '%'||$1||'%')
             AND ($2='' OR country_code=$2)
         )
         SELECT *,COUNT(*) OVER()::int AS total_count FROM filtered ORDER BY rank LIMIT $4 OFFSET $5`,
        [search,country,game,pageSize,offset]
      )
      rows=result.rows
    }
    const total=Number(rows[0]?.total_count||0)
    return res.json({
      leaderboard:rows.map(({total_count,rank_before,...row})=>({...row,rank_movement:rank_before==null?null:Number(rank_before)-Number(row.rank)})),
      pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize)},
      filters:{games:gamesResult.rows.map(row=>row.game_id),countries:countriesResult.rows.map(row=>row.country_code),seasons},
      scope,season:selectedSeason,
      rankingMetric:scope==='seasonal'?'points':'experience',
    })
  } catch (err: any) {
    return sendDatabaseError(res,err)
  }
})

app.get('/matches/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result = await pool.query(
      `SELECT m.*,
        p1.username AS player1_username,${displayNameSql('p1')} AS player1_display_name,
        COALESCE(CASE WHEN p1.avatar_source='custom' THEN NULLIF(p1.custom_avatar_url,'') END,p1.steam_avatar) AS player1_avatar,
        p1.level AS player1_level,p1.equipped_frame AS player1_frame,
        p2.username AS player2_username,${displayNameSql('p2')} AS player2_display_name,
        COALESCE(CASE WHEN p2.avatar_source='custom' THEN NULLIF(p2.custom_avatar_url,'') END,p2.steam_avatar) AS player2_avatar,
        p2.level AS player2_level,p2.equipped_frame AS player2_frame,
        CASE WHEN m.winner_id=m.player1_id THEN m.player1_id WHEN m.winner_id=m.player2_id THEN m.player2_id END AS mvp_id,
        m.p1_rating_change,m.p2_rating_change,
        CASE WHEN m.completed_at IS NULL THEN NULL
             ELSE GREATEST(0,EXTRACT(EPOCH FROM (m.completed_at-COALESCE(m.started_at,m.created_at)))::int)
        END AS duration_seconds
       FROM matches m
       JOIN users p1 ON m.player1_id = p1.id
       JOIN users p2 ON m.player2_id = p2.id
       WHERE (m.player1_id=$1 OR m.player2_id=$1) AND m.status='completed' AND m.game_id=$2
        ORDER BY m.completed_at DESC NULLS LAST LIMIT 50`,
      [req.userId,gameId]
    )
    return res.json({ matches: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// GET /matches/active — public, used by ActiveMatches component on Hub
app.get('/matches/active', async (req, res) => {
  try {
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result = await pool.query(
      `SELECT m.id,m.match_type,m.status,m.selected_map,m.score_p1,m.score_p2,m.created_at,m.started_at,m.game_id,
              p1.username AS player1_username,${displayNameSql('p1')} AS player1_display_name,
              COALESCE(CASE WHEN p1.avatar_source='custom' THEN NULLIF(p1.custom_avatar_url,'') END,p1.steam_avatar) AS player1_avatar,
              p1.level AS player1_level,
              p2.username AS player2_username,${displayNameSql('p2')} AS player2_display_name,
              COALESCE(CASE WHEN p2.avatar_source='custom' THEN NULLIF(p2.custom_avatar_url,'') END,p2.steam_avatar) AS player2_avatar,
              p2.level AS player2_level
       FROM matches m
       JOIN users p1 ON p1.id=m.player1_id
       JOIN users p2 ON p2.id=m.player2_id
       WHERE m.status IN ('pending','in_progress') AND m.game_id=$1
       LIMIT 20`,
      [gameId],
    )
    return res.json({ matches: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// =====================================================
// MATCHMAKING
// =====================================================

// Queue, acceptance, match, and server assignment state are PostgreSQL-backed.
const getMatchmakingState=async(db:any,userId:string)=>{
  const queue=(await db.query('SELECT game_id,game_mode,selected_maps,preferred_region,joined_at FROM queue_entries WHERE user_id=$1',[userId])).rows[0]
  if(queue)return{state:'searching',queue}
  const match=(await db.query(
    `SELECT m.*,mine.status AS viewer_acceptance,counts.accepted_count,counts.pending_count,
            opponent.id AS opponent_id,opponent.username AS opponent_username,${displayNameSql('opponent')} AS opponent_display_name,
            gs.id AS assigned_server_id,gs.name AS server_name,gs.region AS server_region,
            gs.ip_address AS server_host,gs.port AS server_port
     FROM match_acceptances mine
     JOIN matches m ON m.id=mine.match_id
     JOIN users opponent ON opponent.id=CASE WHEN m.player1_id=$1 THEN m.player2_id ELSE m.player1_id END
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER(WHERE status='accepted')::int accepted_count,
              COUNT(*) FILTER(WHERE status='pending')::int pending_count
       FROM match_acceptances WHERE match_id=m.id
     ) counts ON TRUE
     LEFT JOIN game_servers gs ON gs.id=m.server_id
     WHERE mine.user_id=$1 AND m.status IN('pending','in_progress')
     ORDER BY m.created_at DESC LIMIT 1`,[userId])).rows[0]
  if(!match)return{state:'idle'}
  const selections=(await db.query('SELECT user_id,maps,confirmed_at FROM match_map_selections WHERE match_id=$1 ORDER BY confirmed_at',[match.id])).rows
  const bans=(await db.query('SELECT sequence,user_id,map_id,created_at FROM match_map_bans WHERE match_id=$1 ORDER BY sequence',[match.id])).rows
  const ownSelection=selections.find((selection:any)=>String(selection.user_id)===userId)
  const opponentSelection=selections.find((selection:any)=>String(selection.user_id)!==userId)
  const mapPool=(await db.query('SELECT maps FROM game_map_pools WHERE game_id=$1 AND game_mode=$2 AND is_active',[match.game_id,match.game_mode])).rows[0]?.maps||[]
  const remainingMaps=(match.maps||[]).filter((map:string)=>!bans.some((ban:any)=>ban.map_id===map))
  const state=match.server_id?'server_assigned':match.accepted_count<2?(match.accepted_count>0?'accepting':'found'):match.selected_map?'accepted':selections.length<2?'map_selecting':'map_banning'
  return{state,match,viewerAccepted:match.viewer_acceptance==='accepted',acceptedCount:match.accepted_count,totalPlayers:2,
    mapSelection:match.accepted_count===2?{requiredCount:5,availableMaps:mapPool,viewerMaps:ownSelection?.maps||[],viewerConfirmed:Boolean(ownSelection),opponentConfirmed:Boolean(opponentSelection),opponentSelectedCount:opponentSelection?.maps?.length||0,unavailableMaps:opponentSelection?.maps||[]}:null,
    mapBan:selections.length===2?{pool:match.maps||[],remainingMaps,bans,currentTurnUserId:match.map_ban_turn_user_id,isViewerTurn:String(match.map_ban_turn_user_id||'')===userId}:null,
    server:match.server_id?{id:match.assigned_server_id,name:match.server_name,region:match.server_region,host:match.server_host,port:match.server_port}:null}
}

const assignMatchmakingServer=async(db:any,matchId:string)=>{
  const match=(await db.query("SELECT id,game_id,server_id,status,matchmaking_region,selected_map FROM matches WHERE id=$1 FOR UPDATE",[matchId])).rows[0]
  if(!match||match.status!=='pending'||match.server_id||!match.selected_map)return
  if(!isSupportedRegionId(match.matchmaking_region))throw new Error('Match has no supported matchmaking region.')
  const accepted=Number((await db.query("SELECT COUNT(*)::int count FROM match_acceptances WHERE match_id=$1 AND status='accepted'",[matchId])).rows[0].count)
  if(accepted!==2)return
  const server=(await db.query(
    `SELECT id FROM game_servers
     WHERE game_id=$1 AND region=$2 AND status='online' AND current_match_id IS NULL
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED LIMIT 1`,[match.game_id,match.matchmaking_region])).rows[0]
  if(!server)throw new Error(noServerInSelectedRegionError)
  // Keep the match pending until RCON confirms that the selected map started.
  await db.query("UPDATE matches SET server_id=$1 WHERE id=$2",[server.id,matchId])
  await db.query("UPDATE game_servers SET current_match_id=$1,status='in_use',updated_at=NOW() WHERE id=$2",[matchId,server.id])
}

const pairQueuedPlayer=async(db:any,userId:string)=>{
  await db.query('SELECT pg_advisory_xact_lock($1)',[7392026])
  const own=(await db.query('SELECT * FROM queue_entries WHERE user_id=$1 FOR UPDATE',[userId])).rows[0]
  if(!own)return
  const opponent=(await db.query(
    `SELECT * FROM queue_entries WHERE user_id<>$1 AND game_id=$2 AND game_mode=$3
       AND preferred_region=$4
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks
         WHERE (blocker_id=$1 AND blocked_user_id=queue_entries.user_id)
            OR (blocker_id=queue_entries.user_id AND blocked_user_id=$1)
       )
     ORDER BY joined_at FOR UPDATE SKIP LOCKED LIMIT 1`,[userId,own.game_id,own.game_mode,own.preferred_region])).rows[0]
  if(!opponent)return
  const match=(await db.query(
    `INSERT INTO matches(match_type,game_mode,game_id,player1_id,player2_id,selected_map,maps,status,matchmaking_region)
     VALUES($1,$1,$2,$3,$4,NULL,ARRAY[]::TEXT[],'pending',$5) RETURNING *`,
    [own.game_mode,own.game_id,userId,opponent.user_id,own.preferred_region])).rows[0]
  await db.query("INSERT INTO match_acceptances(match_id,user_id) VALUES($1,$2),($1,$3)",[match.id,userId,opponent.user_id])
  await db.query('DELETE FROM queue_entries WHERE user_id=$1 OR user_id=$2',[userId,opponent.user_id])
  await db.query(
    `INSERT INTO notifications(user_id,type,title,message,related_match_id)
     VALUES($1,'match_found','Match Found!','Your match is waiting for acceptance.',$2),
           ($3,'match_found','Match Found!','Your match is waiting for acceptance.',$2)`,
    [userId,match.id,opponent.user_id])
}

app.post('/matchmaking/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const settings=await getPlatformSettings()
    if(settings.maintenance_mode)return res.status(503).json({error:'Matchmaking is unavailable during maintenance',code:'MAINTENANCE_MODE'})
    const userId = req.userId!
    const user=(await pool.query(
      `SELECT steam_id,steam_verified,owns_hl1,vac_banned,game_banned,verified_game_ids,preferred_game_id
       FROM users WHERE id=$1`,
      [userId],
    )).rows[0]
    if(!user)return res.status(404).json({error:'User not found',code:'USER_NOT_FOUND'})
    const gameId=req.body.gameId??req.body.game_id??user.preferred_game_id
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const eligibility=gameEligibilityError(user,gameId)
    if(eligibility)return res.status(eligibility.status).json(eligibility)
    const config=(await pool.query('SELECT * FROM game_matchmaking_config WHERE game_id=$1',[gameId])).rows[0]
    if(!config?.enabled)return res.status(409).json({error:'Matchmaking is not enabled for the selected game.',code:'GAME_MATCHMAKING_DISABLED'})
    const preferredRegion=req.body.preferredRegion??req.body.preferred_region
    if(!isSupportedRegionId(preferredRegion))return res.status(400).json({error:'Select a supported matchmaking region.',code:'INVALID_REGION'})
    const gameMode=typeof req.body.gameMode==='string'&&req.body.gameMode?req.body.gameMode:config.default_mode
    const poolRow=(await pool.query('SELECT maps FROM game_map_pools WHERE game_id=$1 AND game_mode=$2 AND is_active',[gameId,gameMode])).rows[0]
    const selectedMaps=Array.isArray(req.body.selectedMaps)&&req.body.selectedMaps.length?req.body.selectedMaps:poolRow?.maps||[]
    if(!config.modes.includes(gameMode)||!poolRow||selectedMaps.some((map:any)=>typeof map!=='string'||!poolRow.maps.includes(map))||selectedMaps.length!==config.required_map_count)
      return res.status(400).json({error:'Invalid matchmaking preferences for the selected game.',code:'INVALID_MATCHMAKING_PREFERENCES'})

    // Check if banned
    const banCheck = await pool.query(
      `SELECT * FROM bans
       WHERE user_id=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [userId]
    )
    if (banCheck.rows.length > 0) {
      const ban = banCheck.rows[0]
      return res.status(403).json({
        error: 'You are banned from matchmaking',
        ban: { reason: ban.reason, expiresAt: ban.expires_at, banLevel: ban.ban_level }
      })
    }

    const db=await pool.connect()
    try{
      await db.query('BEGIN')
      await db.query("DELETE FROM queue_entries WHERE joined_at<NOW()-($1||' minutes')::interval",[settings.matchmaking_defaults.queueTimeoutMinutes])
      const existing=await getMatchmakingState(db,userId)
      if(existing.state!=='idle'){await db.query('COMMIT');return res.json(existing)}
      await db.query(
        `INSERT INTO queue_entries(user_id,game_id,game_mode,selected_maps,preferred_region)
         VALUES($1,$2,$3,$4,$5)`,
        [userId,gameId,gameMode,selectedMaps,preferredRegion]
      )
      await pairQueuedPlayer(db,userId)
      await db.query('COMMIT')
      return res.json(await getMatchmakingState(pool,userId))
    }catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.post('/matchmaking/leave', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM queue_entries WHERE user_id=$1', [req.userId])
    return res.json({ state: 'idle' })
  } catch (err: any) {
    return sendDatabaseError(res,err)
  }
})

app.get('/matchmaking/status',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const settings=await getPlatformSettings()
    await pool.query("DELETE FROM queue_entries WHERE joined_at<NOW()-($1||' minutes')::interval",[settings.matchmaking_defaults.queueTimeoutMinutes])
    return res.json(await getMatchmakingState(pool,req.userId!))
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.get('/matchmaking/options',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const user=(await pool.query('SELECT preferred_game_id FROM users WHERE id=$1',[req.userId])).rows[0]
    const gameId=String(req.query.game_id||user?.preferred_game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const config=(await pool.query('SELECT * FROM game_matchmaking_config WHERE game_id=$1',[gameId])).rows[0]
    const mapPools=(await pool.query('SELECT game_mode,maps FROM game_map_pools WHERE game_id=$1 AND is_active ORDER BY game_mode',[gameId])).rows
    const regions=(await pool.query(
      `SELECT region,COUNT(*)::int total_servers,
              COUNT(*) FILTER(WHERE status='online' AND current_match_id IS NULL)::int available_servers
       FROM game_servers WHERE game_id=$1 AND region=ANY($2::text[]) GROUP BY region`,[gameId,SUPPORTED_REGIONS.map(region=>region.id)])).rows
    const regionStats=new Map(regions.map((region:any)=>[region.region,region]))
    const gameNames:Record<SupportedGameId,string>={hl1:'Half-Life 1',cs16:'Counter-Strike 1.6',l4d2:'Left 4 Dead 2',cod4:'Call of Duty 4 Promod'}
    return res.json({game:{id:gameId,name:gameNames[gameId]},enabled:Boolean(config?.enabled),modes:config?.modes||[],requiredMapCount:config?.required_map_count||5,mapPools,regions:SUPPORTED_REGIONS.map(region=>({region:region.id,label:region.label,total_servers:Number(regionStats.get(region.id)?.total_servers)||0,available_servers:Number(regionStats.get(region.id)?.available_servers)||0}))})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/matchmaking/sync',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const current=await getMatchmakingState(db,req.userId!)
    if(current.state==='searching')await pairQueuedPlayer(db,req.userId!)
    const paired=await getMatchmakingState(db,req.userId!)
    if(paired.match?.id)await assignMatchmakingServer(db,paired.match.id)
    await db.query('COMMIT')
    return res.json(await getMatchmakingState(pool,req.userId!))
  }catch(err:any){await db.query('ROLLBACK');return err?.message===noServerInSelectedRegionError?res.status(409).json({error:noServerInSelectedRegionError,code:'NO_SERVER_IN_SELECTED_REGION'}):sendDatabaseError(res,err)}finally{db.release()}
})

app.post('/matchmaking/accept',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const acceptance=(await db.query(
      `UPDATE match_acceptances ma SET status='accepted',responded_at=NOW()
       FROM matches m WHERE ma.match_id=m.id AND ma.user_id=$1 AND ma.status='pending'
         AND m.status='pending' RETURNING ma.match_id`,[req.userId])).rows[0]
    if(!acceptance){await db.query('ROLLBACK');return res.status(409).json({error:'No pending match acceptance',code:'NO_PENDING_MATCH'})}
    await db.query('COMMIT')
    return res.json(await getMatchmakingState(pool,req.userId!))
  }catch(err:any){await db.query('ROLLBACK');return err?.message===noServerInSelectedRegionError?res.status(409).json({error:noServerInSelectedRegionError,code:'NO_SERVER_IN_SELECTED_REGION'}):sendDatabaseError(res,err)}finally{db.release()}
})

app.post('/matchmaking/maps',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const match=(await db.query(
      `SELECT m.* FROM matches m
       JOIN match_acceptances ma ON ma.match_id=m.id
       WHERE ma.user_id=$1 AND ma.status='accepted' AND m.status='pending'
       ORDER BY m.created_at DESC LIMIT 1 FOR UPDATE OF m`,[req.userId])).rows[0]
    if(!match){await db.query('ROLLBACK');return res.status(409).json({error:'No accepted match is ready for map selection',code:'NO_MAP_SELECTION_MATCH'})}
    const accepted=Number((await db.query("SELECT COUNT(*)::int count FROM match_acceptances WHERE match_id=$1 AND status='accepted'",[match.id])).rows[0].count)
    if(accepted!==2){await db.query('ROLLBACK');return res.status(409).json({error:'Both players must accept before selecting maps',code:'MATCH_NOT_FULLY_ACCEPTED'})}
    if(match.selected_map||(Array.isArray(match.maps)&&match.maps.length===10)){await db.query('ROLLBACK');return res.status(409).json({error:'Map selection is already complete',code:'MAP_SELECTION_COMPLETE'})}
    const mapPool=(await db.query('SELECT maps FROM game_map_pools WHERE game_id=$1 AND game_mode=$2 AND is_active',[match.game_id,match.game_mode])).rows[0]?.maps||[]
    const maps=Array.isArray(req.body.selectedMaps)?req.body.selectedMaps:[]
    const uniqueMaps=[...new Set(maps)]
    if(uniqueMaps.length!==5||uniqueMaps.some((map:any)=>typeof map!=='string'||!mapPool.includes(map))){await db.query('ROLLBACK');return res.status(400).json({error:'Select exactly five unique maps from the active map pool',code:'INVALID_MAP_SELECTION'})}
    const opponent=(await db.query('SELECT maps FROM match_map_selections WHERE match_id=$1 AND user_id<>$2',[match.id,req.userId])).rows[0]
    const overlap=opponent?.maps?.filter((map:string)=>uniqueMaps.includes(map))||[]
    if(overlap.length){await db.query('ROLLBACK');return res.status(409).json({error:`These maps were already selected by your opponent: ${overlap.join(', ')}`,code:'MAP_SELECTION_OVERLAP',maps:overlap})}
    await db.query(
      `INSERT INTO match_map_selections(match_id,user_id,maps) VALUES($1,$2,$3)
       ON CONFLICT(match_id,user_id) DO UPDATE SET maps=EXCLUDED.maps,confirmed_at=NOW()`,
      [match.id,req.userId,uniqueMaps])
    const selections=(await db.query('SELECT user_id,maps FROM match_map_selections WHERE match_id=$1 ORDER BY confirmed_at',[match.id])).rows
    if(selections.length===2){
      const combined=[...selections[0].maps,...selections[1].maps]
      if(new Set(combined).size!==10){await db.query('ROLLBACK');return res.status(409).json({error:'Both selections must produce ten unique maps',code:'MAP_POOL_NOT_UNIQUE'})}
      await db.query('UPDATE matches SET maps=$1,map_ban_turn_user_id=player1_id WHERE id=$2',[combined,match.id])
    }
    await db.query('COMMIT')
    return res.json(await getMatchmakingState(pool,req.userId!))
  }catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}
})

app.post('/matchmaking/ban-map',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const match=(await db.query(
      `SELECT m.* FROM matches m
       JOIN match_acceptances ma ON ma.match_id=m.id
       WHERE ma.user_id=$1 AND ma.status='accepted' AND m.status='pending'
       ORDER BY m.created_at DESC LIMIT 1 FOR UPDATE OF m`,[req.userId])).rows[0]
    if(!match){await db.query('ROLLBACK');return res.status(409).json({error:'No accepted match is ready for map banning',code:'NO_MAP_BAN_MATCH'})}
    if(match.selected_map){await db.query('ROLLBACK');return res.status(409).json({error:'The final map is already selected',code:'MAP_BAN_COMPLETE'})}
    if(!Array.isArray(match.maps)||match.maps.length!==10){await db.query('ROLLBACK');return res.status(409).json({error:'Both players must confirm five maps first',code:'MAP_SELECTION_INCOMPLETE'})}
    if(String(match.map_ban_turn_user_id)!==req.userId){await db.query('ROLLBACK');return res.status(409).json({error:'Wait for your opponent to ban a map',code:'NOT_YOUR_BAN_TURN'})}
    const bans=(await db.query('SELECT sequence,map_id FROM match_map_bans WHERE match_id=$1 ORDER BY sequence FOR UPDATE',[match.id])).rows
    const remaining=match.maps.filter((map:string)=>!bans.some((ban:any)=>ban.map_id===map))
    const mapId=typeof req.body.mapId==='string'?req.body.mapId:''
    if(remaining.length<=1||!remaining.includes(mapId)){await db.query('ROLLBACK');return res.status(400).json({error:'Select an available map to ban',code:'INVALID_MAP_BAN'})}
    const sequence=bans.length+1
    await db.query('INSERT INTO match_map_bans(match_id,sequence,user_id,map_id) VALUES($1,$2,$3,$4)',[match.id,sequence,req.userId,mapId])
    const nextRemaining=remaining.filter((map:string)=>map!==mapId)
    if(nextRemaining.length===1){
      await db.query('UPDATE matches SET selected_map=$1,map_ban_turn_user_id=NULL WHERE id=$2',[nextRemaining[0],match.id])
      await assignMatchmakingServer(db,match.id)
    }else{
      const nextUser=String(match.player1_id)===req.userId?match.player2_id:match.player1_id
      await db.query('UPDATE matches SET map_ban_turn_user_id=$1 WHERE id=$2',[nextUser,match.id])
    }
    await db.query('COMMIT')
    if(nextRemaining.length===1)await provisionMatchServer(pool,match.id)
    return res.json(await getMatchmakingState(pool,req.userId!))
  }catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}
})

app.post('/matchmaking/decline',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const acceptance=(await db.query(
      `UPDATE match_acceptances ma SET status='declined',responded_at=NOW()
       FROM matches m WHERE ma.match_id=m.id AND ma.user_id=$1 AND ma.status='pending'
         AND m.status='pending' RETURNING ma.match_id`,[req.userId])).rows[0]
    if(!acceptance){await db.query('ROLLBACK');return res.status(409).json({error:'No pending match acceptance',code:'NO_PENDING_MATCH'})}
    await db.query("UPDATE matches SET status='cancelled',completed_at=NOW() WHERE id=$1",[acceptance.match_id])
    await db.query('COMMIT')
    return res.json({state:'idle'})
  }catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}
})

app.get('/match/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id=$1', [req.params.id])
    const match=result.rows[0]
    if (!match) return res.status(404).json({ error: 'Match not found' })
    if(req.userId!==match.player1_id&&req.userId!==match.player2_id)return res.status(403).json({error:'Only match participants may view match details'})
    return res.json({ match })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/match/:id/timeline',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const match=(await pool.query('SELECT player1_id,player2_id,demo_url,demo_uploaded_at FROM matches WHERE id=$1',[req.params.id])).rows[0]
    if(!match)return res.status(404).json({error:'Match not found'})
    if(req.userId!==match.player1_id&&req.userId!==match.player2_id)return res.status(403).json({error:'Only match participants may view the timeline'})
    const events=await pool.query(
      `SELECT e.*,COALESCE(${displayNameSql('a')},'A player') actor_name,COALESCE(${displayNameSql('t')},'A player') target_name
       FROM match_events e LEFT JOIN users a ON a.id=e.actor_user_id LEFT JOIN users t ON t.id=e.target_user_id
       WHERE e.match_id=$1 ORDER BY e.sequence`,[req.params.id])
    return res.json({events:events.rows,replay:match.demo_url?{url:match.demo_url,uploadedAt:match.demo_uploaded_at}:null})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/match/:id/result', requireAuth, async (req: AuthRequest, res) => {
  const db = await pool.connect()
  try {
    const { winnerId, stats } = req.body
    const matchId = req.params.id
    await db.query('BEGIN')
    const matchResult = await db.query('SELECT * FROM matches WHERE id=$1 FOR UPDATE', [matchId])
    const match = matchResult.rows[0]
    if (!match) {
      await db.query('ROLLBACK')
      return res.status(404).json({ error: 'Match not found' })
    }
    if (req.userId !== match.player1_id && req.userId !== match.player2_id) {
      await db.query('ROLLBACK')
      return res.status(403).json({ error: 'Only match participants may submit a result' })
    }
    if (match.status !== 'in_progress') {
      await db.query('ROLLBACK')
      return res.status(409).json({ error: 'Only an in-progress match can receive a result' })
    }
    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      await db.query('ROLLBACK')
      return res.status(400).json({ error: 'Winner must be a participant in this match' })
    }
    const statKeys = ['score_p1', 'score_p2', 'p1_kills', 'p1_deaths', 'p2_kills', 'p2_deaths']
    const normalizedStats: Record<string, number> = {}
    for (const key of statKeys) {
      const value = Number(stats?.[key] ?? 0)
      if (!Number.isInteger(value) || value < 0 || value > 100000) {
        await db.query('ROLLBACK')
        return res.status(400).json({ error: `Invalid match statistic: ${key}` })
      }
      normalizedStats[key] = value
    }

    const settings=await getPlatformSettings()
    const XP_WIN = settings.xp_defaults.win
    const XP_LOSS = settings.xp_defaults.loss
    const POINTS_WIN=settings.points_defaults.win
    const POINTS_LOSS=settings.points_defaults.loss
    const p1Won = winnerId === match.player1_id
    const p1RatingDelta=p1Won?25:-20
    const p2RatingDelta=p1Won?-20:25

    const rankState=async(playerId:string)=>{
      const row=(await db.query(
        `SELECT COALESCE(own.rating,1000)::int AS rating,(COUNT(other.user_id)+1)::int AS rank
         FROM (SELECT $1::uuid AS user_id,$2::text AS game_id) target
         LEFT JOIN user_game_stats own ON own.user_id=target.user_id AND own.game_id=target.game_id
         LEFT JOIN user_game_stats other ON other.game_id=target.game_id AND other.rating>COALESCE(own.rating,1000)
         GROUP BY own.rating`,
        [playerId,match.game_id],
      )).rows[0]
      return{rating:Number(row.rating),rank:Number(row.rank)}
    }
    const [p1Before,p2Before]=await Promise.all([rankState(match.player1_id),rankState(match.player2_id)])

    await db.query(
      `UPDATE matches SET status='completed', winner_id=$1, completed_at=NOW(),
       score_p1=$2, score_p2=$3, p1_xp_change=$4, p2_xp_change=$5,
       p1_rating_change=$6,p2_rating_change=$7,result_source='player' WHERE id=$8`,
      [winnerId, normalizedStats.score_p1, normalizedStats.score_p2,
       p1Won ? XP_WIN : XP_LOSS,
       p1Won ? XP_LOSS : XP_WIN,
       p1RatingDelta,p2RatingDelta,matchId]
    )

    // Competitive totals are isolated by game. Legacy users totals remain an HL1 compatibility mirror.
    const updatePlayer = async (isWinner: boolean, kills: number, deaths: number, playerId: string) => {
      const xp=isWinner ? XP_WIN : XP_LOSS
      const points=isWinner ? POINTS_WIN : POINTS_LOSS
      const ratingDelta=isWinner ? 25 : -20
      await db.query(
      `INSERT INTO user_game_stats(user_id,game_id,rating,points,experience,level,wins,losses,kills,deaths,matches_played,win_streak,best_win_streak,placement_matches_played,placement_complete)
         VALUES($1,$2,GREATEST(0,1000+$3::int),$4::int,$5::int,GREATEST(1,FLOOR(($5::int)::numeric/300)::int+1),$6::int,$7::int,$8::int,$9::int,1,$6::int,$6::int,1,FALSE)
         ON CONFLICT(user_id,game_id) DO UPDATE SET
           rating=GREATEST(0,user_game_stats.rating+$3::int),
           points=user_game_stats.points+$4::int,
           experience=user_game_stats.experience+$5::int,
           level=GREATEST(1,FLOOR((user_game_stats.experience+$5::int)::numeric/300)::int+1),
           wins=user_game_stats.wins+$6::int,
           losses=user_game_stats.losses+$7::int,
           kills=user_game_stats.kills+$8::int,
           deaths=user_game_stats.deaths+$9::int,
           matches_played=user_game_stats.matches_played+1,
           placement_matches_played=LEAST(5,user_game_stats.placement_matches_played+1),
           placement_complete=(user_game_stats.placement_matches_played+1)>=5,
           win_streak=CASE WHEN $6::int=1 THEN user_game_stats.win_streak+1 ELSE 0 END,
           best_win_streak=GREATEST(user_game_stats.best_win_streak,CASE WHEN $6::int=1 THEN user_game_stats.win_streak+1 ELSE user_game_stats.win_streak END),
           updated_at=NOW()`,
        [playerId,match.game_id,ratingDelta,points,xp,isWinner?1:0,isWinner?0:1,kills,deaths],
      )
      if(match.game_id==='hl1')await db.query(
        `UPDATE users SET
          wins = wins + $1,
          losses = losses + $2,
          win_streak = CASE WHEN $1=1 THEN win_streak+1 ELSE 0 END,
          best_win_streak = GREATEST(best_win_streak, CASE WHEN $1=1 THEN win_streak+1 ELSE win_streak END),
          experience = experience + $3,
          points = points + $4,
          total_kills = total_kills + $5,
          total_deaths = total_deaths + $6
         WHERE id=$7`,
        [isWinner ? 1 : 0,isWinner ? 0 : 1,xp,points,kills,deaths,playerId]
      )
    }

    await Promise.all([
      updatePlayer(p1Won, normalizedStats.p1_kills, normalizedStats.p1_deaths, match.player1_id),
      updatePlayer(!p1Won, normalizedStats.p2_kills, normalizedStats.p2_deaths, match.player2_id),
    ])

    const [p1After,p2After]=await Promise.all([rankState(match.player1_id),rankState(match.player2_id)])
    await db.query(
      `INSERT INTO rating_history(user_id,game_id,match_id,rating_before,rating_after,rating_delta,rank_before,rank_after)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8),($9,$2,$3,$10,$11,$12,$13,$14)`,
      [match.player1_id,match.game_id,matchId,p1Before.rating,p1After.rating,p1RatingDelta,p1Before.rank,p1After.rank,
       match.player2_id,p2Before.rating,p2After.rating,p2RatingDelta,p2Before.rank,p2After.rank],
    )
    await db.query(
      `INSERT INTO match_events(match_id,sequence,event_type,occurred_at,details)
       VALUES($1,1,'match_started',COALESCE($2,NOW()),jsonb_build_object('map',$3::text,'gameMode',$4::text)),
             ($1,2,'match_completed',NOW(),jsonb_build_object('winnerId',$5::uuid,'scoreP1',$6::int,'scoreP2',$7::int))
       ON CONFLICT(match_id,sequence) DO UPDATE SET event_type=EXCLUDED.event_type,occurred_at=EXCLUDED.occurred_at,details=EXCLUDED.details`,
      [matchId,match.started_at||match.created_at,match.selected_map,match.game_mode,winnerId,normalizedStats.score_p1,normalizedStats.score_p2],
    )
    await db.query(
      `UPDATE game_servers
       SET current_match_id=NULL,
           status=CASE WHEN status='in_use' THEN 'online' ELSE status END,
           updated_at=NOW()
       WHERE current_match_id=$1`,
      [matchId],
    )

    await db.query('COMMIT')
    return res.json({ ok: true })
  } catch (err: any) {
    await db.query('ROLLBACK')
    return sendInternalError(res, err)
  } finally {
    db.release()
  }
})

// =====================================================
// TOURNAMENTS
// =====================================================

app.get('/tournaments', async (req, res) => {
  try {
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result = await pool.query('SELECT * FROM tournaments WHERE game_id=$1 ORDER BY start_date ASC',[gameId])
    return res.json({ tournaments: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/tournaments/:id', async (req, res) => {
  try {
    const t = await pool.query('SELECT * FROM tournaments WHERE id=$1', [req.params.id])
    if (!t.rows[0]) return res.status(404).json({ error: 'Tournament not found' })
    const p = await pool.query(
      `SELECT tp.*, u.username, ${displayNameSql('u')} AS display_name, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium
       FROM tournament_participants tp JOIN users u ON tp.user_id=u.id
       WHERE tp.tournament_id=$1 ORDER BY tp.placement NULLS LAST, tp.wins DESC`,
      [req.params.id]
    )
    return res.json({ tournament: { ...t.rows[0], participants: p.rows } })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/tournament/:id/participants', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tp.*, u.username, ${displayNameSql('u')} AS display_name, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar, u.level, u.is_premium
       FROM tournament_participants tp JOIN users u ON tp.user_id=u.id
       WHERE tp.tournament_id=$1 ORDER BY tp.wins DESC`,
      [req.params.id]
    )
    return res.json({ participants: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.post('/tournament/:id/register', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect()
  try {
    const tid = req.params.id
    await db.query('BEGIN')
    const tResult=await db.query('SELECT * FROM tournaments WHERE id=$1 FOR UPDATE',[tid])
    const uResult=await db.query(selectUserByIdSql,[req.userId])
    const t = tResult.rows[0]
    const u = uResult.rows[0]
    if (!t){await db.query('ROLLBACK');return res.status(404).json({ error: 'Tournament not found' })}
    if (!u){await db.query('ROLLBACK');return res.status(404).json({ error: 'User not found' })}
    if(!isSupportedGameId(t.game_id)){await db.query('ROLLBACK');return res.status(409).json({error:'Tournament has an invalid game assignment',code:'INVALID_TOURNAMENT_GAME'})}
    const eligibility=gameEligibilityError(u,t.game_id)
    if(eligibility){await db.query('ROLLBACK');return res.status(eligibility.status).json(eligibility)}
    if(t.status!=='registration'||(t.registration_deadline&&new Date(t.registration_deadline).getTime()<=Date.now())){await db.query('ROLLBACK');return res.status(409).json({error:'Tournament registration is closed',code:'TOURNAMENT_REGISTRATION_CLOSED'})}
    if (t.requires_vip && !u.is_premium){await db.query('ROLLBACK');return res.status(403).json({ error: 'VIP status required' })}
    const current=Number((await db.query('SELECT COUNT(*)::int count FROM tournament_participants WHERE tournament_id=$1',[tid])).rows[0].count)
    if(current>=Number(t.max_participants)){await db.query('ROLLBACK');return res.status(409).json({ error: 'Tournament is full',code:'TOURNAMENT_FULL' })}
    const existing = await db.query(
      'SELECT id FROM tournament_participants WHERE tournament_id=$1 AND user_id=$2',
      [tid, req.userId]
    )
    if(existing.rows.length>0){await db.query('ROLLBACK');return res.status(409).json({ error: 'Already registered',code:'ALREADY_REGISTERED' })}
    const pResult = await db.query(
      'INSERT INTO tournament_participants (tournament_id, user_id) VALUES ($1,$2) RETURNING *',
      [tid, req.userId]
    )
    const updated=(await db.query('UPDATE tournaments SET current_participants=(SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=$1),updated_at=NOW() WHERE id=$1 RETURNING current_participants',[tid])).rows[0]
    await db.query('COMMIT')
    return res.status(201).json({ participant:pResult.rows[0],currentParticipants:updated.current_participants })
  } catch (err: any) {
    await db.query('ROLLBACK')
    return sendDatabaseError(res,err)
  }finally{db.release()}
})

app.delete('/tournament/:id/register',requireAuth,async(req:AuthRequest,res)=>{
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const tournament=(await db.query('SELECT id,status,registration_deadline FROM tournaments WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0]
    if(!tournament){await db.query('ROLLBACK');return res.status(404).json({error:'Tournament not found'})}
    if(tournament.status!=='registration'||(tournament.registration_deadline&&new Date(tournament.registration_deadline).getTime()<=Date.now())){await db.query('ROLLBACK');return res.status(409).json({error:'Registration changes are closed',code:'TOURNAMENT_REGISTRATION_CLOSED'})}
    const removed=(await db.query('DELETE FROM tournament_participants WHERE tournament_id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.userId])).rows[0]
    if(!removed){await db.query('ROLLBACK');return res.status(404).json({error:'Tournament registration not found'})}
    const updated=(await db.query('UPDATE tournaments SET current_participants=(SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=$1),updated_at=NOW() WHERE id=$1 RETURNING current_participants',[req.params.id])).rows[0]
    await db.query('COMMIT')
    return res.json({ok:true,currentParticipants:updated.current_participants})
  }catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}
})

// =====================================================
// LADDERS
// =====================================================

// GET /ladder/:season — ladder pages (Monthly, Winter, Spring, Summer, Autumn)
app.get('/ladder/seasons', async (req, res) => {
  try {
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    const result = await pool.query('SELECT * FROM ladder_seasons WHERE game_id=$1 ORDER BY start_date DESC',[gameId])
    return res.json({ seasons: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.get('/ladder/:season', async (req, res) => {
  try {
    const season = req.params.season
    const gameId=String(req.query.game_id||'hl1')
    if(!isSupportedGameId(gameId))return res.status(400).json({error:'Invalid game ID',code:'INVALID_GAME_ID'})
    // Try exact match first, then partial (e.g. 'monthly' matches 'monthly-2025-01')
    const seasonResult = await pool.query(
      `SELECT * FROM ladder_seasons
       WHERE game_id=$2 AND (id=$1 OR (season_type=$1 AND status='active'))
       ORDER BY start_date DESC LIMIT 1`,
      [season,gameId]
    )
    if (!seasonResult.rows[0]) {
      return res.json({ season: null, entries: [] })
    }
    const s = seasonResult.rows[0]
    const entries = await pool.query(
      `SELECT le.*, u.username, ${displayNameSql('u')} AS display_name, COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar,COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS "resolvedAvatar",u.equipped_frame AS "equippedFrame", u.level, u.is_premium,
              ROW_NUMBER() OVER (ORDER BY le.points DESC) as rank
       FROM ladder_entries le
       JOIN users u ON le.user_id = u.id
       WHERE le.season_id=$1
       ORDER BY le.points DESC LIMIT 100`,
      [s.id]
    )
    return res.json({ season: s, entries: entries.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// GET /ladder/seasons — all seasons list
// =====================================================
// CHAT
// =====================================================

const directChatAccess = async (senderId: string, recipientId: string) => {
  const relationship = await pool.query(
    `SELECT 1 FROM friendships
     WHERE status='accepted'
       AND ((user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1))
     LIMIT 1`,
    [senderId, recipientId]
  )
  return relationship.rowCount === 1
}

const directChatRecipientExists = async (recipientId: string) => {
  const result = await pool.query(
    'SELECT 1 FROM users WHERE id=$1 AND deleted_at IS NULL',
    [recipientId]
  )
  return result.rowCount === 1
}

app.get('/chat/unread', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT n.id AS notification_id, cm.id AS message_id,
              cm.user_id AS sender_id, cm.username AS sender_username,
              COALESCE(${displayNameSql('sender')}, cm.username) AS sender_name,
              cm.created_at
       FROM notifications n
       JOIN chat_messages cm ON cm.id=n.related_chat_message_id
       LEFT JOIN users sender ON sender.id=cm.user_id
       WHERE n.user_id=$1 AND n.type='message' AND n.read=false
       ORDER BY cm.created_at ASC, cm.id ASC`,
      [req.userId]
    )
    return res.json({ unread: result.rows, count: result.rowCount || 0 })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.get('/chat/:recipientId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const recipientId = req.params.recipientId
    if (!validUserId(recipientId)) return res.status(400).json({ error: 'Invalid conversation recipient' })
    if (recipientId === req.userId) return res.status(400).json({ error: 'A direct conversation requires another user' })
    if (!(await directChatRecipientExists(recipientId))) return res.status(404).json({ error: 'Conversation recipient not found' })
    if (!(await directChatAccess(req.userId!, recipientId))) return res.status(403).json({ error: 'An accepted friendship is required for this conversation' })
    const result = await pool.query(
      `SELECT * FROM (
         SELECT cm.*, COALESCE(${displayNameSql('sender')}, cm.username) AS username
         FROM chat_messages cm
         LEFT JOIN users sender ON sender.id=cm.user_id
         WHERE (cm.user_id=$1 AND cm.recipient_id=$2) OR (cm.user_id=$2 AND cm.recipient_id=$1)
         ORDER BY cm.created_at DESC, cm.id DESC
         LIMIT 50
       ) recent_messages
       ORDER BY created_at ASC, id ASC`,
      [req.userId, recipientId]
    )
    return res.json({ messages: result.rows })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.post('/chat/:recipientId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body
    const recipientId = req.params.recipientId
    if (!validUserId(recipientId)) return res.status(400).json({ error: 'Invalid conversation recipient' })
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty' })
    if (message.trim().length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer' })
    if (recipientId === req.userId) return res.status(400).json({ error: 'A direct conversation requires another user' })
    if (!(await directChatRecipientExists(recipientId))) return res.status(404).json({ error: 'Conversation recipient not found' })
    if (!(await directChatAccess(req.userId!, recipientId))) return res.status(403).json({ error: 'An accepted friendship is required to send a message' })
    const activeMute=await pool.query(
      `SELECT id FROM user_mutes
       WHERE user_id=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [req.userId],
    )
    if(activeMute.rows[0])return res.status(403).json({error:'Messaging is unavailable while your account is muted',code:'USER_MUTED'})
    const uResult = await pool.query(`SELECT username, ${displayNameSql('users')} AS display_name, is_premium FROM users WHERE id=$1`, [req.userId])
    const u = uResult.rows[0]
    if (!u) return res.status(404).json({ error: 'Sender not found' })
    const senderName = sanitizeDisplayName(u.display_name) || u.username
    const room = `dm:${[req.userId!, recipientId].sort().join(':')}`
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const result = await db.query(
        `INSERT INTO chat_messages (user_id, recipient_id, username, message, room, is_premium)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.userId, recipientId, senderName, message.trim(), room, u.is_premium || false]
      )
      await db.query(
        `INSERT INTO notifications
           (user_id,type,title,message,related_user_id,related_chat_message_id,related_conversation_id,read)
         VALUES ($1,'message','New secure message',$2,$3,$4,$5,false)
         ON CONFLICT (user_id,related_conversation_id)
           WHERE type='message' AND read=false AND related_conversation_id IS NOT NULL
         DO UPDATE SET
           message=EXCLUDED.message,
           related_user_id=EXCLUDED.related_user_id,
           related_chat_message_id=EXCLUDED.related_chat_message_id,
           created_at=NOW()`,
        [recipientId, `${senderName} sent you a message`, req.userId, result.rows[0].id, room]
      )
      await db.query('COMMIT')
      return res.json({ message: result.rows[0] })
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    } finally {
      db.release()
    }
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.put('/chat/:recipientId/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const recipientId = req.params.recipientId
    if (!validUserId(recipientId)) return res.status(400).json({ error: 'Invalid conversation recipient' })
    const result = await pool.query(
      `UPDATE notifications n SET read=true
       FROM chat_messages cm
       WHERE n.related_chat_message_id=cm.id
         AND n.user_id=$1
         AND n.type='message'
         AND n.read=false
         AND cm.user_id=$2
       RETURNING n.id`,
      [req.userId, recipientId]
    )
    const unread=await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read=false',[req.userId])
    return res.json({ ok: true, markedRead: result.rowCount || 0, unreadCount: unread.rows[0].count })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.delete('/chat/:room/:messageId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const deleted=await pool.query(
      'DELETE FROM chat_messages WHERE id=$1 AND user_id=$2',
      [req.params.messageId, req.userId]
    )
    if(!deleted.rowCount)return res.status(404).json({error:'Message not found',code:'CHAT_MESSAGE_NOT_FOUND'})
    return res.json({ ok: true })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// =====================================================
// FRIENDS
// =====================================================

app.get('/friends', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.status, f.created_at AS "addedAt", u.id AS "userId", u.username, ${displayNameSql('u')} AS "displayName",
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS steam_avatar,
              u.level, u.is_premium AS "isPremium", u.last_seen AS "lastSeen",
              (${onlineUserPredicate('u')}) AS "isOnline"
       FROM friendships f
       LEFT JOIN users u ON (CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END) = u.id
       WHERE (f.user_id=$1 OR f.friend_id=$1) AND f.status='accepted' AND u.id IS NOT NULL AND u.deleted_at IS NULL`,
      [req.userId]
    )
    const requests = await pool.query(
      `SELECT f.id,f.status,f.created_at AS "sentAt",f.user_id AS "senderId",f.friend_id AS "recipientId",
              u.username,${displayNameSql('u')} AS "displayName",COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS avatar
       FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END
       WHERE (f.user_id=$1 OR f.friend_id=$1) AND f.status='pending' AND u.deleted_at IS NULL
       ORDER BY f.created_at DESC`,[req.userId])
    return res.json({
      friends: result.rows,
      incomingRequests: requests.rows.filter(row=>row.recipientId===req.userId),
      outgoingRequests: requests.rows.filter(row=>row.senderId===req.userId),
    })
  } catch (err: any) {
    return sendDatabaseError(res,err)
  }
})

app.get('/friends/online', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id,u.username,${displayNameSql('u')} AS "displayName",
              COALESCE(CASE WHEN u.avatar_source='custom' THEN NULLIF(u.custom_avatar_url,'') END,u.steam_avatar) AS "resolvedAvatar",
              u.equipped_frame AS "equippedFrame",u.last_seen AS "lastSeen",TRUE AS "isOnline"
       FROM friendships f
       JOIN users u ON u.id=CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END
       WHERE (f.user_id=$1 OR f.friend_id=$1)
         AND f.status='accepted'
         AND u.id<>$1
         AND ${onlineUserPredicate('u')}
       ORDER BY u.username`,
      [req.userId]
    )
    return res.json({ onlineCount: result.rowCount || 0, friends: result.rows })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.post('/presence/heartbeat', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1 AND deleted_at IS NULL', [req.userId])
    return res.json({ ok: true })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.post('/presence/offline', requireAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query("UPDATE users SET last_seen=NOW()-INTERVAL '1 day' WHERE id=$1", [req.userId])
    return res.json({ ok: true })
  } catch (err: any) {
    return sendDatabaseError(res, err)
  }
})

app.get('/friends/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = req.query.q as string
    if (!q || q.length < 2) return res.json({ users: [] })
    const result = await pool.query(
      `SELECT id, username, ${displayNameSql('users')} AS "displayName", COALESCE(CASE WHEN avatar_source='custom' THEN NULLIF(custom_avatar_url,'') END,steam_avatar) AS steam_avatar, level, is_premium
       FROM users WHERE (username ILIKE $1 OR ${displayNameSql('users')} ILIKE $1) AND id != $2 AND deleted_at IS NULL LIMIT 20`,
      [`%${q}%`, req.userId]
    )
    return res.json({ users: result.rows })
  } catch (err: any) {
    return sendDatabaseError(res,err)
  }
})

app.post('/friends/request', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    const { targetUserId } = req.body
    if(targetUserId===req.userId){await db.query('ROLLBACK');return res.status(400).json({error:'You cannot send a friend request to yourself'})}
    const target=await db.query('SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL',[targetUserId])
    if(!target.rows[0]){await db.query('ROLLBACK');return res.status(404).json({error:'User not found'})}
    const existing=await db.query(`SELECT id,status FROM friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1) FOR UPDATE`,[req.userId,targetUserId])
    if(existing.rows[0]&&existing.rows[0].status!=='declined'){await db.query('ROLLBACK');return res.status(409).json({error:existing.rows[0].status==='accepted'?'You are already friends':'A friend request is already pending'})}
    const request=existing.rows[0]
      ?await db.query(`UPDATE friendships SET user_id=$1,friend_id=$2,status='pending',updated_at=NOW() WHERE id=$3 RETURNING *`,[req.userId,targetUserId,existing.rows[0].id])
      :await db.query(`INSERT INTO friendships(user_id,friend_id,status) VALUES($1,$2,'pending') RETURNING *`,[req.userId,targetUserId])
    const uResult = await db.query(`SELECT username,${displayNameSql('users')} AS display_name FROM users WHERE id=$1`, [req.userId])
    await db.query(
      `INSERT INTO notifications (user_id,type,title,message,related_user_id,related_friendship_id,read)
       VALUES ($1,'friend_request','Friend Request',$2,$3,$4,false)
       ON CONFLICT (related_friendship_id) WHERE related_friendship_id IS NOT NULL
       DO UPDATE SET user_id=EXCLUDED.user_id,message=EXCLUDED.message,related_user_id=EXCLUDED.related_user_id,read=false,created_at=NOW()`,
      [targetUserId, `${resolveDisplayName(uResult.rows[0])} sent you a friend request`, req.userId,request.rows[0].id]
    )
    await db.query('COMMIT')
    return res.status(201).json({ request:request.rows[0] })
  } catch (err: any) {
    await db.query('ROLLBACK');return sendDatabaseError(res,err)
  }finally{db.release()}
})

app.post('/friends/accept', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect();try {await db.query('BEGIN')
    const { requestId } = req.body
    const result=await db.query(
      `UPDATE friendships SET status='accepted',updated_at=NOW() WHERE id=$1 AND friend_id=$2 AND status='pending' RETURNING *`,
      [requestId, req.userId]
    )
    if(!result.rows[0]){await db.query('ROLLBACK');return res.status(404).json({error:'Pending request not found or not addressed to you'})}
    await db.query("DELETE FROM notifications WHERE user_id=$1 AND related_friendship_id=$2 AND type='friend_request'",[req.userId,requestId])
    const unread=await db.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read=false',[req.userId])
    await db.query('COMMIT')
    return res.json({ friendship:result.rows[0],unreadCount:unread.rows[0].count })
  } catch (err: any) {
    await db.query('ROLLBACK');return sendDatabaseError(res,err)
  }finally{db.release()}
})

app.post('/friends/requests/:requestId/decline',requireAuth,async(req:AuthRequest,res)=>{const db=await pool.connect();try{await db.query('BEGIN');const result=await db.query(`UPDATE friendships SET status='declined',updated_at=NOW() WHERE id=$1 AND friend_id=$2 AND status='pending' RETURNING *`,[req.params.requestId,req.userId]);if(!result.rows[0]){await db.query('ROLLBACK');return res.status(404).json({error:'Pending request not found or not addressed to you'})}await db.query("DELETE FROM notifications WHERE user_id=$1 AND related_friendship_id=$2 AND type='friend_request'",[req.userId,req.params.requestId]);const unread=await db.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read=false',[req.userId]);await db.query('COMMIT');return res.json({request:result.rows[0],unreadCount:unread.rows[0].count})}catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}})
app.delete('/friends/requests/:requestId',requireAuth,async(req:AuthRequest,res)=>{const db=await pool.connect();try{await db.query('BEGIN');const pending=await db.query(`SELECT id,friend_id FROM friendships WHERE id=$1 AND user_id=$2 AND status='pending' FOR UPDATE`,[req.params.requestId,req.userId]);if(!pending.rows[0]){await db.query('ROLLBACK');return res.status(404).json({error:'Outgoing request not found'})}await db.query("DELETE FROM notifications WHERE user_id=$1 AND related_friendship_id=$2 AND type='friend_request'",[pending.rows[0].friend_id,req.params.requestId]);await db.query(`DELETE FROM friendships WHERE id=$1 AND user_id=$2 AND status='pending'`,[req.params.requestId,req.userId]);await db.query('COMMIT');return res.json({ok:true})}catch(err:any){await db.query('ROLLBACK');return sendDatabaseError(res,err)}finally{db.release()}})
app.delete('/friends/:friendshipId',requireAuth,async(req:AuthRequest,res)=>{try{const result=await pool.query(`DELETE FROM friendships WHERE id=$1 AND status='accepted' AND (user_id=$2 OR friend_id=$2) RETURNING id`,[req.params.friendshipId,req.userId]);if(!result.rows[0])return res.status(404).json({error:'Accepted friendship not found'});return res.json({ok:true})}catch(err:any){return sendDatabaseError(res,err)}})

// =====================================================
// NOTIFICATIONS
// =====================================================

const getVisibleUnreadNotificationCount=async(db:any,userId:string)=>Number((await db.query(
  `SELECT COUNT(*)::int AS count
   FROM notifications n
   LEFT JOIN chat_messages cm ON cm.id=n.related_chat_message_id
   WHERE n.user_id=$1
     AND n.read=false
     AND (n.type<>'message' OR cm.id IS NOT NULL)
     AND (
       n.type<>'friend_request'
       OR EXISTS (
         SELECT 1 FROM friendships f
         WHERE f.id=n.related_friendship_id
           AND f.friend_id=n.user_id
           AND f.status='pending'
       )
     )`,[userId])).rows[0].count)

app.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [result,unread] = await Promise.all([pool.query(
      `SELECT
         n.id, n.user_id, n.type, n.title,
         CASE
           WHEN n.type='message' AND cm.id IS NOT NULL
             THEN COALESCE(${displayNameSql('sender')}, cm.username) || ' sent you a message'
           ELSE n.message
         END AS message,
         n.read, n.related_user_id, n.related_match_id,
         n.related_chat_message_id, n.related_friendship_id,
         n.related_conversation_id, n.created_at,
         COALESCE(${displayNameSql('sender')}, cm.username) AS sender_name
       FROM notifications n
       LEFT JOIN chat_messages cm ON cm.id=n.related_chat_message_id
       LEFT JOIN users sender ON sender.id=cm.user_id
       WHERE n.user_id=$1
         AND (n.type<>'message' OR cm.id IS NOT NULL)
         AND (
           n.type<>'friend_request'
           OR EXISTS (
             SELECT 1
             FROM friendships f
             WHERE f.id=n.related_friendship_id
               AND f.friend_id=n.user_id
               AND f.status='pending'
           )
         )
       ORDER BY n.created_at DESC
      LIMIT 50`,
      [req.userId]
    ),getVisibleUnreadNotificationCount(pool,req.userId!)])
    return res.json({ notifications: result.rows, unreadCount: unread })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.put('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result=await pool.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 AND read=false RETURNING id',
      [req.params.id, req.userId]
    )
    const unreadCount=await getVisibleUnreadNotificationCount(pool,req.userId!)
    return res.json({ ok: true, markedRead: result.rowCount||0, unreadCount })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

app.delete('/notifications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const deleted=await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.userId])
    if(!deleted.rows[0])return res.status(404).json({error:'Notification not found'})
    const unreadCount=await getVisibleUnreadNotificationCount(pool,req.userId!)
    return res.json({ok:true,unreadCount})
  } catch (err:any) {
    return sendInternalError(res, err)
  }
})

app.put('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  const db=await pool.connect()
  try {
    await db.query('BEGIN')
    const updated=await db.query('UPDATE notifications SET read=true WHERE user_id=$1 AND read=false RETURNING id', [req.userId])
    const unreadCount=await getVisibleUnreadNotificationCount(db,req.userId!)
    await db.query('COMMIT')
    return res.json({ ok: true, markedRead: updated.rowCount||0, unreadCount })
  } catch (err: any) {
    await db.query('ROLLBACK')
    return sendInternalError(res, err)
  } finally {
    db.release()
  }
})

app.delete('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const deleted=await pool.query('DELETE FROM notifications WHERE user_id=$1 RETURNING id',[req.userId])
    return res.json({ok:true,deleted:deleted.rowCount||0,unreadCount:0})
  } catch (err:any) {
    return sendInternalError(res, err)
  }
})

// =====================================================
// SUPPORT
// =====================================================

app.get('/support/tickets',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const tickets=await pool.query(
      `SELECT id,category,priority,subject,description,status,admin_response,resolved_at,created_at,updated_at
       FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,
      [req.userId],
    )
    return res.json({tickets:tickets.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/support/tickets',requireAuth,async(req:AuthRequest,res)=>{
  const category=typeof req.body?.category==='string'?req.body.category.trim():''
  const priority=typeof req.body?.priority==='string'?req.body.priority.trim():''
  const subject=typeof req.body?.subject==='string'?req.body.subject.trim():''
  const description=typeof req.body?.description==='string'?req.body.description.trim():''
  if(!['technical','account','billing','gameplay','report'].includes(category))return res.status(400).json({error:'Select a valid support category',code:'INVALID_SUPPORT_CATEGORY'})
  if(!['low','medium','high','critical'].includes(priority))return res.status(400).json({error:'Select a valid priority',code:'INVALID_SUPPORT_PRIORITY'})
  if(subject.length<3||subject.length>160)return res.status(400).json({error:'Subject must contain 3 to 160 characters',code:'INVALID_SUPPORT_SUBJECT'})
  if(description.length<10||description.length>5000)return res.status(400).json({error:'Description must contain 10 to 5000 characters',code:'INVALID_SUPPORT_DESCRIPTION'})
  try{
    const ticket=(await pool.query(
      `INSERT INTO support_tickets(user_id,category,priority,subject,description)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,category,priority,subject,description,status,admin_response,resolved_at,created_at,updated_at`,
      [req.userId,category,priority,subject,description],
    )).rows[0]
    return res.status(201).json({ticket})
  }catch(err:any){return sendDatabaseError(res,err)}
})

// =====================================================
// REPORTS & BANS
// =====================================================

app.get('/blocks',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const result=await pool.query(
      `SELECT b.blocked_user_id AS player_id,${displayNameSql('u')} AS player_name,b.created_at AS blocked_at
       FROM user_blocks b JOIN users u ON u.id=b.blocked_user_id
       WHERE b.blocker_id=$1 AND u.deleted_at IS NULL ORDER BY b.created_at DESC`,
      [req.userId],
    )
    return res.json({blockedPlayers:result.rows})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/blocks',requireAuth,async(req:AuthRequest,res)=>{
  const blockedUserId=typeof req.body?.blockedUserId==='string'?req.body.blockedUserId:''
  if(!validUserId(blockedUserId)||blockedUserId===req.userId)return res.status(400).json({error:'Select another valid user to block',code:'INVALID_BLOCK_TARGET'})
  try{
    const blocked=(await pool.query(
      `INSERT INTO user_blocks(blocker_id,blocked_user_id)
       SELECT $1,u.id FROM users u WHERE u.id=$2 AND u.deleted_at IS NULL
       ON CONFLICT(blocker_id,blocked_user_id) DO UPDATE SET blocker_id=EXCLUDED.blocker_id
       RETURNING blocked_user_id AS player_id,created_at AS blocked_at`,
      [req.userId,blockedUserId],
    )).rows[0]
    if(!blocked)return res.status(404).json({error:'User not found',code:'USER_NOT_FOUND'})
    const user=(await pool.query(`SELECT ${displayNameSql('users')} AS player_name FROM users WHERE id=$1`,[blockedUserId])).rows[0]
    return res.status(201).json({blockedPlayer:{...blocked,...user}})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.delete('/blocks/:userId',requireAuth,async(req:AuthRequest,res)=>{
  if(!validUserId(req.params.userId))return res.status(400).json({error:'Invalid blocked user ID',code:'INVALID_BLOCK_TARGET'})
  try{
    const removed=await pool.query('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_user_id=$2 RETURNING blocked_user_id',[req.userId,req.params.userId])
    if(!removed.rows[0])return res.status(404).json({error:'Blocked user was not found',code:'BLOCK_NOT_FOUND'})
    return res.json({ok:true})
  }catch(err:any){return sendDatabaseError(res,err)}
})

app.post('/report', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reportedUserId = typeof req.body?.reportedUserId === 'string' ? req.body.reportedUserId : ''
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : ''
    if (!reportedUserId || reportedUserId === req.userId) return res.status(400).json({ error: 'Select another user to report' })
    if (!reason || reason.length > 100) return res.status(400).json({ error: 'Reason must contain 1-100 characters' })
    if (!description || description.length > 2000) return res.status(400).json({ error: 'Description must contain 1-2000 characters' })
    const target = await pool.query('SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL', [reportedUserId])
    if (!target.rows[0]) return res.status(404).json({ error: 'Reported user not found' })
    await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, description) VALUES ($1,$2,$3,$4)`,
      [req.userId, reportedUserId, reason, description]
    )
    return res.status(201).json({ ok: true })
  } catch (err: any) {
    return sendInternalError(res, err)
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
      `SELECT * FROM bans
       WHERE user_id=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    )
    return res.json({ ban: result.rows[0] || null, isBanned: result.rows.length > 0 })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// POST /ban — issue a ban (called when player declines match ready)
app.post('/ban', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, reason } = req.body
    // This public endpoint is a self-penalty used by match-ready decline.
    // Targeting other accounts is reserved for role-gated /admin/bans.
    if (userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Cannot ban another user', code: 'ADMIN_REQUIRED' })
    }
    const targetId = req.userId

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
    return res.status(201).json({ ok: true, banLevel, durationMinutes, expiresAt })
  } catch (err: any) {
    return sendInternalError(res, err)
  }
})

// =====================================================
// STEAM
// =====================================================

const STEAM_CACHE_HOURS = 24

type SteamCheckResult = {
  steamId: string
  personaName: string | null
  steamAvatar: string | null
  steamProfileUrl: string | null
  countryCode: string | null
  steamLevel: number | null
  visibility: number | null
  gamesVisible: boolean
  ownedGames: Array<{
    appId: number
    name: string
    playtimeMinutes: number
    lastPlayedAt: string | null
    iconUrl: string | null
  }>
  vacBanCount: number
  gameBanCount: number
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

  const [profileData, gamesData, banData, levelData] = await Promise.all([
    fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodedKey}&steamids=${encodedSteamId}`
    ),
    fetchSteamJson(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodedKey}&steamid=${encodedSteamId}&include_appinfo=1&include_played_free_games=1`
    ),
    fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${encodedKey}&steamids=${encodedSteamId}`
    ),
    fetchSteamJson(
      `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${encodedKey}&steamid=${encodedSteamId}`
    ),
  ])

  const player = profileData.response?.players?.[0]
  if (!player) {
    throw new Error('Steam profile not found or is unavailable')
  }

  const games = Array.isArray(gamesData.response?.games) ? gamesData.response.games : []
  const playerBan = banData.players?.[0]
  const vacBanCount = Math.max(0, Number(playerBan?.NumberOfVACBans || 0))
  const gameBanCount = Math.max(0, Number(playerBan?.NumberOfGameBans || 0))

  return {
    steamId,
    personaName: typeof player.personaname === 'string' ? player.personaname : null,
    steamAvatar: player.avatarfull || null,
    steamProfileUrl: player.profileurl || null,
    countryCode: typeof player.loccountrycode==='string'&&/^[A-Za-z]{2}$/.test(player.loccountrycode)?player.loccountrycode.toUpperCase():null,
    steamLevel: Number.isFinite(Number(levelData.response?.player_level))
      ? Math.max(0, Number(levelData.response.player_level))
      : null,
    visibility: Number.isFinite(Number(player.communityvisibilitystate))
      ? Number(player.communityvisibilitystate)
      : null,
    gamesVisible: Number.isFinite(Number(gamesData.response?.game_count)),
    ownedGames: games.map((game: any) => ({
      appId: Number(game.appid),
      name: typeof game.name === 'string' ? game.name : `Steam app ${game.appid}`,
      playtimeMinutes: Math.max(0, Number(game.playtime_forever || 0)),
      lastPlayedAt: Number(game.rtime_last_played || 0) > 0
        ? new Date(Number(game.rtime_last_played) * 1000).toISOString()
        : null,
      iconUrl: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : null,
    })),
    vacBanCount,
    gameBanCount,
    ownsHL1: games.some((game: any) => Number(game.appid) === 70),
    hasVacBan: Boolean(playerBan?.VACBanned) || vacBanCount > 0,
    hasGameBan: gameBanCount > 0,
    lastSteamCheck: new Date(),
  }
}

const saveSteamData = async (userId: string, steam: SteamCheckResult) => {
  // steam_verified means eligible for Sector Nine matchmaking:
  // valid profile + owns HL1 + no VAC or game ban.
  const steamVerified =
    steam.visibility === 3 &&
    steam.gamesVisible &&
    steam.ownsHL1 &&
    !steam.hasVacBan &&
    !steam.hasGameBan
  const supportedSteamGames: Record<number, string> = { 70: 'hl1', 10: 'cs16', 550: 'l4d2', 7940: 'cod4' }
  const verifiedGameIds = steam.visibility === 3 && steam.gamesVisible && !steam.hasVacBan && !steam.hasGameBan
    ? steam.ownedGames
      .map(game => supportedSteamGames[Number(game.appId)])
      .filter((gameId): gameId is string => Boolean(gameId))
    : []

  const result = await pool.query(
    `UPDATE users SET
       steam_id=$1,
       steam_avatar=$2,
       steam_profile_url=$3,
       country_code=$4,
       steam_verified=$5,
       owns_hl1=$6,
       vac_banned=$7,
       game_banned=$8,
       last_steam_check=$9,
       steam_persona_name=$10,
       steam_level=$11,
       steam_visibility=$12,
       steam_vac_ban_count=$13,
       steam_game_ban_count=$14,
       steam_owned_games=$15::jsonb,
       steam_games_visible=$16,
       verified_game_ids=$17
     WHERE id=$18
     RETURNING *`,
    [
      steam.steamId,
      steam.steamAvatar,
      steam.steamProfileUrl,
      steam.countryCode,
      steamVerified,
      steam.ownsHL1,
      steam.hasVacBan,
      steam.hasGameBan,
      steam.lastSteamCheck,
      steam.personaName,
      steam.steamLevel,
      steam.visibility,
      steam.vacBanCount,
      steam.gameBanCount,
      JSON.stringify(steam.ownedGames),
      steam.gamesVisible,
      verifiedGameIds,
      userId,
    ]
  )

  return result.rows[0]
}

const steamResultFromUser = (user: any): SteamCheckResult => ({
  steamId: user.steam_id,
  personaName: user.steam_persona_name || null,
  steamAvatar: user.steam_avatar || null,
  steamProfileUrl: user.steam_profile_url || null,
  countryCode: user.country_code || null,
  steamLevel: user.steam_level == null ? null : Number(user.steam_level),
  visibility: user.steam_visibility == null ? null : Number(user.steam_visibility),
  gamesVisible: Boolean(user.steam_games_visible),
  ownedGames: Array.isArray(user.steam_owned_games) ? user.steam_owned_games : [],
  vacBanCount: Math.max(0, Number(user.steam_vac_ban_count || 0)),
  gameBanCount: Math.max(0, Number(user.steam_game_ban_count || 0)),
  ownsHL1: Boolean(user.owns_hl1),
  hasVacBan: Boolean(user.vac_banned),
  hasGameBan: Boolean(user.game_banned),
  lastSteamCheck: new Date(user.last_steam_check),
})

const toSteamStatus = (user: any) => {
  if (!user?.steam_id) return { linked: false }
  const steam = steamResultFromUser(user)
  const profileVisibility =
    steam.visibility === 3 ? 'public' : steam.visibility === 1 ? 'private' : 'unknown'
  let code = 'VERIFIED'
  let message = 'Steam account is verified for competitive play.'
  if (profileVisibility !== 'public') {
    code = 'STEAM_PROFILE_PRIVATE'
    message = 'Your Steam profile and game details must be public so ownership can be verified.'
  } else if (!steam.gamesVisible) {
    code = 'STEAM_GAMES_PRIVATE'
    message = 'Steam game details are private, so Half-Life ownership cannot be verified.'
  } else if (!steam.ownsHL1) {
    code = 'HL1_NOT_OWNED'
    message = 'Half-Life is not present in the public Steam library for this account.'
  } else if (steam.hasVacBan) {
    code = 'VAC_BANNED'
    message = 'This Steam account has a VAC ban and is not eligible for competitive play.'
  } else if (steam.hasGameBan) {
    code = 'GAME_BANNED'
    message = 'This Steam account has a game ban and is not eligible for competitive play.'
  }

  return {
    linked: true,
    steamId: steam.steamId,
    personaName: steam.personaName,
    avatar: steam.steamAvatar,
    profileUrl: steam.steamProfileUrl,
    countryCode: steam.countryCode,
    level: steam.steamLevel,
    profileVisibility,
    gamesVisible: steam.gamesVisible,
    vac: { banned: steam.hasVacBan, count: steam.vacBanCount },
    gameBans: { banned: steam.hasGameBan, count: steam.gameBanCount },
    ownedGames: steam.ownedGames,
    ownsHL1: steam.ownsHL1,
    verified: Boolean(user.steam_verified),
    lastRefreshedAt: user.last_steam_check || null,
    verification: { code, message },
  }
}

type SteamAuthIntent = 'login' | 'link'

type SteamProfileSummary = {
  personaName: string | null
  steamAvatar: string | null
  steamProfileUrl: string | null
  countryCode: string | null
  visibility: number | null
}

const parseSteamAuthIntent = (value: unknown): SteamAuthIntent | null => {
  if (value === 'login' || value === 'link') return value
  return null
}

const fallbackSteamProfileSummary = (steamId: string): SteamProfileSummary => ({
  personaName: null,
  steamAvatar: null,
  steamProfileUrl: `https://steamcommunity.com/profiles/${steamId}`,
  countryCode: null,
  visibility: null,
})

const fetchSteamProfileSummary = async (steamId: string): Promise<SteamProfileSummary> => {
  const apiKey = process.env.STEAM_API_KEY
  if (!apiKey) return fallbackSteamProfileSummary(steamId)
  const data = await fetchSteamJson(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`
  )
  const player = data.response?.players?.[0]
  if (!player) return fallbackSteamProfileSummary(steamId)
  return {
    personaName: typeof player.personaname === 'string' ? player.personaname : null,
    steamAvatar: player.avatarfull || null,
    steamProfileUrl: player.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
    countryCode: typeof player.loccountrycode === 'string' && /^[A-Za-z]{2}$/.test(player.loccountrycode)
      ? player.loccountrycode.toUpperCase()
      : null,
    visibility: Number.isFinite(Number(player.communityvisibilitystate))
      ? Number(player.communityvisibilitystate)
      : null,
  }
}

const safeFetchSteamProfileSummary = async (steamId: string): Promise<SteamProfileSummary> => {
  try {
    return await fetchSteamProfileSummary(steamId)
  } catch (error: any) {
    logEvent('warn', 'steam_profile_summary_fetch_failed', {
      steamId,
      message: error?.message || 'Steam profile summary unavailable',
    })
    return fallbackSteamProfileSummary(steamId)
  }
}

const saveSteamProfileSummary = async (userId: string, steamId: string, summary: SteamProfileSummary) => {
  const result = await pool.query(
    `UPDATE users SET
       steam_id=$1,
       steam_avatar=COALESCE($2,steam_avatar),
       steam_profile_url=COALESCE($3,steam_profile_url),
       country_code=COALESCE($4,country_code),
       steam_verified=true,
       steam_persona_name=COALESCE($5,steam_persona_name),
       steam_visibility=COALESCE($6,steam_visibility),
       updated_at=NOW()
     WHERE id=$7
     RETURNING *`,
    [
      steamId,
      summary.steamAvatar,
      summary.steamProfileUrl,
      summary.countryCode,
      summary.personaName,
      summary.visibility,
      userId,
    ],
  )
  return result.rows[0]
}

const steamUsernameBase = (personaName: string | null) => {
  const normalized = String(personaName || 'Player')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = normalized || 'Player'
  const trimmed = base.slice(0, 32).replace(/[_-]+$/g, '') || 'Player'
  return trimmed.length >= 3 ? trimmed : `${trimmed}___`.slice(0, 3)
}

const uniqueSteamUsername = async (personaName: string | null) => {
  const base = steamUsernameBase(personaName).slice(0, 30)
  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? '' : `_${index + 1}`
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`
    const existing = await pool.query('SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1', [candidate])
    if (!existing.rows[0]) return candidate
  }
  return `Player_${crypto.randomBytes(4).toString('hex')}`
}

const createSteamUser = async (steamId: string, summary: SteamProfileSummary) => {
  const settings = await getPlatformSettings()
  if (settings.maintenance_mode) {
    const error = new Error('MAINTENANCE_MODE')
    throw error
  }
  if (!settings.registration_enabled) {
    const error = new Error('REGISTRATION_DISABLED')
    throw error
  }
  const username = await uniqueSteamUsername(summary.personaName)
  const result = await pool.query(
    `INSERT INTO users (
       email,username,password_hash,display_name,points,role,auth_provider,
       steam_id,steam_verified,steam_avatar,steam_profile_url,country_code,
       steam_persona_name,steam_visibility
     )
     VALUES (NULL,$1,NULL,$2,$3,'user','steam',$4,true,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      username,
      summary.personaName || username,
      settings.points_defaults.startingBalance,
      steamId,
      summary.steamAvatar,
      summary.steamProfileUrl,
      summary.countryCode,
      summary.personaName,
      summary.visibility,
    ],
  )
  return result.rows[0]
}

const issueAuthSession = async (user: any, method: 'password' | 'steam', req: Request) => {
  const activeUser = (await pool.query('SELECT * FROM users WHERE id=$1', [user.id])).rows[0]
  const rejectionReason = authSessionRejection(
    { sub: user.id, av: Number(user.auth_version || 0) },
    activeUser,
  )
  if (rejectionReason) {
    logEvent('warn', 'auth_session_issuance_rejected', { reason: rejectionReason, userId: user.id, method })
    throw new Error('ACCOUNT_NOT_ACTIVE')
  }
  await pool.query(touchUserPresenceSql, [activeUser.id])
  await pool.query(
    `INSERT INTO login_history(user_id,method,success,ip,user_agent) VALUES($1,$2,true,$3,$4)`,
    [activeUser.id, method, req.ip || null, req.get('user-agent') || null],
  ).catch(() => undefined)
  const authVersion = Number(activeUser.auth_version || 0)
  const token = jwt.sign({ sub: activeUser.id, email: activeUser.email || undefined, av: authVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  logEvent('info', method === 'steam' ? 'steam_jwt_issued' : 'auth_jwt_issued', {
    userId: activeUser.id,
    authVersion,
  })
  return token
}

const getOptionalUserId = async (req: Request): Promise<string | null> => {
  const header = req.headers.authorization
  if (!header) return null
  if (!header.startsWith('Bearer ')) throw new Error('INVALID_SESSION')

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), JWT_SECRET) as { sub: string; av?:number }
    if(!validUserId(payload.sub))throw new Error('INVALID_SESSION')
    const account=(await pool.query('SELECT auth_version FROM users WHERE id=$1 AND deleted_at IS NULL',[payload.sub])).rows[0]
    if(!account||Number(payload.av||0)!==Number(account.auth_version||0))throw new Error('INVALID_SESSION')
    return payload.sub
  } catch {
    throw new Error('INVALID_SESSION')
  }
}

app.get('/steam/auth/start',async(req,res)=>{
  const requestOrigin=String(req.get('origin')||'').replace(/\/$/,'')
  const origin=allowedOrigins.has(requestOrigin)?requestOrigin:(process.env.NODE_ENV==='production'?configuredOrigins[0]:developmentOrigins[0])
  if(!origin)return res.status(503).json({error:'Steam authentication origin is not configured',code:'STEAM_ORIGIN_NOT_CONFIGURED'})
  const intent = parseSteamAuthIntent(req.query.intent) || 'login'
  let linkUserId: string | null = null
  if (intent === 'link') {
    try {
      linkUserId = await getOptionalUserId(req)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_SESSION' })
    }
    if (!linkUserId) return res.status(401).json({ error: 'Sign in before connecting Steam', code: 'AUTH_REQUIRED' })
  }
  const nonce=crypto.randomBytes(24).toString('base64url')
  const nonceHash=crypto.createHash('sha256').update(nonce).digest('hex')
  try{
    await pool.query('DELETE FROM steam_auth_nonces WHERE expires_at<=NOW()')
    await pool.query(
      "INSERT INTO steam_auth_nonces(nonce_hash,origin,expires_at,intent,user_id) VALUES($1,$2,NOW()+INTERVAL '10 minutes',$3,$4)",
      [nonceHash,origin,intent,linkUserId],
    )
  }catch(error:any){return sendDatabaseError(res,error)}
  logEvent('info','steam_auth_started',{requestId:res.locals.requestId,intent})
  const state=jwt.sign({purpose:'steam_openid',nonce,origin},JWT_SECRET,{expiresIn:'10m'})
  const returnTo=`${origin}/auth/steam/callback?state=${encodeURIComponent(state)}`
  const params=new URLSearchParams({
    'openid.ns':'http://specs.openid.net/auth/2.0',
    'openid.mode':'checkid_setup',
    'openid.return_to':returnTo,
    'openid.realm':origin,
    'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select',
  })
  return res.json({state,loginUrl:`https://steamcommunity.com/openid/login?${params.toString()}`,expiresInSeconds:600,intent})
})

const verifySteamOpenIdResponse = async (callbackParams: unknown,state:unknown): Promise<{ steamId: string; intent: SteamAuthIntent; userId: string | null }> => {
  if (!callbackParams || typeof callbackParams !== 'object' || Array.isArray(callbackParams)) {
    throw new Error('INVALID_STEAM_CALLBACK')
  }

  if(typeof state!=='string'||!state)throw new Error('INVALID_STEAM_STATE')
  let statePayload:{purpose?:string;origin?:string;nonce?:string}
  try{statePayload=jwt.verify(state,JWT_SECRET) as typeof statePayload}catch{throw new Error('INVALID_STEAM_STATE')}
  if(statePayload.purpose!=='steam_openid'||!statePayload.origin||!statePayload.nonce||!allowedOrigins.has(statePayload.origin))throw new Error('INVALID_STEAM_STATE')

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(callbackParams as Record<string, unknown>)) {
    if (key.startsWith('openid.') && typeof value === 'string') params.set(key, value)
  }

  if (params.get('openid.mode') !== 'id_res') throw new Error('INVALID_STEAM_CALLBACK')

  let returnTo:URL
  try{returnTo=new URL(params.get('openid.return_to')||'')}catch{throw new Error('INVALID_STEAM_STATE')}
  if(returnTo.origin!==statePayload.origin||returnTo.pathname!=='/auth/steam/callback'||returnTo.searchParams.get('state')!==state)throw new Error('INVALID_STEAM_STATE')

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

  const nonceHash=crypto.createHash('sha256').update(statePayload.nonce).digest('hex')
  const consumed=await pool.query(
    'DELETE FROM steam_auth_nonces WHERE nonce_hash=$1 AND origin=$2 AND expires_at>NOW() RETURNING nonce_hash,intent,user_id',
    [nonceHash,statePayload.origin],
  )
  if(!consumed.rows[0])throw new Error('INVALID_STEAM_STATE')

  return {
    steamId: claimedMatch[1],
    intent: parseSteamAuthIntent(consumed.rows[0].intent) || 'login',
    userId: consumed.rows[0].user_id || null,
  }
}

// POST /steam/auth
// Verifies Steam's signed OpenID callback before either signing in an existing
// Steam account or linking Steam to the authenticated Sector Nine account.
app.post('/steam/auth', async (req, res) => {
  try {
    const verified = await verifySteamOpenIdResponse(req.body?.callbackParams,req.body?.state)
    const { steamId, intent } = verified
    logEvent('info','steam_openid_validated',{requestId:res.locals.requestId,intent})
    // users_steam_id_key covers all rows. Filtering deleted rows here could
    // incorrectly enter creation and violate that constraint.
    const linkedResult = await pool.query('SELECT * FROM users WHERE steam_id=$1 LIMIT 1', [steamId])
    const linkedUser = linkedResult.rows[0]
    const summary = await safeFetchSteamProfileSummary(steamId)
    let user = linkedUser
    let createdAccount = false

    if (intent === 'link') {
      const authenticatedUserId = await getOptionalUserId(req)
      if (!verified.userId || !authenticatedUserId || authenticatedUserId !== verified.userId) {
        return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_SESSION' })
      }
      if (linkedUser && linkedUser.id !== verified.userId) {
        return res.status(409).json({
          error: 'This Steam account is already linked to another Sector Nine account.',
          code: 'STEAM_ACCOUNT_ALREADY_LINKED',
        })
      }
      const authenticatedResult = await pool.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [verified.userId])
      user = authenticatedResult.rows[0]
      if (!user) return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' })
      user = await saveSteamProfileSummary(user.id, steamId, summary)
      logEvent('info','steam_link_succeeded',{requestId:res.locals.requestId,userId:user.id})
    } else {
      const resolved = await resolveSteamLoginUser({
        steamId,
        summary,
        findBySteamId: async (id) => (await pool.query('SELECT * FROM users WHERE steam_id=$1 LIMIT 1', [id])).rows[0],
        createUser: createSteamUser,
        updateProfile: (account, id, profileSummary) => saveSteamProfileSummary(account.id, id, profileSummary),
      })
      user = resolved.user
      createdAccount = resolved.createdAccount
      const event = resolved.resolution === 'created'
        ? 'steam_login_new_user_created'
        : resolved.resolution === 'race_existing'
          ? 'steam_login_race_existing_user'
          : 'steam_login_existing_user'
      logEvent('info',event,{requestId:res.locals.requestId,userId:user.id})
    }

    const token = await issueAuthSession(user, 'steam', req)
    const profile = toProfile(user)
    logEvent('info','steam_auth_succeeded',{requestId:res.locals.requestId,intent,userId:user.id,createdAccount})

    return res.status(createdAccount ? 201 : 200).json({
      user: profile,
      profile,
      session: { access_token: token },
      steam: toSteamStatus(user),
      authIntent: intent,
      createdAccount,
    })
  } catch (err: any) {
    logEvent('error','steam_auth_failed',{requestId:res.locals.requestId,errorCode:err?.code||err?.message||'UNKNOWN'})
    if (err.message === 'INVALID_SESSION') {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_SESSION' })
    }
    if (err.message === 'ACCOUNT_NOT_ACTIVE') {
      return res.status(403).json({ error: 'This Sector Nine account is deactivated', code: 'ACCOUNT_NOT_ACTIVE' })
    }
    if (err.message === 'MAINTENANCE_MODE') {
      return res.status(503).json({ error: 'Platform registration is unavailable during maintenance', code: 'MAINTENANCE_MODE' })
    }
    if (err.message === 'REGISTRATION_DISABLED') {
      return res.status(403).json({ error: 'New account registration is currently disabled', code: 'REGISTRATION_DISABLED' })
    }
    if (err.message === 'INVALID_STEAM_CALLBACK') {
      return res.status(401).json({ error: 'Steam OpenID verification failed', code: 'INVALID_STEAM_CALLBACK' })
    }
    if(err.message==='INVALID_STEAM_STATE'){
      return res.status(401).json({error:'Steam login state is invalid or expired',code:'INVALID_STEAM_STATE'})
    }
    if (err.message === 'STEAM_OPENID_UNAVAILABLE') {
      return res.status(502).json({ error: 'Steam OpenID verification is unavailable', code: 'STEAM_OPENID_UNAVAILABLE' })
    }
    return sendInternalError(res, err, 'steam_auth_request_failed')
  }
})

// Steam accounts may only be linked by the signed OpenID callback handled by
// POST /steam/auth. Accepting a caller-supplied SteamID would not prove ownership.
app.post(['/steam/link', '/user/steam/link'], requireAuth, (_req, res) =>
  res.status(410).json({
    error: 'Direct Steam ID linking is disabled. Use Steam OpenID authentication.',
    code: 'STEAM_OPENID_REQUIRED',
  })
)

// GET /steam/status
// Returns only cached, user-safe Steam data for the authenticated account.
app.get('/steam/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(selectUserByIdSql, [req.userId])
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
    return res.json({ steam: toSteamStatus(user) })
  } catch (err: any) {
    return sendInternalError(res, err, 'steam_status_failed', 500, 'STEAM_STATUS_FAILED')
  }
})

// POST /steam/refresh
// Refreshes the linked account from Steam. The caller cannot substitute a Steam ID.
app.post('/steam/refresh', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(selectUserByIdSql, [req.userId])
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' })
    if (!user.steam_id) {
      return res.status(409).json({ error: 'Connect a Steam account first', code: 'STEAM_NOT_LINKED' })
    }

    const steam = await fetchSteamData(user.steam_id)
    const updatedUser = await saveSteamData(req.userId!, steam)
    return res.json({
      steam: toSteamStatus(updatedUser),
      profile: toProfile(updatedUser),
    })
  } catch (err: any) {
    return sendInternalError(res, err, 'steam_refresh_failed', 502, 'STEAM_REFRESH_FAILED')
  }
})

// POST /steam/verify-game
// Uses the database cache when possible. A force=true body field refreshes Steam immediately.
app.post('/steam/verify-game', requireAuth, async (req: AuthRequest, res) => {
  try {
    const force = req.body?.force === true

    const userResult = await pool.query(selectUserByIdSql, [req.userId])
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    // The linked SteamID was established by the signed OpenID callback. Never
    // accept a caller-provided replacement here, because that would bypass proof
    // that the authenticated user controls the Steam account.
    const steamId = user.steam_id
    if (!steamId || !/^\d{17}$/.test(steamId)) {
      return res.status(409).json({ error: 'Connect a Steam account first', code: 'STEAM_NOT_LINKED' })
    }

    if (!force && isFreshSteamCheck(user.last_steam_check)) {
      const cached = steamResultFromUser(user)
      return res.json({
        ownsGame: cached.ownsHL1,
        ownsHL1: cached.ownsHL1,
        hasVacBan: cached.hasVacBan,
        hasGameBan: cached.hasGameBan,
        cached: true,
        lastSteamCheck: user.last_steam_check,
        steam: toSteamStatus(user),
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
      steam: toSteamStatus(updatedUser),
    })
  } catch (err: any) {
    return sendInternalError(res, err, 'steam_game_verification_failed')
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
    if (!apiKey) return sendInternalError(res, new Error('Steam API key not configured'), 'steam_api_key_missing')

    const data = await fetchSteamJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`
    )

    return res.json({ profile: data.response?.players?.[0] || null, cached: false })
  } catch (err: any) {
    return sendInternalError(res, err, 'steam_profile_lookup_failed')
  }
})

// =====================================================
// START
// =====================================================

app.use('/admin', createAdminRouter(pool, JWT_SECRET))

if(process.env.NODE_ENV==='production'&&serveFrontend){
  const frontendBuild=path.resolve(process.cwd(),'build')
  const frontendIndex=path.join(frontendBuild,'index.html')
  if(!fs.existsSync(frontendIndex))throw new Error('Frontend production build is missing. Run npm run build before starting the server.')
  app.use(express.static(frontendBuild,{index:false,maxAge:'1y',immutable:true}))
  app.get('*',(req,res,next)=>{
    if(!String(req.headers.accept||'').includes('text/html'))return next()
    res.setHeader('Cache-Control','no-cache')
    return res.sendFile(frontendIndex)
  })
}

app.use((_req,res)=>res.status(404).json({error:'Route not found',code:'NOT_FOUND'}))

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  logEvent('error', 'unhandled_request_error', {
    requestId: res.locals.requestId,
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  })
  if (res.headersSent) return
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', requestId: res.locals.requestId })
})

const server=app.listen(PORT, '0.0.0.0', () => {
  logEvent('info', 'server_started', { port: PORT, databaseConfigured: Boolean(process.env.DATABASE_URL) })
})
server.requestTimeout=30_000
server.headersTimeout=35_000
server.keepAliveTimeout=5_000

const stopGameServerMonitor=startGameServerMonitor(pool)
let shuttingDown=false
const shutdown=(signal:string)=>{
  if(shuttingDown)return
  shuttingDown=true
  logEvent('info', 'server_shutdown_started', { signal })
  stopGameServerMonitor()
  const forceTimer=setTimeout(()=>process.exit(1),10_000)
  forceTimer.unref()
  server.close(async error=>{
    try{await pool.end()}finally{
      clearTimeout(forceTimer)
      process.exit(error?1:0)
    }
  })
}
process.once('SIGTERM',()=>shutdown('SIGTERM'))
process.once('SIGINT',()=>shutdown('SIGINT'))

export default app
