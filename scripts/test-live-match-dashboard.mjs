import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {deriveLiveMatchStatus,liveMatchDurationSeconds} from '../dist/server/liveMatchStatus.js'

const now=Date.parse('2026-10-19T12:00:00Z'),fresh=new Date(now-5_000).toISOString(),stale=new Date(now-60_000).toISOString()
const base={status:'pending',accepted_count:0,server_id:null,selected_map:null,server_error:null,host_id:null,host_enabled:true}
assert.equal(deriveLiveMatchStatus(base,now),'waiting')
assert.equal(deriveLiveMatchStatus({...base,accepted_count:1},now),'accepting')
assert.equal(deriveLiveMatchStatus({...base,accepted_count:2},now),'veto')
assert.equal(deriveLiveMatchStatus({...base,accepted_count:2,selected_map:'dm_crossfire'},now),'assigned')
assert.equal(deriveLiveMatchStatus({...base,server_id:'server',host_id:'host',host_last_seen_at:fresh,profile_lifecycle_status:'starting'},now),'starting')
assert.equal(deriveLiveMatchStatus({...base,status:'in_progress',server_id:'server',server_last_heartbeat:fresh},now),'running')
assert.equal(deriveLiveMatchStatus({...base,status:'in_progress',server_id:'server',server_last_heartbeat:stale},now),'error')
assert.equal(deriveLiveMatchStatus({...base,status:'completed'},now),'finished')
assert.equal(deriveLiveMatchStatus({...base,status:'cancelled'},now),'cancelled')
assert.equal(liveMatchDurationSeconds({started_at:new Date(now-65_000).toISOString()},now),65)

const [admin,page,management]=await Promise.all([
  readFile(new URL('../src/server/admin.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/pages/Admin.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/admin/AdminMatchManagement.tsx',import.meta.url),'utf8'),
])
assert.match(admin,/router\.post\('\/matches\/:id\/cancel'/)
assert.match(admin,/Only a match that has not started can be cancelled/)
assert.match(admin,/Force finish requires an already validated authoritative game-server result/)
assert.match(admin,/An active match cannot release its server/)
assert.match(admin,/match\.server\.release/)
assert.match(admin,/Trusted game-server results and participants cannot be edited/)
assert.match(page,/document\.hidden/)
assert.match(page,/section==='matches'\?4000:5000/)
assert.match(management,/\/force-finish/)
assert.match(management,/\/release-server/)
console.log('Live Match Dashboard lifecycle and safety checks passed')
