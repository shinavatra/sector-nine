import { spawn } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const connectionString = process.env.RESTORE_SOURCE_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error('RESTORE_SOURCE_DATABASE_URL or DATABASE_URL is required')

const sourceUrl = new URL(connectionString)
if (!['postgres:', 'postgresql:'].includes(sourceUrl.protocol)) throw new Error('PostgreSQL connection URL is required')
const backupDirectory = path.resolve(process.env.BACKUP_DIR || 'scripts/backups')
const requestedBackup = process.env.RESTORE_BACKUP_PATH
const backupPath = requestedBackup ? path.resolve(requestedBackup) : await latestBackup(backupDirectory)
const databaseName = `sectornine_restore_drill_${Date.now()}`
const quotedDatabaseName = `"${databaseName}"`
const adminUrl = new URL(sourceUrl)
adminUrl.pathname = '/postgres'
const ssl = /railway/i.test(connectionString) ? { rejectUnauthorized: false } : undefined
const adminPool = new Pool({ connectionString: adminUrl.toString(), ssl, max: 1 })

let created = false
try {
  await adminPool.query(`CREATE DATABASE ${quotedDatabaseName}`)
  created = true

  const restoreEnvironment = {
    ...process.env,
    PGHOST: decodeURIComponent(sourceUrl.hostname),
    PGPORT: sourceUrl.port || '5432',
    PGUSER: decodeURIComponent(sourceUrl.username),
    PGPASSWORD: decodeURIComponent(sourceUrl.password),
    PGDATABASE: databaseName,
    PGSSLMODE: process.env.PGSSLMODE || sourceUrl.searchParams.get('sslmode') || 'prefer',
  }
  const pgRestore = process.env.PG_RESTORE_PATH || 'pg_restore'
  await run(pgRestore, ['--dbname', databaseName, '--exit-on-error', '--no-owner', '--no-privileges', backupPath], restoreEnvironment)

  const drillUrl = new URL(sourceUrl)
  drillUrl.pathname = `/${databaseName}`
  const drillPool = new Pool({ connectionString: drillUrl.toString(), ssl, max: 1 })
  try {
    const requiredTables = ['users', 'matches', 'notifications', 'support_tickets', 'user_blocks', 'steam_auth_nonces']
    const result = await drillPool.query(
      `SELECT name, to_regclass('public.' || name) IS NOT NULL AS present
       FROM unnest($1::text[]) AS name`,
      [requiredTables],
    )
    const missing = result.rows.filter(row => !row.present).map(row => row.name)
    if (missing.length) throw new Error(`Restored database is missing required tables: ${missing.join(', ')}`)
    await drillPool.query('SELECT auth_version,reset_token_hash FROM users LIMIT 1')
    console.log(`Restore drill passed for ${path.basename(backupPath)}; verified ${requiredTables.length} required tables.`)
  } finally {
    await drillPool.end()
  }
} finally {
  if (created) {
    await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1', [databaseName])
    await adminPool.query(`DROP DATABASE IF EXISTS ${quotedDatabaseName}`)
  }
  await adminPool.end()
}

async function latestBackup(directory) {
  const candidates = (await readdir(directory))
    .filter(name => name.endsWith('.dump'))
    .map(async name => ({ name, details: await stat(path.join(directory, name)) }))
  const files = await Promise.all(candidates)
  const latest = files.sort((a, b) => b.details.mtimeMs - a.details.mtimeMs)[0]
  if (!latest) throw new Error(`No .dump backup found in ${directory}`)
  return path.join(directory, latest.name)
}

async function run(command, args, env) {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true })
    child.once('error', reject)
    child.once('close', resolve)
  })
  if (exitCode !== 0) throw new Error(`pg_restore exited with code ${exitCode}`)
}
