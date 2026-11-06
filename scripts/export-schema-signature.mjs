import process from 'node:process'
import pg from 'pg'
import { writeFile } from 'node:fs/promises'

const { Client } = pg
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const connectionHost = new URL(connectionString).hostname

const normalizeThrough052 = process.argv.includes('--normalize-through-052')
const outputArgument = process.argv.find(argument => argument.startsWith('--output='))
const outputPath = outputArgument?.slice('--output='.length)
const client = new Client({
  connectionString,
  ssl: /railway|proxy\.rlwy\.net/i.test(connectionHost) ? { rejectUnauthorized: false } : undefined,
})

const rows = async sql => (await client.query(sql)).rows
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const keyed = (items, key) => Object.fromEntries(items.map(item => [item[key], item]))

try {
  await client.connect()
  const [extensions, columns, constraints, indexes, sequences, functions, views, triggers] = await Promise.all([
    rows(`SELECT extname name,extversion version FROM pg_extension ORDER BY extname`),
    rows(`SELECT c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) data_type,
                 a.attnotnull not_null,pg_get_expr(ad.adbin,ad.adrelid,true) default_value
          FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
          LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
          WHERE n.nspname='public' AND c.relkind IN('r','p') AND c.relname<>'schema_migrations'
          ORDER BY c.relname,a.attnum`),
    rows(`SELECT con.conname name,rel.relname table_name,con.contype type,
                 pg_get_constraintdef(con.oid,true) definition
          FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
          JOIN pg_namespace n ON n.oid=rel.relnamespace
          WHERE n.nspname='public' ORDER BY rel.relname,con.conname`),
    rows(`SELECT tablename table_name,indexname name,indexdef definition
          FROM pg_indexes WHERE schemaname='public' AND tablename<>'schema_migrations'
          ORDER BY tablename,indexname`),
    rows(`SELECT c.relname name,format_type(s.seqtypid,NULL) data_type,s.seqstart start_value,
                 s.seqincrement increment_by,s.seqmin min_value,s.seqmax max_value,s.seqcache cache_size,s.seqcycle cycle,
                 COALESCE(dep.refobjid::regclass::text,'') owned_by
          FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
          LEFT JOIN LATERAL (
            SELECT d.refobjid,d.refobjsubid FROM pg_depend d
            WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='a' LIMIT 1
          ) dep ON TRUE
          WHERE n.nspname='public' ORDER BY c.relname`),
    rows(`SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,
                 pg_get_functiondef(p.oid) definition
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' ORDER BY 1`),
    rows(`SELECT viewname name,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname`),
    rows(`SELECT c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid,true) definition
          FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`),
  ])

  const filteredColumns = columns.filter(row => !(
    normalizeThrough052 && row.table_name === 'matches' && ['server_reserved_at', 'server_ready_at'].includes(row.column_name)
  ))
  const filteredIndexes = indexes.filter(row => !(
    normalizeThrough052 && row.name === 'idx_matches_pending_server_deadlines'
  ))
  const tableColumns = {}
  for (const row of filteredColumns) {
    ;(tableColumns[row.table_name] ??= {})[row.column_name] = {
      dataType: row.data_type,
      notNull: row.not_null,
      default: compact(row.default_value) || null,
    }
  }
  if (normalizeThrough052 && tableColumns.game_servers) {
    for (const column of ['created_at', 'updated_at']) {
      if (tableColumns.game_servers[column]) tableColumns.game_servers[column].notNull = false
    }
  }

  const seed = {}
  for (const table of ['profile_rank_definitions', 'profile_special_badges', 'competitive_medal_definitions']) {
    const exists = tableColumns[table]
    seed[table] = exists ? await rows(`SELECT id FROM ${table} ORDER BY id`) : []
  }
  seed.game_matchmaking_config = tableColumns.game_matchmaking_config
    ? await rows(`SELECT game_id,enabled,modes,default_mode,required_map_count FROM game_matchmaking_config ORDER BY game_id`)
    : []
  seed.matchmaking_mode_rules = tableColumns.matchmaking_mode_rules
    ? await rows(`SELECT rule_id,game_id,game_mode,team_size,total_players,max_party_size,minimum_ready_players,
                         team_count,allow_mixed_parties,matchmaking_available,server_pipeline_ready,display_name,availability_reason
                  FROM matchmaking_mode_rules ORDER BY rule_id`)
    : []
  if (normalizeThrough052) {
    const twoVersusTwo = seed.matchmaking_mode_rules.find(row => row.rule_id === 'hl1-ag-2v2')
    if (twoVersusTwo) {
      twoVersusTwo.matchmaking_available = true
      twoVersusTwo.server_pipeline_ready = true
      twoVersusTwo.availability_reason = null
    }
  }

  const normalizedConstraints = constraints.map(row => {
    if (normalizeThrough052 && row.table_name === 'matches' && row.name === 'matches_server_id_fkey') {
      return { ...row, definition: 'FOREIGN KEY (server_id) REFERENCES game_servers(id)' }
    }
    return { ...row, definition: compact(row.definition) }
  })

  const signature = {
    format: 1,
    normalizedThrough: normalizeThrough052 ? '052' : null,
    extensions: keyed(extensions.map(row => ({ name: row.name, version: row.version })), 'name'),
    tables: tableColumns,
    constraints: Object.fromEntries(normalizedConstraints.map(row => [
      `${row.table_name}.${row.name}`,
      row,
    ])),
    indexes: keyed(filteredIndexes.map(row => ({ ...row, definition: compact(row.definition) })), 'name'),
    sequences: keyed(sequences, 'name'),
    functions: keyed(functions.map(row => ({ ...row, definition: compact(row.definition) })), 'name'),
    views: keyed(views.map(row => ({ ...row, definition: compact(row.definition) })), 'name'),
    triggers: Object.fromEntries(triggers.map(row => [
      `${row.table_name}.${row.name}`,
      { ...row, definition: compact(row.definition) },
    ])),
    seed,
  }
  const serialized = `${JSON.stringify(signature, null, 2)}\n`
  if (outputPath) await writeFile(outputPath, serialized, 'utf8')
  else process.stdout.write(serialized)
} finally {
  await client.end()
}
