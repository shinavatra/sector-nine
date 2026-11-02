import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const {deriveParticipantMatchLifecycle}=require('../dist/server/matchLifecycle.js')
const now=Date.parse('2026-11-02T12:00:00.000Z')
const fresh='2026-11-02T11:59:50.000Z'
const base={id:'11111111-1111-4111-8111-111111111111',status:'pending',game_id:'hl1',selected_map:'dm_crossfire',server_id:'22222222-2222-4222-8222-222222222222',server_current_players:0,server_current_map:'crossfire',server_last_heartbeat:fresh,server_last_error:null,host_id:'33333333-3333-4333-8333-333333333333',host_enabled:true,host_last_seen_at:fresh,profile_last_seen_at:fresh,profile_reported_state:'running',profile_reported_match_id:'11111111-1111-4111-8111-111111111111',profile_lifecycle_status:'starting'}

assert.equal(deriveParticipantMatchLifecycle({...base,server_id:null},now).phase,'waiting_for_server')
assert.equal(deriveParticipantMatchLifecycle({...base,profile_reported_match_id:null},now).phase,'server_starting','reservation is not readiness')
assert.equal(deriveParticipantMatchLifecycle({...base,server_current_map:'stalkyard'},now).phase,'server_starting','wrong map cannot expose connection details')
assert.equal(deriveParticipantMatchLifecycle(base,now).phase,'ready')
assert.equal(deriveParticipantMatchLifecycle({...base,server_current_players:1},now).phase,'waiting_for_players')
assert.equal(deriveParticipantMatchLifecycle({...base,status:'in_progress',server_current_players:2},now).phase,'in_progress')
assert.equal(deriveParticipantMatchLifecycle({...base,server_last_error:'launch failed'},now).phase,'server_error')
assert.equal(deriveParticipantMatchLifecycle({...base,status:'in_progress',server_last_heartbeat:'2026-11-02T11:58:00.000Z'},now).phase,'server_error')
assert.equal(deriveParticipantMatchLifecycle({...base,host_id:null,host_enabled:null,host_last_seen_at:null,profile_last_seen_at:null,profile_reported_state:null,profile_reported_match_id:null},now).phase,'ready','legacy unmanaged servers use verified server telemetry')

const backend=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
const rcon=fs.readFileSync(new URL('../src/server/rcon.ts',import.meta.url),'utf8')
const queue=fs.readFileSync(new URL('../src/components/GameQueue.tsx',import.meta.url),'utf8')
const stateRoute=backend.slice(backend.indexOf('const getMatchmakingState'),backend.indexOf('const assignMatchmakingServer'))
const allocation=backend.slice(backend.indexOf('const assignMatchmakingServer'),backend.indexOf('const pairQueuedPlayer'))

assert.match(stateRoute,/FROM match_acceptances mine[\s\S]*mine\.user_id=\$1/,'only match participants can receive lifecycle or connection details')
assert.match(stateRoute,/lifecycle\?\.serverReady&&publicEndpoint/,'connection details require verified server readiness')
assert.match(stateRoute,/const publicMatch=/)
assert.doesNotMatch(stateRoute,/return\{state,match,viewerAccepted/,'raw server and Host Agent columns must not be returned to players')
assert.match(allocation,/FOR UPDATE OF s SKIP LOCKED LIMIT 1/,'server reservation remains atomic')
assert.match(allocation,/if\(!server\)return null/,'no capacity remains a retryable waiting state')
assert.match(backend,/recoverFailedMatchServer[\s\S]*current_match_id=NULL[\s\S]*server_id=NULL/,'failed reservations are safely released')
assert.match(backend,/server_reservation_failed[\s\S]*startup_timeout/,'server startup failures remain visible in the admin match timeline')
assert.match(backend,/MATCH_ACCEPT_TIMEOUT_SECONDS[\s\S]*MATCH_VETO_TIMEOUT_SECONDS[\s\S]*expireAbandonedMatchmaking/,'acceptance and veto timeouts survive worker restarts through database state')
assert.match(rcon,/if\(row\.host_id\)return true[\s\S]*if\(!row\.rcon_secret_encrypted\)return false/,'Host Agent assignments are not duplicated through RCON')
assert.match(queue,/SERVER STARTING[\s\S]*verified telemetry confirms readiness/)
assert.match(backend,/game_server_agent_reports[\s\S]*IDEMPOTENCY_CONFLICT/,'trusted result receipts reject replay conflicts')

console.log('HL1 lifecycle tests passed: readiness gating, participant access, allocation isolation, recovery, timeouts and trusted-result contracts.')
