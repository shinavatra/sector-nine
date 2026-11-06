import fs from 'node:fs'
import process from 'node:process'

const [expectedPath, actualPath] = process.argv.slice(2)
if (!expectedPath || !actualPath) throw new Error('Expected and actual signature paths are required')
const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8').replace(/^\uFEFF/, ''))
const actual = JSON.parse(fs.readFileSync(actualPath, 'utf8').replace(/^\uFEFF/, ''))
const missing = []
const divergent = []
const unexpected = []
const seedDivergent = []
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

for (const section of ['extensions', 'constraints', 'indexes', 'sequences', 'functions', 'views', 'triggers']) {
  for (const [key, value] of Object.entries(expected[section] ?? {})) {
    if (!(key in (actual[section] ?? {}))) missing.push(`${section}.${key}`)
    else if (!same(value, actual[section][key])) divergent.push(`${section}.${key}`)
  }
  for (const key of Object.keys(actual[section] ?? {})) {
    if (!(key in (expected[section] ?? {}))) unexpected.push(`${section}.${key}`)
  }
}
for (const [table, columns] of Object.entries(expected.tables ?? {})) {
  if (!(table in (actual.tables ?? {}))) {
    missing.push(`tables.${table}`)
    continue
  }
  for (const [column, value] of Object.entries(columns)) {
    if (!(column in actual.tables[table])) missing.push(`tables.${table}.${column}`)
    else if (!same(value, actual.tables[table][column])) divergent.push(`tables.${table}.${column}`)
  }
  for (const column of Object.keys(actual.tables[table])) {
    if (!(column in columns)) unexpected.push(`tables.${table}.${column}`)
  }
}
for (const table of Object.keys(actual.tables ?? {})) {
  if (!(table in (expected.tables ?? {}))) unexpected.push(`tables.${table}`)
}

for (const [table, rows] of Object.entries(expected.seed ?? {})) {
  const key = table === 'game_matchmaking_config' ? 'game_id' : table === 'matchmaking_mode_rules' ? 'rule_id' : 'id'
  const actualRows = actual.seed?.[table] ?? []
  const actualByKey = new Map(actualRows.map(row => [String(row[key]), row]))
  for (const row of rows) {
    const rowKey = String(row[key])
    if (!actualByKey.has(rowKey)) missing.push(`seed.${table}.${rowKey}`)
    else if (!same(row, actualByKey.get(rowKey))) seedDivergent.push(`seed.${table}.${rowKey}`)
  }
}

const result = {
  compatible: missing.length === 0 && divergent.length === 0 && unexpected.length === 0,
  missing,
  divergent,
  unexpected,
  seedDivergent,
  note: 'Seed value differences are reported separately because configuration rows may change after migration; missing seed keys are blocking.',
}
console.log(JSON.stringify(result, null, 2))
if (!result.compatible) process.exitCode = 1
