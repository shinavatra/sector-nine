import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const {parseHostAgentEvent,HostAgentEventError}=require('../dist/server/hostAgentEventProtocol.js')
const now=new Date().toISOString(),eventId='11111111-1111-4111-8111-111111111111',p1='22222222-2222-4222-8222-222222222222',p2='33333333-3333-4333-8333-333333333333'
const valid={type:'kill',eventId,sequence:7,occurredAt:now,actorUserId:p1,targetUserId:p2,weapon:'weapon_gauss'}
assert.deepEqual(parseHostAgentEvent(valid),{...valid,occurredAt:new Date(now).toISOString()})
const fails=(value,code)=>assert.throws(()=>parseHostAgentEvent(value),error=>error instanceof HostAgentEventError&&error.code===code)
fails({...valid,weapon:'gauss; quit'},'INVALID_EVENT_WEAPON')
fails({...valid,details:{raw:'untrusted HLDS line'}},'UNSUPPORTED_EVENT_FIELD')
fails({...valid,sequence:-1},'INVALID_EVENT_SEQUENCE')

const source=fs.readFileSync(new URL('../src/server/index.ts',import.meta.url),'utf8')
const route=source.slice(source.indexOf("app.post('/game-server/:id/events'"),source.indexOf("app.get('/game-servers/status'"))
assert.match(route,/serverAgentCredentialValid\(server,token\)/,'events use centralized server or linked-host authentication')
assert.match(route,/if\(!server\.current_match_id\).*NO_CURRENT_MATCH/,'no current match is rejected')
assert.match(route,/match\.server_id!==server\.id.*STALE_MATCH_ASSOCIATION/,'wrong server association is rejected')
assert.match(route,/match\.status===['"]completed['"].*MATCH_ALREADY_COMPLETED/,'completed matches are rejected')
assert.match(route,/EVENT_ACTOR_NOT_PARTICIPANT/,'outsider actors are rejected')
assert.match(route,/EVENT_TARGET_NOT_PARTICIPANT/,'outsider targets are rejected')
assert.match(route,/source_server_id=\$1 AND source_event_id=\$2/,'duplicate event IDs are checked')
assert.match(route,/source_payload_hash!==payloadHash/,'changed duplicate payloads are rejected')
assert.match(route,/EVENT_SEQUENCE_CONFLICT/,'duplicate source sequences are rejected')
assert.doesNotMatch(route,/UPDATE user_game_stats|UPDATE users SET|rating_history|finalizeServerReportedMatch/,'event ingestion never applies aggregate statistics or rating')
const migration=fs.readFileSync(new URL('../src/server/044_trusted_match_event_ingestion.sql',import.meta.url),'utf8')
assert.match(migration,/UNIQUE INDEX IF NOT EXISTS idx_match_events_server_event_id/)
assert.match(migration,/UNIQUE INDEX IF NOT EXISTS idx_match_events_match_server_source_sequence/)

console.log('Trusted Host Agent event-ingestion regression checks passed.')
