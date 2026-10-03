import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const {isDevelopmentPlayerResultEnabled,playerResultRejection}=require('../dist/server/competitiveResultSecurity.js')
assert.equal(isDevelopmentPlayerResultEnabled({NODE_ENV:'production',ALLOW_PLAYER_RESULT_SUBMISSION:'true'}),false,'production cannot enable player-authored results')
assert.equal(isDevelopmentPlayerResultEnabled({NODE_ENV:'development',ALLOW_PLAYER_RESULT_SUBMISSION:'false'}),false,'development defaults off')
assert.equal(isDevelopmentPlayerResultEnabled({NODE_ENV:'development',ALLOW_PLAYER_RESULT_SUBMISSION:'true'}),true,'development requires an explicit opt-in')
assert.deepEqual(playerResultRejection({isParticipant:true,matchStatus:'in_progress',enabled:false}),{status:403,code:'TRUSTED_RESULT_REQUIRED',error:'Ranked match results must be submitted by the assigned game server or an administrator'},'participant cannot forge a ranked result')
assert.equal(playerResultRejection({isParticipant:false,matchStatus:'in_progress',enabled:true})?.code,'MATCH_RESULT_FORBIDDEN','nonparticipant cannot use the development escape hatch')
assert.equal(playerResultRejection({isParticipant:true,matchStatus:'completed',enabled:true})?.code,'MATCH_ALREADY_COMPLETED','completed matches cannot be finalized again')
assert.equal(playerResultRejection({isParticipant:true,matchStatus:'pending',enabled:true})?.code,'MATCH_NOT_IN_PROGRESS','unsupported lifecycle transitions remain blocked')
assert.equal(playerResultRejection({isParticipant:true,matchStatus:'in_progress',enabled:true}),null,'explicit nonproduction escape hatch remains available')

const server=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
const agentRoute=server.slice(server.indexOf("app.post('/game-server/:id/heartbeat'"),server.indexOf("app.get('/game-servers/status'"))
assert.match(agentRoute,/match\.server_id!==server\.id/,'wrong server cannot complete a match')
assert.match(agentRoute,/finalizeServerReportedMatch\(db,match\.id,report\.winnerId,report\.stats\)/,'valid assigned Host Agent uses canonical completion')
assert.match(agentRoute,/game_server_agent_reports WHERE server_id=\$1 AND report_id=\$2/,'Host Agent completion retries are receipt-idempotent')
const finalizer=server.slice(server.indexOf('const finalizeServerReportedMatch='),server.indexOf("app.post('/game-server/:id/heartbeat'"))
assert.match(finalizer,/SELECT \* FROM matches WHERE id=\$1 FOR UPDATE/,'canonical completion serializes on the match row')
assert.match(finalizer,/if\(match\.status===['"]completed['"]\)return match/,'duplicate canonical completion does not apply stats or rating twice')
const admin=fs.readFileSync(new URL('../src/server/admin.ts',import.meta.url),'utf8')
assert.match(admin,/await audit\(db,req,'match\.update'/,'administrator intervention remains audited')
assert.match(admin,/if\(statsRelevant&&before\.status===['"]completed['"]\)await changeMatchXp\(db,before,-1\)/,'admin overrides reverse prior XP before reapplying')

console.log('Competitive result authorization regression checks passed.')
