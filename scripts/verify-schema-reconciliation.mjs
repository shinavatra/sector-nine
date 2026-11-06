import process from 'node:process'
import pg from 'pg'

const { Client } = pg
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const mode = process.argv[2]
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const tableCounts = async () => {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename")).rows
  const counts = {}
  for (const { tablename } of tables) counts[tablename] = Number((await client.query(`SELECT COUNT(*)::bigint n FROM ${client.escapeIdentifier(tablename)}`)).rows[0].n)
  return counts
}

try {
  if (mode === 'counts') {
    console.log(JSON.stringify(await tableCounts()))
  } else if (mode === 'final') {
    const counts = await tableCounts()
    const ledger = (await client.query('SELECT COUNT(*)::int n,MIN(name) first,MAX(name) last FROM schema_migrations')).rows[0]
    const checks = (await client.query(`
      SELECT (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])) indexes,
             (SELECT confdeltype FROM pg_constraint WHERE conrelid='matches'::regclass AND conname='matches_server_id_fkey') fk_action,
             (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='game_servers' AND column_name='port') port_default,
             (SELECT COUNT(*)::int FROM game_servers) servers,
             (SELECT COUNT(*)::int FROM matches) matches,
             (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='hl1-ag-1v1') hl1_1v1,
             (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='hl1-ag-2v2') hl1_2v2,
             (SELECT matchmaking_available FROM matchmaking_mode_rules WHERE rule_id='cs16-clan-war') cs16
    `, [['idx_matches_game', 'idx_tournaments_game', 'idx_ladder_seasons_game', 'idx_queue_entries_game', 'idx_game_servers_lookup', 'idx_matches_pending_server_deadlines']])).rows[0]
    console.log(JSON.stringify({ counts, ledger, checks }))
  } else {
    throw new Error('Use counts or final')
  }
} finally {
  await client.end()
}
