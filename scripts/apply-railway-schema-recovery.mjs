import crypto from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg
const expected = {
  projectId: '634676fe-6513-4736-bb03-34a37e0d6e0b',
  environmentId: 'dabcff72-d7d3-4cdf-b3d9-e80b734be6b9',
  backendServiceId: '152568e7-91cf-44b3-b1a1-10479738aa38',
  postgresServiceId: '9e1caa9f-a006-4b6f-9d7d-721248d12a04',
  database: 'railway',
  systemFingerprint: 'aebc88b02e05ac8a',
}
const stateRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SectorNine', 'BackgroundDev')
const rehearsalPath = path.join(stateRoot, 'railway-schema-rehearsal.json')
const reportPath = path.join(stateRoot, 'railway-schema-production-recovery.json')
const pgRestore = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe'

const exec = (file, args, options = {}) => new Promise((resolve, reject) => {
  execFile(file, args, { cwd: process.cwd(), windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...options },
    (error, stdout, stderr) => error ? reject(new Error(`${path.basename(file)} failed`)) : resolve({ stdout, stderr }))
})
const run = (file, args, env, capture = false) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { cwd: process.cwd(), env, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'] })
  let stdout = ''
  if (capture) child.stdout.on('data', chunk => { stdout += chunk })
  child.once('error', reject)
  child.once('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${path.basename(file)} exited with code ${code}`)))
})
const railwayVariables = async service => JSON.parse((await exec(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx.cmd', '--yes', '@railway/cli', 'variables', '--service', service, '--environment', 'production', '--json'])).stdout)
const connectionFingerprint = value => {
  const url = new URL(value)
  return crypto.createHash('sha256').update(`${url.hostname.toLowerCase()}:${url.port || '5432'}:${url.pathname.slice(1)}:${url.username}`).digest('hex').slice(0, 16)
}
const tableCounts = async client => {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename")).rows
  return Object.fromEntries(await Promise.all(tables.map(async ({ tablename }) => [tablename, Number((await client.query(`SELECT COUNT(*)::bigint n FROM ${client.escapeIdentifier(tablename)}`)).rows[0].n)])))
}

const rehearsal = JSON.parse((await readFile(rehearsalPath, 'utf8')).replace(/^\uFEFF/, ''))
if (!rehearsal.schemaCompatible || !rehearsal.recordCountsPreserved) throw new Error('A successful schema rehearsal is required before production recovery')
const backupDetails = await stat(rehearsal.backupPath)
if (backupDetails.size !== Number(rehearsal.backupBytes) || backupDetails.size === 0) throw new Error('Verified rehearsal backup is missing or changed')
const backupHash = crypto.createHash('sha256').update(await readFile(rehearsal.backupPath)).digest('hex')
if (backupHash !== rehearsal.backupSha256) throw new Error('Verified rehearsal backup checksum changed')
const listing = await run(pgRestore, ['--list', rehearsal.backupPath], process.env, true)
if (!listing.split(/\r?\n/).some(line => line && !line.startsWith(';'))) throw new Error('Backup archive is unreadable')

const postgres = await railwayVariables('Postgres')
const backend = await railwayVariables('sector-nine-api')
if (postgres.RAILWAY_PROJECT_ID !== expected.projectId || postgres.RAILWAY_ENVIRONMENT_ID !== expected.environmentId || postgres.RAILWAY_SERVICE_ID !== expected.postgresServiceId) throw new Error('Railway Postgres target identity mismatch')
if (backend.RAILWAY_SERVICE_ID !== expected.backendServiceId) throw new Error('Railway backend service identity mismatch')
const internalFingerprint = connectionFingerprint(postgres.DATABASE_URL)
if (internalFingerprint !== connectionFingerprint(backend.DATABASE_URL)) throw new Error('Backend DATABASE_URL does not resolve to the verified Postgres service')

const connectionString = postgres.DATABASE_PUBLIC_URL
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
const identity = (await client.query("SELECT current_database() database,current_setting('server_version') version,(SELECT system_identifier::text FROM pg_control_system()) system_identifier")).rows[0]
const systemFingerprint = crypto.createHash('sha256').update(identity.system_identifier).digest('hex').slice(0, 16)
if (identity.database !== expected.database || systemFingerprint !== expected.systemFingerprint) throw new Error('Live PostgreSQL system identity mismatch')
const beforeCounts = await tableCounts(client)
const ledgerBefore = (await client.query('SELECT COUNT(*)::int count FROM schema_migrations')).rows[0].count
if (ledgerBefore !== 0) throw new Error(`Expected an empty migration ledger, found ${ledgerBefore} rows`)

try {
  const reconciliation = await readFile('src/server/055_reconcile_game_server_schema.sql', 'utf8')
  await client.query(reconciliation)
} finally {
  await client.end()
}

const migrationEnv = { ...process.env, DATABASE_URL: connectionString, MIGRATION_BASELINE_CONFIRM: 'BASELINE_EXISTING_SCHEMA' }
await run(process.execPath, ['scripts/migrate-postgres.mjs', '--baseline', '--through=052_player_presence_leases.sql', '--execute-baseline'], migrationEnv)
delete migrationEnv.MIGRATION_BASELINE_CONFIRM
await run(process.execPath, ['scripts/migrate-postgres.mjs'], migrationEnv)

const verify = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await verify.connect()
try {
  const afterCounts = await tableCounts(verify)
  const changedCounts = Object.keys(beforeCounts).filter(table => beforeCounts[table] !== afterCounts[table])
  if (changedCounts.length) throw new Error(`Record counts changed: ${changedCounts.join(', ')}`)
  const ledger = (await verify.query('SELECT COUNT(*)::int count,MIN(name) first,MAX(name) last FROM schema_migrations')).rows[0]
  const checks = (await verify.query(`
    SELECT (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])) indexes,
           (SELECT confdeltype FROM pg_constraint WHERE conrelid='matches'::regclass AND conname='matches_server_id_fkey') fk_action,
           (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_servers' AND column_name='port') port_default,
           (SELECT COUNT(*)::int FROM game_servers) servers,
           (SELECT COUNT(*)::int FROM matches) matches,
           (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='hl1-ag-1v1') hl1_1v1,
           (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='hl1-ag-2v2') hl1_2v2,
           (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='cs16-clan-war') cs16
  `, [['idx_matches_game', 'idx_tournaments_game', 'idx_ladder_seasons_game', 'idx_queue_entries_game', 'idx_game_servers_lookup', 'idx_matches_pending_server_deadlines']])).rows[0]
  if (checks.indexes !== 6 || checks.fk_action !== 'n' || !checks.hl1_1v1 || checks.hl1_2v2 || checks.cs16) throw new Error('Production post-migration invariants failed')
  const report = {
    project: postgres.RAILWAY_PROJECT_NAME,
    environment: postgres.RAILWAY_ENVIRONMENT_NAME,
    databaseService: postgres.RAILWAY_SERVICE_NAME,
    database: identity.database,
    postgresql: identity.version,
    internalReferenceFingerprint: internalFingerprint,
    publicConnectionFingerprint: connectionFingerprint(connectionString),
    systemIdentityFingerprint: systemFingerprint,
    backupPath: rehearsal.backupPath,
    ledgerBefore,
    ledgerAfter: ledger,
    recordCountsPreserved: true,
    checks,
    completedAt: new Date().toISOString(),
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await verify.end()
}
