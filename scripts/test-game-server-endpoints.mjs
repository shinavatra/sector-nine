import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
require('ts-node/register/transpile-only')
const {normalizeServerEndpoint}=require('../src/shared/serverEndpoint.ts')

const migration=fs.readFileSync('src/server/042_game_server_endpoint_separation.sql','utf8')
const rcon=fs.readFileSync('src/server/rcon.ts','utf8')
const server=fs.readFileSync('src/server/index.ts','utf8')
const admin=fs.readFileSync('src/server/admin.ts','utf8')
const adminEditor=fs.readFileSync('src/components/admin/AdminServerManagement.tsx','utf8')
const adminPage=fs.readFileSync('src/pages/Admin.tsx','utf8')

assert.match(migration,/ADD COLUMN IF NOT EXISTS public_host TEXT/)
assert.match(migration,/ADD COLUMN IF NOT EXISTS public_port INTEGER/)
assert.match(migration,/ADD COLUMN IF NOT EXISTS rcon_host TEXT/)
assert.match(migration,/ADD COLUMN IF NOT EXISTS rcon_port INTEGER/)
assert.match(migration,/public_host=COALESCE\([\s\S]*ip_address/,'legacy host is copied to the public endpoint')
assert.match(migration,/rcon_host=COALESCE\([\s\S]*ip_address/,'legacy host is copied to the RCON endpoint')
assert.match(migration,/public_port=COALESCE\(public_port,port\)/,'legacy port is copied to the public endpoint')
assert.match(migration,/rcon_port=COALESCE\(rcon_port,port\)/,'legacy port is copied to the RCON endpoint')

assert.deepEqual(normalizeServerEndpoint('192.168.0.44',27015),{host:'192.168.0.44',port:27015,endpoint:'192.168.0.44:27015'})
assert.deepEqual(normalizeServerEndpoint('147.185.221.215',6561),{host:'147.185.221.215',port:6561,endpoint:'147.185.221.215:6561'})

assert.match(rcon,/rconCommand\(server\.rcon_host,Number\(server\.rcon_port\)/)
assert.match(rcon,/new SourceRcon\(\{host:server\.rcon_host,port:Number\(server\.rcon_port\)/)
assert.match(rcon,/quakeCommand\(server\.rcon_host,Number\(server\.rcon_port\)/)
assert.doesNotMatch(rcon,/server\.ip_address|server\.port/,'RCON never falls back to the player endpoint')

const publicStatus=server.slice(server.indexOf("app.get('/game-servers/status'"),server.indexOf("app.get('/games'"))
assert.match(publicStatus,/public_host,public_port/)
assert.doesNotMatch(publicStatus,/rcon_host|rcon_port|rcon_secret|rcon_password/,'public status never exposes RCON configuration')
assert.match(server,/gs\.public_host AS server_host,gs\.public_port AS server_port/,'matchmaking response uses the public endpoint')

assert.match(admin,/public_host,public_port,rcon_host,rcon_port/,'admin server reads explicitly include both endpoints')
const safeServerColumns=admin.match(/const safeServerColumns="([^"]+)"/)?.[1]||''
assert.ok(safeServerColumns.includes('(rcon_secret_encrypted IS NOT NULL'),'admin exposes only the has-RCON boolean')
assert.ok(!safeServerColumns.split(',').includes('rcon_secret_encrypted'),'admin reads do not return the encrypted secret')
for(const label of ['Public Game Address','Public Game Port','RCON Address','RCON Port','RCON Password'])assert.ok(adminEditor.includes(label)||adminPage.includes(label),`admin UI includes ${label}`)

console.log('Game-server endpoint separation checks passed')
