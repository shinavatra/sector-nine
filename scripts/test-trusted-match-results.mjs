import assert from 'node:assert/strict'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
const {validateTrustedMatchContext,validateTrustedMatchCompletion,TrustedMatchResultError,steamAccountId}=require('../dist/server/trustedMatchResult.js')

const p1='22222222-2222-4222-8222-222222222222'
const p2='33333333-3333-4333-8333-333333333333'
const assignment={id:'11111111-1111-4111-8111-111111111111',game_id:'hl1',game_mode:'classic-deathmatch',selected_map:'dm_crossfire',player1_id:p1,player2_id:p2,player1_steam_id:'76561198000000000',player2_steam_id:'76561198000000001'}
const players=[{name:'p1',steamId:'STEAM_0:0:19867136'},{name:'p2',steamId:'[U:1:39734273]'}]
const stats={score_p1:10,score_p2:5,p1_kills:10,p1_deaths:5,p2_kills:5,p2_deaths:10}
const valid={players,playerCount:2,map:'crossfire',winnerId:p1,stats}
const fails=(fn,code)=>assert.throws(fn,error=>error instanceof TrustedMatchResultError&&error.code===code)

assert.equal(steamAccountId('76561198000000000'),39734272n,'SteamID64 normalizes to account ID')
assert.doesNotThrow(()=>validateTrustedMatchContext(assignment,valid),'assigned players and engine map are accepted')
assert.deepEqual(validateTrustedMatchCompletion(assignment,valid),{winnerId:p1,stats},'winner is derived from validated score')
const negativeScore={...valid,stats:{...stats,score_p2:-1,p2_kills:0,p2_deaths:11}}
assert.deepEqual(validateTrustedMatchCompletion(assignment,negativeScore),{winnerId:p1,stats:negativeScore.stats},'negative suicide-adjusted score preserves server-side winner derivation')
assert.deepEqual(validateTrustedMatchCompletion({...assignment,game_mode:'instagib-mode'},valid),{winnerId:p1,stats},'each configured mode uses its own trusted rules')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,players:[players[0],{...players[1],steamId:'76561198000000999'}]}),'ASSIGNED_PLAYERS_MISMATCH')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,players:[players[0],players[0]]}),'INVALID_REPORTED_PLAYERS')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,map:'bounce'}),'ASSIGNED_MAP_MISMATCH')
fails(()=>validateTrustedMatchCompletion({...assignment,game_mode:'unknown-mode'},valid),'UNSUPPORTED_ASSIGNED_MODE')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,winnerId:p2}),'CONTRADICTORY_MATCH_RESULT')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,stats:{...stats,score_p1:9}}),'INCOMPLETE_MATCH_RESULT')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,stats:{...stats,score_p1:10,score_p2:10}}),'CONTRADICTORY_MATCH_RESULT')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,stats:{...stats,score_p1:11,score_p2:10}}),'CONTRADICTORY_MATCH_RESULT')
fails(()=>validateTrustedMatchCompletion(assignment,{...valid,playerCount:3}),'ASSIGNED_PLAYERS_MISMATCH')

console.log('Trusted match result validation checks passed.')
