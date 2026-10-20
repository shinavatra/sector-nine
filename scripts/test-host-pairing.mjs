import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPairingCode,hashSecret,HostPairingError,issueHostCredential,timingSafeHashMatches,validCapabilities,validatePairableHost,PAIRING_TTL_MINUTES} from '../dist/server/hostAgentAuth.js'

const [server,admin,migration,profileMigration,adminPage,adminTable,adminStyles]=await Promise.all([
  readFile(new URL('../src/server/index.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/server/admin.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/server/045_hosts_and_pairing.sql',import.meta.url),'utf8'),
  readFile(new URL('../src/server/047_host_server_profiles.sql',import.meta.url),'utf8'),
  readFile(new URL('../src/pages/Admin.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/admin/AdminTable.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/styles/admin-layout.css',import.meta.url),'utf8')
])
const code=createPairingCode(),issued=issueHostCredential()
assert.match(code,/^SN-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
assert.equal(PAIRING_TTL_MINUTES,10)
assert.notEqual(hashSecret(code),code)
assert.ok(issued.credential.length>=43)
assert.ok(timingSafeHashMatches(issued.credential,issued.hash))
assert.equal(validCapabilities({hl1:['classic-deathmatch']}),true)
assert.equal(validCapabilities({hl1:['../../bad']}),false)
const future=new Date(Date.now()+60_000).toISOString(),past=new Date(Date.now()-60_000).toISOString()
assert.doesNotThrow(()=>validatePairableHost({enabled:true,pairing_used_at:null,pairing_expires_at:future}))
for(const [host,expectedCode] of [
  [{enabled:true,pairing_used_at:new Date().toISOString(),pairing_expires_at:future},'PAIRING_USED'],
  [{enabled:true,pairing_used_at:null,pairing_expires_at:past},'PAIRING_EXPIRED'],
  [{enabled:false,pairing_used_at:null,pairing_expires_at:future},'HOST_DISABLED']
])assert.throws(()=>validatePairableHost(host),error=>error instanceof HostPairingError&&error.code===expectedCode)
let pairingRow={enabled:true,pairing_used_at:null,pairing_expires_at:future},lock=Promise.resolve()
const pairOnce=async()=>{let releaseLock;const previous=lock;lock=new Promise(resolve=>{releaseLock=resolve});await previous;try{validatePairableHost(pairingRow);pairingRow={...pairingRow,pairing_used_at:new Date().toISOString()};return'paired'}finally{releaseLock()}}
const concurrent=await Promise.allSettled([pairOnce(),pairOnce()])
assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1)
assert.equal(concurrent.filter(result=>result.status==='rejected'&&result.reason instanceof HostPairingError&&result.reason.code==='PAIRING_USED').length,1)
assert.match(server,/pairing_code_hash=\$1 FOR UPDATE/)
assert.doesNotMatch(server,/pairing_used_at=NOW\(\),pairing_code_hash=NULL/)
assert.match(server,/serverAgentCredentialValid\(row,token\)/)
assert.match(server,/serverAgentCredentialValid\(server,token\)/)
assert.match(server,/!host\.enabled\|\|host\.credential_revoked_at/)
assert.match(server,/jsonb_array_elements\(h\.profiles\)/)
assert.match(server,/INSERT INTO host_server_profiles/)
assert.match(server,/approval_status='approved' AND hp\.matchmaking_enabled=TRUE/)
assert.match(server,/FOR UPDATE OF s SKIP LOCKED LIMIT 1/)
assert.match(admin,/host\.pairing_code\.generate/)
assert.match(admin,/router\.delete\('\/hosts\/:id'/)
assert.match(admin,/HOST_HAS_LINKED_SERVERS/)
assert.match(admin,/host\.delete/)
const safeHostColumns=admin.match(/const safeHostColumns=([^\n]+)/)?.[1]??''
assert.doesNotMatch(safeHostColumns,/credential_hash\s*(?:,|FROM)/)
assert.match(migration,/ADD COLUMN IF NOT EXISTS host_id/)
assert.match(migration,/game_servers_host_profile_unique/)
assert.match(profileMigration,/UNIQUE\(host_id,profile_id\)/)
assert.match(profileMigration,/approval_status IN \('pending_approval','approved','rejected'\)/)
assert.match(profileMigration,/INSERT INTO host_server_profiles/)
assert.match(admin,/profiles\/:profileId\/approve/)
assert.match(admin,/profiles\/:profileId\/reject/)
assert.match(adminTable,/Generiši pairing kod/)
assert.match(adminTable,/Re-pair \/ Generiši novi pairing kod/)
assert.match(adminTable,/Delete host/)
assert.match(adminPage,/No active game-server instances/)
assert.match(adminPage,/Host UUID/)
assert.match(adminPage,/Kopiraj kod/)
assert.match(adminStyles,/\.admin-host-details-drawer/)
assert.match(adminStyles,/z-index:\s*110\s*!important/)
console.log('Host pairing and assignment security checks passed')
