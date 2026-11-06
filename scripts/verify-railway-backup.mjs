import crypto from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg
const EXPECTED = {
  projectId: '634676fe-6513-4736-bb03-34a37e0d6e0b',
  environmentId: 'dabcff72-d7d3-4cdf-b3d9-e80b734be6b9',
  backendServiceId: '152568e7-91cf-44b3-b1a1-10479738aa38',
  postgresServiceId: '9e1caa9f-a006-4b6f-9d7d-721248d12a04',
  database: 'railway',
  systemFingerprint: 'aebc88b02e05ac8a',
}
const pgBin = 'C:\\Program Files\\PostgreSQL\\18\\bin'
const backupDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SectorNine', 'Backups')

const railwayVariables = service => new Promise((resolve, reject) => {
  execFile(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx.cmd', '--yes', '@railway/cli', 'variables', '--service', service, '--environment', 'production', '--json'],
    { cwd: process.cwd(), windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
    (error, stdout) => {
      if (error) return reject(new Error(`Railway variable lookup failed for ${service}`))
      try { resolve(JSON.parse(stdout)) } catch { reject(new Error(`Railway returned invalid variable metadata for ${service}`)) }
    })
})

const fingerprintConnection = value => {
  const url = new URL(value)
  const identity = `${url.hostname.toLowerCase()}:${url.port || '5432'}:${url.pathname.slice(1)}:${url.username}`
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16)
}

const run = (command, args, env, capture = false) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: process.cwd(), env, windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  })
  let stdout = ''
  let stderr = ''
  if (capture) {
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
  }
  child.once('error', reject)
  child.once('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${path.basename(command)} exited with code ${code}`)))
})

const postgres = await railwayVariables('Postgres')
const backend = await railwayVariables('sector-nine-api')
if (postgres.RAILWAY_PROJECT_ID !== EXPECTED.projectId || postgres.RAILWAY_ENVIRONMENT_ID !== EXPECTED.environmentId || postgres.RAILWAY_SERVICE_ID !== EXPECTED.postgresServiceId) {
  throw new Error('Railway Postgres target identity mismatch')
}
if (backend.RAILWAY_SERVICE_ID !== EXPECTED.backendServiceId) throw new Error('Railway backend service identity mismatch')

const internalFingerprint = fingerprintConnection(postgres.DATABASE_URL)
if (internalFingerprint !== fingerprintConnection(backend.DATABASE_URL)) throw new Error('Backend DATABASE_URL does not resolve to the verified Postgres service')

const client = new Client({ connectionString: postgres.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
const identity = (await client.query(`
  SELECT current_database() database,
         current_setting('server_version') version,
         (SELECT system_identifier::text FROM pg_control_system()) system_identifier
`)).rows[0]
await client.end()
const systemFingerprint = crypto.createHash('sha256').update(identity.system_identifier).digest('hex').slice(0, 16)
if (identity.database !== EXPECTED.database || systemFingerprint !== EXPECTED.systemFingerprint) throw new Error('Live PostgreSQL system identity mismatch')

await mkdir(backupDir, { recursive: true })
const before = new Set(await readdir(backupDir))
await run(process.execPath, ['scripts/backup-postgres.mjs'], {
  ...process.env,
  BACKUP_DATABASE_URL: postgres.DATABASE_PUBLIC_URL,
  BACKUP_DIR: backupDir,
  PG_DUMP_PATH: path.join(pgBin, 'pg_dump.exe'),
})
const created = (await readdir(backupDir)).filter(name => name.endsWith('.dump') && !before.has(name))
if (created.length !== 1) throw new Error(`Expected one new backup, found ${created.length}`)
const backupPath = path.join(backupDir, created[0])
const details = await stat(backupPath)
if (details.size === 0) throw new Error('Backup is empty')
const listing = await run(path.join(pgBin, 'pg_restore.exe'), ['--list', backupPath], process.env, true)
const restoreListEntries = listing.stdout.split(/\r?\n/).filter(line => line && !line.startsWith(';')).length
if (restoreListEntries === 0) throw new Error('pg_restore did not find archive entries')

const hash = crypto.createHash('sha256')
hash.update(await import('node:fs/promises').then(fs => fs.readFile(backupPath)))
console.log(JSON.stringify({
  project: postgres.RAILWAY_PROJECT_NAME,
  environment: postgres.RAILWAY_ENVIRONMENT_NAME,
  backend: backend.RAILWAY_SERVICE_NAME,
  databaseService: postgres.RAILWAY_SERVICE_NAME,
  database: identity.database,
  postgresql: identity.version,
  internalReferenceFingerprint: internalFingerprint,
  publicConnectionFingerprint: fingerprintConnection(postgres.DATABASE_PUBLIC_URL),
  systemIdentityFingerprint: systemFingerprint,
  backupPath,
  backupBytes: details.size,
  backupSha256: hash.digest('hex'),
  restoreListEntries,
}, null, 2))
