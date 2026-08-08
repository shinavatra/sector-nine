import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'src', 'server')
const statusOnly = process.argv.includes('--status')
const baselineMode = process.argv.includes('--baseline')
const executeBaseline = process.argv.includes('--execute-baseline')
const throughArgument = process.argv.find(argument => argument.startsWith('--through='))
const baselineThrough = throughArgument?.slice('--through='.length)
const connectionString = process.env.DATABASE_URL

if (!connectionString) throw new Error('DATABASE_URL is required')
if (statusOnly && baselineMode) throw new Error('--status and --baseline cannot be combined')
if (executeBaseline && !baselineMode) throw new Error('--execute-baseline requires --baseline')
if (baselineMode && !baselineThrough) throw new Error('--baseline requires --through=<migration filename>')

const pool = new Pool({
  connectionString,
  ssl: /railway/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
})

const checksum = source => crypto.createHash('sha256').update(source).digest('hex')

const run = async () => {
  const files = (await fs.readdir(migrationsDir))
    .filter(name => /^\d{3}_.+\.sql$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'))
  const migrations = await Promise.all(files.map(async name => {
    const source = await fs.readFile(path.join(migrationsDir, name), 'utf8')
    return { name, source, checksum: checksum(source) }
  }))
  const db = await pool.connect()

  try {
    await db.query('SELECT pg_advisory_lock($1)', [7392033])
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    const appliedRows = (await db.query('SELECT name,checksum,applied_at FROM schema_migrations ORDER BY name')).rows
    const applied = new Map(appliedRows.map(row => [row.name, row]))

    for (const migration of migrations) {
      const previous = applied.get(migration.name)
      if (previous && previous.checksum !== migration.checksum) {
        throw new Error(`Checksum mismatch for applied migration ${migration.name}`)
      }
    }

    if (baselineMode) {
      const targetIndex = migrations.findIndex(migration => migration.name === baselineThrough)
      if (targetIndex === -1) throw new Error(`Unknown baseline migration ${baselineThrough}`)
      const baselineMigrations = migrations.slice(0, targetIndex + 1)
      const missing = baselineMigrations.filter(migration => !applied.has(migration.name))

      if (missing.length === 0) {
        console.log(`Database is already baselined through ${baselineThrough}.`)
        return
      }

      console.log(`Baseline candidate through ${baselineThrough}:`)
      for (const migration of missing) console.log(`record   ${migration.name}`)

      if (!executeBaseline) {
        console.log('Dry run only. Reconcile the live schema first, then rerun with --execute-baseline and MIGRATION_BASELINE_CONFIRM=BASELINE_EXISTING_SCHEMA.')
        return
      }
      if (process.env.MIGRATION_BASELINE_CONFIRM !== 'BASELINE_EXISTING_SCHEMA') {
        throw new Error('Set MIGRATION_BASELINE_CONFIRM=BASELINE_EXISTING_SCHEMA after independently reconciling the target schema')
      }

      await db.query('BEGIN')
      try {
        for (const migration of missing) {
          await db.query(
            'INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',
            [migration.name, migration.checksum],
          )
        }
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
      console.log(`Recorded ${missing.length} existing migrations through ${baselineThrough}.`)
      return
    }

    if (statusOnly) {
      for (const migration of migrations) {
        console.log(`${applied.has(migration.name) ? 'applied' : 'pending'}  ${migration.name}`)
      }
      return
    }

    for (const migration of migrations) {
      if (applied.has(migration.name)) continue
      console.log(`Applying ${migration.name}`)
      await db.query('BEGIN')
      try {
        await db.query(migration.source)
        await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [migration.name, migration.checksum])
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
    }
    console.log('Database migrations are current.')
  } finally {
    try { await db.query('SELECT pg_advisory_unlock($1)', [7392033]) } catch {}
    db.release()
  }
}

run()
  .catch(error => {
    console.error(`Migration failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => pool.end())
