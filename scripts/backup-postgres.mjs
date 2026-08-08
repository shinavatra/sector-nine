import 'dotenv/config'
import { mkdir, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const connectionUrl =
  process.env.BACKUP_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const pgEnvironment = { ...process.env }
let databaseName = process.env.PGDATABASE

if (connectionUrl) {
  let parsed
  try {
    parsed = new URL(connectionUrl)
  } catch {
    fail('The configured PostgreSQL URL is invalid.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('The backup URL must use the postgres:// or postgresql:// protocol.')
  }

  pgEnvironment.PGHOST = decodeURIComponent(parsed.hostname)
  pgEnvironment.PGPORT = parsed.port || '5432'
  pgEnvironment.PGUSER = decodeURIComponent(parsed.username)
  pgEnvironment.PGPASSWORD = decodeURIComponent(parsed.password)
  databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  pgEnvironment.PGDATABASE = databaseName
  pgEnvironment.PGSSLMODE =
    process.env.PGSSLMODE ||
    parsed.searchParams.get('sslmode') ||
    'prefer'
}

if (!pgEnvironment.PGHOST || !pgEnvironment.PGUSER || !databaseName) {
  fail(
    'Configure BACKUP_DATABASE_URL, DATABASE_PUBLIC_URL, DATABASE_URL, or the PGHOST/PGUSER/PGDATABASE variables.',
  )
}

const timestamp = new Date()
  .toISOString()
  .replace(/:/g, '-')
  .replace(/\.(\d{3})Z$/, '-$1Z')
const safeDatabaseName = databaseName.replace(/[^a-zA-Z0-9_-]+/g, '-')
const backupDirectory = resolve(
  process.env.BACKUP_DIR || 'scripts/backups',
)
const filename = `${safeDatabaseName}-${timestamp}.dump`
const outputPath = resolve(backupDirectory, filename)
const partialPath = `${outputPath}.partial`

await mkdir(backupDirectory, { recursive: true })

const pgDump = process.env.PG_DUMP_PATH || 'pg_dump'
const args = [
  '--format=custom',
  '--compress=9',
  '--no-owner',
  '--no-privileges',
  `--file=${partialPath}`,
]

console.log(`Creating compressed PostgreSQL backup: ${outputPath}`)

let exitCode
try {
  exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(pgDump, args, {
      env: pgEnvironment,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    })

    child.once('error', reject)
    child.once('close', resolveExit)
  })
} catch (error) {
  await rm(partialPath, { force: true })
  fail(
    `Unable to start pg_dump. Install PostgreSQL client tools or set PG_DUMP_PATH. ${error.message}`,
  )
}

if (exitCode !== 0) {
  await rm(partialPath, { force: true })
  fail(`pg_dump exited with code ${exitCode}. No backup was retained.`)
}

await rename(partialPath, outputPath)
console.log(`Backup completed: ${outputPath}`)

function fail(message) {
  console.error(`Backup failed: ${message}`)
  process.exit(1)
}
