import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const jwt=require('jsonwebtoken')
const {ACCESS_TOKEN_TTL_SECONDS,RefreshSessionError,hashRefreshToken,issueSession,rotateSession}=require('../dist/server/secureSessions.js')
const secret='test-secret-that-is-long-enough-for-session-signing'
const user={id:'11111111-1111-4111-8111-111111111111',email:'player@example.test',auth_version:3}

let issuedParams
const issueDb={query:async(_sql,params)=>{issuedParams=params;return{rows:[{expires_at:new Date('2026-11-10T00:00:00.000Z')}]}}}
const issued=await issueSession(issueDb,user,secret,{ip:'127.0.0.1',userAgent:'test'})
assert.match(issued.refreshToken,/^[A-Za-z0-9_-]{43}$/,'refresh token contains 256 random bits encoded as base64url')
assert.equal(issuedParams[3],hashRefreshToken(issued.refreshToken),'database receives only the refresh-token hash')
assert.notEqual(issuedParams[3],issued.refreshToken,'plaintext refresh token is never persisted')
const payload=jwt.verify(issued.accessToken,secret)
assert.equal(payload.sid,issued.sessionId)
assert.equal(payload.exp-payload.iat,ACCESS_TOKEN_TTL_SECONDS,'access token lasts 15 minutes')

const oldToken=crypto.randomBytes(32).toString('base64url'),familyId='22222222-2222-4222-8222-222222222222'
const state=[{id:'33333333-3333-4333-8333-333333333333',family_id:familyId,user_id:user.id,refresh_token_hash:hashRefreshToken(oldToken),auth_version:3,current_auth_version:3,email:user.email,deleted_at:null,expires_at:new Date(Date.now()+86_400_000),created_at:new Date('2026-10-11T00:00:00.000Z'),revoked_at:null,replaced_by:null}]
const client={
  async query(sql,params=[]){
    if(/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql))return{rows:[]}
    if(sql.includes('FROM auth_sessions s JOIN users'))return{rows:state.filter(row=>row.refresh_token_hash===params[0]).map(row=>({...row}))}
    if(sql.startsWith('INSERT INTO auth_sessions')){const row={id:params[0],family_id:params[1],user_id:params[2],refresh_token_hash:params[3],auth_version:params[4],expires_at:params[5],created_at:params[6],ip:params[7],user_agent:params[8],current_auth_version:params[4],email:user.email,deleted_at:null,revoked_at:null,replaced_by:null};state.push(row);return{rows:[{expires_at:row.expires_at}]}}
    if(sql.includes('last_used_at=NOW(),replaced_by')){const row=state.find(item=>item.id===params[1]);row.revoked_at=new Date();row.replaced_by=params[0];return{rows:[]}}
    if(sql.includes('WHERE family_id=$1')){for(const row of state)if(row.family_id===params[0]&&!row.revoked_at)row.revoked_at=new Date();return{rows:[]}}
    throw new Error(`Unexpected SQL: ${sql}`)
  },release(){},
}
const pool={connect:async()=>client}
const rotated=await rotateSession(pool,oldToken,secret,{ip:'127.0.0.2',userAgent:'rotated'})
assert.notEqual(rotated.refreshToken,oldToken,'every refresh rotates the token')
assert.equal(state.filter(row=>!row.revoked_at).length,1,'only the rotated token remains active')
await assert.rejects(()=>rotateSession(pool,oldToken,secret,{}),error=>error instanceof RefreshSessionError&&error.code==='REFRESH_TOKEN_REUSED')
assert.equal(state.filter(row=>!row.revoked_at).length,0,'reuse revokes the active token family')

const migration=fs.readFileSync(new URL('../src/server/046_secure_auth_sessions.sql',import.meta.url),'utf8')
for(const field of ['refresh_token_hash','family_id','expires_at','created_at','last_used_at','revoked_at','replaced_by'])assert.match(migration,new RegExp(`\\b${field}\\b`))
const server=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
assert.match(server,/credentials:\s*true/,'CORS permits credentialed requests from allowlisted origins')
assert.match(server,/app\.post\('\/auth\/refresh'/)
assert.match(server,/app\.post\('\/auth\/logout'/)
assert.match(server,/NODE_ENV==='production'&&!origin/,'production cookie-auth requests require an Origin header')
assert.match(server,/AUTH_COOKIE_PATH/,'refresh-cookie path is explicitly configurable for the same-origin proxy')
assert.match(server,/authorization\?\.startsWith\('Bearer '\)[\s\S]+UPDATE auth_sessions/,'logout revokes the current access-token session even if its cookie is missing')
assert.match(server,/LEFT JOIN auth_sessions/,'access-token middleware checks server-side session state')
const frontend=fs.readFileSync(new URL('../src/utils/api.tsx',import.meta.url),'utf8')
assert.doesNotMatch(frontend,/localStorage\.(?:getItem|setItem)\(['"]session_token/,'access tokens are never read from or written to localStorage')
assert.match(frontend,/CrossTabRefreshCoordinator/,'frontend delegates refresh to cross-tab coordination')
assert.match(frontend,/credentials:'include'/,'frontend sends the HttpOnly refresh cookie cross-origin')

console.log('Secure session rotation and frontend storage checks passed.')
