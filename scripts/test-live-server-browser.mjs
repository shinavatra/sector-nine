import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require=createRequire(import.meta.url)
require('ts-node/register/transpile-only')
const {mapServerBrowserRow,isSafePublicServerHost}=require('../dist/server/serverBrowser.js')
const {filterServerBrowserRows}=require('../src/components/serverBrowserModel.ts')
const now=new Date('2026-11-02T12:00:00.000Z')
const base={id:'server-1',name:'AG Frankfurt',game_id:'hl1',game_mode:'ag_1v1',region:'eu-central',public_host:'203.0.114.10',public_port:27015,max_slots:12,status:'online',current_players:3,current_map:'ag_crossfire',last_heartbeat:'2026-11-02T11:59:40.000Z',current_match_id:null,profile_matchmaking_enabled:false}

const publicServer=mapServerBrowserRow(base,now,60)
assert.equal(publicServer.status,'online')
assert.equal(publicServer.availability,'reachable')
assert.equal(publicServer.currentMap,'ag_crossfire')
assert.equal(publicServer.currentPlayers,3)
assert.equal(publicServer.address,'203.0.114.10:27015')

const stale=mapServerBrowserRow({...base,last_heartbeat:'2026-11-02T11:58:00.000Z'},now,60)
assert.equal(stale.status,'offline')
assert.equal(stale.availability,'offline')

const idle=mapServerBrowserRow({...base,profile_matchmaking_enabled:true},now,60)
assert.equal(idle.availability,'idle')
assert.equal(idle.address,null,'matchmaking profiles must not expose direct-connect addresses')
const linkedProfile=mapServerBrowserRow({...base,has_host_profile:true},now,60)
assert.equal(linkedProfile.address,null,'linked Host Agent profiles must remain protected even while matchmaking is disabled')

const reserved=mapServerBrowserRow({...base,current_match_id:'match-1',current_match_status:'pending'},now,60)
assert.equal(reserved.status,'in_match')
assert.equal(reserved.availability,'reserved')
assert.equal(reserved.canCopyAddress,false)

const active=mapServerBrowserRow({...base,current_match_id:'match-1',current_match_status:'in_progress'},now,60)
assert.equal(active.availability,'active_match')
assert.equal(active.protectedCompetitive,true)

for(const host of ['127.0.0.1','10.0.0.4','192.168.1.2','172.20.0.1','localhost','agent.internal','singlelabel'])assert.equal(isSafePublicServerHost(host),false,`${host} must stay private`)
assert.equal(isSafePublicServerHost('server.example.com'),true)
assert.equal(isSafePublicServerHost('8.8.8.8'),true)

const candidates=[publicServer,{...idle,id:'server-2',name:'AG London',region:'eu-west'}]
assert.deepEqual(filterServerBrowserRows(candidates,{search:'frank',game:'hl1',region:'all',availability:'all'}).map(server=>server.id),['server-1'])
assert.deepEqual(filterServerBrowserRows(candidates,{search:'',game:'hl1',region:'eu-west',availability:'idle'}).map(server=>server.id),['server-2'])

const backend=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
const browser=fs.readFileSync(new URL('../src/components/ServerBrowser.tsx',import.meta.url),'utf8')
const realtime=fs.readFileSync(new URL('../src/server/realtime.ts',import.meta.url),'utf8')
assert.match(backend,/app\.get\('\/game-servers\/status',requireAuth/)
assert.match(backend,/realtimeHub\.broadcast\('server\.status'/)
assert.doesNotMatch(backend.slice(backend.indexOf("app.get('/game-servers/status'"),backend.indexOf("app.get('/games'")),/telemetry->|'players'/)
assert.match(browser,/setInterval\(\(\)=>void refresh\(true\),20_000\)/)
assert.match(browser,/server\.protectedCompetitive\?'PROTECTED MATCHMAKING INSTANCE'/)
assert.match(realtime,/broadcast\(type:/)

console.log('Live server browser tests passed: mapping, staleness, address safety, reservation isolation, SSE and polling contracts.')
