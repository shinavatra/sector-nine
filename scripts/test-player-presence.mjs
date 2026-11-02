import assert from'node:assert/strict'
import fs from'node:fs'
import ts from'typescript'
import vm from'node:vm'

const root=new URL('../',import.meta.url),read=path=>fs.readFileSync(new URL(path,root),'utf8')
const source=read('src/server/presence.ts')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const module={exports:{}}
vm.runInNewContext(js,{module,exports:module.exports,process:{env:{}}})
const{derivePresenceState}=module.exports,now=1_000_000
assert.equal(derivePresenceState({now,leases:[{expiresAt:now+75_000,lastActivity:now}]}),'online')
assert.equal(derivePresenceState({now,leases:[{expiresAt:now+75_000,lastActivity:now-301_000}]}),'away')
assert.equal(derivePresenceState({now,leases:[{expiresAt:now-1,lastActivity:now}]}),'offline')
assert.equal(derivePresenceState({now,leases:[{expiresAt:now-1,lastActivity:now},{expiresAt:now+1,lastActivity:now}]}),'online','one tab closing must not override another live lease')
assert.equal(derivePresenceState({now,inMatch:true,leases:[]}),'in_match')
assert.equal(derivePresenceState({now,visible:false,inMatch:true,leases:[{expiresAt:now+1,lastActivity:now}]}),'offline','privacy must dominate activity')

const server=read('src/server/index.ts'),hub=read('src/server/realtime.ts'),client=read('src/utils/realtime.ts'),friends=read('src/components/Friends.tsx'),party=read('src/components/PartyPanel.tsx'),chat=read('src/components/GlobalChat.tsx'),profile=read('src/pages/PublicProfile.tsx')
assert.match(server,/player_presence_leases/)
assert.match(server,/auth_session_id=\$2/,'logout must clear only the current authenticated session leases')
assert.match(server,/presenceViewers/)
assert.match(server,/user_blocks/)
assert.match(server,/presence\.snapshot/)
assert.match(server,/realtimeHub\.ownsConnection\(req\.userId!,connectionId\)/,'public-profile watches must belong to the authenticated viewer connection')
assert.match(server,/canViewUserProfile\(req\.userId,target\)/,'public-profile watches must enforce profile privacy')
assert.match(server,/status='in_progress'/,'IN MATCH must use match lifecycle state')
assert.match(hub,/onClosed/)
assert.match(hub,/onHeartbeat/)
assert.match(client,/presence\.changed/)
for(const ui of [friends,party,chat,profile])assert.match(ui,/presence\.(changed|snapshot)|presenceStatus/)
assert.match(friends,/IN MATCH/);assert.match(friends,/AWAY|toUpperCase/)
assert.match(server,/presenceExpiryTimer/)
console.log('Player presence tests passed (leases, states, privacy, SSE and UI contracts)')
