import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const {parseHostAgentReport,HostAgentProtocolError}=require('../dist/server/hostAgentProtocol.js')
const source=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
const route=source.slice(source.indexOf("app.post('/game-server/:id/heartbeat'"),source.indexOf("app.get('/game-servers/status'"))
const migration=fs.readFileSync(new URL('../src/server/043_host_agent_report_receipts.sql',import.meta.url),'utf8')
const player={name:'n0-cl1p',steamId:'76561198000000000'}
const validStats={score_p1:10,score_p2:5,p1_kills:10,p1_deaths:5,p2_kills:5,p2_deaths:10}
const fails=(body,code)=>assert.throws(()=>parseHostAgentReport(body),error=>error instanceof HostAgentProtocolError&&error.code===code)

assert.deepEqual(parseHostAgentReport({type:'heartbeat',playerCount:0,players:[],map:null}),{type:'heartbeat',playerCount:0,players:[],map:null,observedAt:null})
assert.equal(parseHostAgentReport({type:'player_snapshot',playerCount:1,players:[player],map:'crossfire'}).players[0].steamId,player.steamId)
assert.equal(parseHostAgentReport({type:'match_running',playerCount:1,players:[player],map:'crossfire',demoUrl:'https://demos.example/match.dem'}).demoUrl,'https://demos.example/match.dem')
assert.equal(parseHostAgentReport({type:'match_completed',reportId:'11111111-1111-4111-8111-111111111111',winnerId:'22222222-2222-4222-8222-222222222222',playerCount:0,players:[],map:'crossfire',stats:validStats}).stats.p1_kills,10)
fails({type:'player_snapshot',playerCount:1,players:[{name:'x',steamId:'bad'}],map:'crossfire'},'INVALID_PLAYERS')
fails({type:'match_completed',reportId:'11111111-1111-4111-8111-111111111111',winnerId:'22222222-2222-4222-8222-222222222222',playerCount:0,players:[],stats:{...validStats,p1_kills:-1}},'INVALID_FIELD')
fails({type:'heartbeat',playerCount:0,players:[],map:null,matchId:'33333333-3333-4333-8333-333333333333'},'UNSUPPORTED_FIELD')

assert.match(route,/timingSafeEqual\(expected,actual\)/,'bad tokens use constant-time verification')
assert.match(route,/INVALID_WINNER/,'wrong winner is rejected')
assert.match(route,/NO_CURRENT_MATCH/,'reports requiring a match reject no current match')
assert.match(route,/STALE_MATCH_ASSOCIATION/,'stale server-to-match relationships are rejected')
assert.match(route,/match\.status!==['"]in_progress['"]/,'completion requires an in-progress match')
assert.match(route,/game_server_agent_reports WHERE server_id=\$1 AND report_id=\$2/,'completion retries read the receipt before requiring a current match')
assert.match(route,/receipt\.payload_hash!==payloadHash/,'reused report IDs with changed data are rejected')
assert.match(route,/finalizeServerReportedMatch\(db,match\.id,report\.winnerId,report\.stats\)/,'completion uses the canonical finalizer')
assert.match(migration,/PRIMARY KEY \(server_id, report_id\)/,'receipt identity is unique per server')
for(const line of route.split(/\r?\n/).filter(line=>line.includes('logEvent(')))assert.doesNotMatch(line,/\{[^}]*\b(?:token|authorization|tokenHash|server_token_hash)\s*[:,}]/,'structured logs never include token values')

console.log('Host Agent protocol regression checks passed.')
