import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { Pool, PoolClient } from 'pg'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_DAYS = 30

type Queryable = Pool | PoolClient
type SessionUser = { id: string; email?: string | null; auth_version?: number | null; deleted_at?: unknown }
type SessionMetadata = { ip?: string | null; userAgent?: string | null }

export type AccessTokenPayload = { sub: string; email?: string; av: number; sid: string }
export type IssuedSession = { accessToken: string; refreshToken: string; sessionId: string; expiresAt: string }
export type RefreshFailure = 'INVALID_REFRESH_TOKEN' | 'REFRESH_TOKEN_EXPIRED' | 'REFRESH_TOKEN_REUSED' | 'SESSION_REVOKED'

export class RefreshSessionError extends Error {
  constructor(public code: RefreshFailure) { super(code) }
}

export const hashRefreshToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
const newRefreshToken = () => crypto.randomBytes(32).toString('base64url')
const cleanMetadata = (value: string | null | undefined, max: number) => value ? value.slice(0, max) : null

export const signAccessToken = (user: SessionUser, sessionId: string, secret: string) => jwt.sign({
  sub: user.id,
  ...(user.email ? { email: user.email } : {}),
  av: Number(user.auth_version || 0),
  sid: sessionId,
}, secret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS })

export const issueSession = async (db: Queryable, user: SessionUser, secret: string, metadata: SessionMetadata): Promise<IssuedSession> => {
  const sessionId=crypto.randomUUID(),familyId=crypto.randomUUID(),refreshToken=newRefreshToken()
  const result=await db.query(
    `INSERT INTO auth_sessions(id,family_id,user_id,refresh_token_hash,auth_version,expires_at,ip,user_agent)
     VALUES($1,$2,$3,$4,$5,NOW()+($6::text||' days')::interval,$7,$8) RETURNING expires_at`,
    [sessionId,familyId,user.id,hashRefreshToken(refreshToken),Number(user.auth_version||0),REFRESH_TOKEN_TTL_DAYS,cleanMetadata(metadata.ip,64),cleanMetadata(metadata.userAgent,500)],
  )
  return{accessToken:signAccessToken(user,sessionId,secret),refreshToken,sessionId,expiresAt:result.rows[0].expires_at.toISOString()}
}

export const rotateSession = async (pool: Pool, refreshToken: string, secret: string, metadata: SessionMetadata): Promise<IssuedSession> => {
  const db=await pool.connect()
  try{
    await db.query('BEGIN')
    const row=(await db.query(
      `SELECT s.*,u.email,u.auth_version current_auth_version,u.deleted_at
       FROM auth_sessions s JOIN users u ON u.id=s.user_id
       WHERE s.refresh_token_hash=$1 FOR UPDATE OF s`,[hashRefreshToken(refreshToken)],
    )).rows[0]
    if(!row){await db.query('ROLLBACK');throw new RefreshSessionError('INVALID_REFRESH_TOKEN')}
    if(row.revoked_at||row.replaced_by){
      await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL',[row.family_id])
      await db.query('COMMIT')
      throw new RefreshSessionError('REFRESH_TOKEN_REUSED')
    }
    if(new Date(row.expires_at).getTime()<=Date.now()){
      await db.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1',[row.id]);await db.query('COMMIT')
      throw new RefreshSessionError('REFRESH_TOKEN_EXPIRED')
    }
    if(row.deleted_at||Number(row.auth_version)!==Number(row.current_auth_version)){
      await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL',[row.family_id]);await db.query('COMMIT')
      throw new RefreshSessionError('SESSION_REVOKED')
    }
    const nextId=crypto.randomUUID(),nextToken=newRefreshToken()
    const inserted=(await db.query(
      `INSERT INTO auth_sessions(id,family_id,user_id,refresh_token_hash,auth_version,expires_at,created_at,ip,user_agent)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING expires_at`,
      [nextId,row.family_id,row.user_id,hashRefreshToken(nextToken),row.current_auth_version,row.expires_at,row.created_at,cleanMetadata(metadata.ip,64),cleanMetadata(metadata.userAgent,500)],
    )).rows[0]
    await db.query('UPDATE auth_sessions SET revoked_at=NOW(),last_used_at=NOW(),replaced_by=$1 WHERE id=$2 AND revoked_at IS NULL',[nextId,row.id])
    await db.query('COMMIT')
    const user={id:row.user_id,email:row.email,auth_version:row.current_auth_version}
    return{accessToken:signAccessToken(user,nextId,secret),refreshToken:nextToken,sessionId:nextId,expiresAt:inserted.expires_at.toISOString()}
  }catch(error){try{await db.query('ROLLBACK')}catch{}throw error}finally{db.release()}
}

export const revokeSessionByToken = async (db: Queryable, refreshToken: string) => {
  await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE refresh_token_hash=$1',[hashRefreshToken(refreshToken)])
}

export const revokeUserSessions = async (db: Queryable, userId: string) => {
  await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL',[userId])
}
