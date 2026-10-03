import assert from 'node:assert/strict'
import fs from 'node:fs'

const server=fs.readFileSync('src/server/index.ts','utf8')
const admin=fs.readFileSync('src/server/admin.ts','utf8')
const editor=fs.readFileSync('src/components/admin/AdminServerManagement.tsx','utf8')
const createDialog=fs.readFileSync('src/pages/Admin.tsx','utf8')
const migration=fs.readFileSync('src/server/041_game_server_mode_isolation.sql','utf8')

const assignment=server.slice(server.indexOf('const assignMatchmakingServer='),server.indexOf('const pairQueuedPlayer='))
assert.match(assignment,/SELECT id,game_id,game_mode,server_id,status,matchmaking_region,selected_map FROM matches/)
assert.match(assignment,/WHERE game_id=\$1 AND game_mode=\$2 AND region=\$3 AND status='online' AND current_match_id IS NULL/)
assert.match(assignment,/FOR UPDATE SKIP LOCKED LIMIT 1/)
assert.match(assignment,/\[match\.game_id,match\.game_mode,match\.matchmaking_region\]/)

const match={game_id:'hl1',game_mode:'classic-deathmatch',matchmaking_region:'eu'}
const eligible=server=>server.game_id===match.game_id&&server.game_mode===match.game_mode&&server.region===match.matchmaking_region&&server.status==='online'&&server.current_match_id===null
assert.equal(eligible({game_id:'hl1',game_mode:'classic-deathmatch',region:'eu',status:'online',current_match_id:null}),true,'exact game/mode/region server is eligible')
assert.equal(eligible({game_id:'hl1',game_mode:'instagib-mode',region:'eu',status:'online',current_match_id:null}),false,'wrong mode is rejected')
assert.equal(eligible({game_id:'hl1',game_mode:'classic-deathmatch',region:'us-east',status:'online',current_match_id:null}),false,'wrong region is rejected')
assert.equal(eligible({game_id:'cs16',game_mode:'classic-deathmatch',region:'eu',status:'online',current_match_id:null}),false,'wrong game is rejected')
assert.equal(eligible({game_id:'hl1',game_mode:'classic-deathmatch',region:'eu',status:'online',current_match_id:'busy'}),false,'busy server is rejected')
assert.equal(eligible({game_id:'hl1',game_mode:'classic-deathmatch',region:'eu',status:'offline',current_match_id:null}),false,'offline server is rejected')
assert.equal(eligible({game_id:'hl1',game_mode:null,region:'eu',status:'online',current_match_id:null}),false,'legacy NULL mode is rejected')

assert.match(migration,/ADD COLUMN IF NOT EXISTS game_mode TEXT/)
assert.doesNotMatch(migration,/UPDATE game_servers SET game_mode/,'legacy servers are not silently backfilled')
assert.match(migration,/NEW\.game_mode=ANY\(config\.modes\)/,'database validates canonical configured modes')
assert.match(admin,/SELECT 1 FROM game_matchmaking_config WHERE game_id=\$1 AND \$2=ANY\(modes\)/,'admin API validates mode against configured game modes')
assert.match(admin,/game_id,game_mode,game,region/,'admin server reads include game mode')
assert.match(admin,/INSERT INTO game_servers\(game,game_id,game_mode,region/,'admin server creation persists game mode')
assert.match(editor,/name="gameMode" required/,'admin server editor requires a configured mode selection')
assert.match(createDialog,/name="gameMode" required/,'admin server creation requires a configured mode selection')
assert.match(createDialog,/modeCatalog\?\.find\(entry=>entry\.game_id===serverGameId\)/,'create mode dropdown is populated from the selected game catalog')

console.log('Game-server mode isolation checks passed')
