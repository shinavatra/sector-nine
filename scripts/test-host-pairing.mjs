import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPairingCode,hashSecret,issueHostCredential,timingSafeHashMatches,validCapabilities,PAIRING_TTL_MINUTES} from '../dist/server/hostAgentAuth.js'

const [server,admin,migration,adminPage,adminTable,adminStyles]=await Promise.all([
  readFile(new URL('../src/server/index.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/server/admin.ts',import.meta.url),'utf8'),
  readFile(new URL('../src/server/045_hosts_and_pairing.sql',import.meta.url),'utf8'),
  readFile(new URL('../src/pages/Admin.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/components/admin/AdminTable.tsx',import.meta.url),'utf8'),
  readFile(new URL('../src/styles/admin-layout.css',import.meta.url),'utf8')
])
const code=createPairingCode(),issued=issueHostCredential()
assert.match(code,/^SN-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
assert.equal(PAIRING_TTL_MINUTES,20)
assert.notEqual(hashSecret(code),code)
assert.ok(issued.credential.length>=43)
assert.ok(timingSafeHashMatches(issued.credential,issued.hash))
assert.equal(validCapabilities({hl1:['classic-deathmatch']}),true)
assert.equal(validCapabilities({hl1:['../../bad']}),false)
assert.match(server,/pairing_code_hash=\$1 FOR UPDATE/)
assert.match(server,/pairing_code_hash=NULL/)
assert.match(server,/serverAgentCredentialValid\(row,token\)/)
assert.match(server,/serverAgentCredentialValid\(server,token\)/)
assert.match(server,/jsonb_array_elements\(h\.profiles\)/)
assert.match(admin,/host\.pairing_code\.generate/)
assert.match(admin,/router\.delete\('\/hosts\/:id'/)
assert.match(admin,/HOST_HAS_LINKED_SERVERS/)
assert.match(admin,/host\.delete/)
const safeHostColumns=admin.match(/const safeHostColumns=([^\n]+)/)?.[1]??''
assert.doesNotMatch(safeHostColumns,/credential_hash\s*(?:,|FROM)/)
assert.match(migration,/ADD COLUMN IF NOT EXISTS host_id/)
assert.match(migration,/game_servers_host_profile_unique/)
assert.match(adminTable,/Generiši pairing kod/)
assert.match(adminTable,/Re-pair \/ Generiši novi pairing kod/)
assert.match(adminTable,/Delete host/)
assert.match(adminPage,/No active game-server instances/)
assert.match(adminPage,/Host UUID/)
assert.match(adminPage,/Kopiraj kod/)
assert.match(adminStyles,/\.admin-host-details-drawer/)
assert.match(adminStyles,/z-index:\s*110\s*!important/)
console.log('Host pairing and assignment security checks passed')
