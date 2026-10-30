// npm run pois → supabase/sql/phase0_pois_real.sql from data/pois/*.csv
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { checkpointRows, haltRows, noEntryRows, parseCsv, tollRows, toSql } from './pois-lib.mjs'

const dir = new URL('../data/pois/', import.meta.url)
const read = (f) => {
  const u = new URL(f, dir)
  return existsSync(u) ? parseCsv(readFileSync(u, 'utf8')) : []
}

const tolls = read('tolls.csv')
const errors = []
const rows = [
  ...tollRows(tolls, errors),
  ...checkpointRows(read('checkpoints.csv'), tolls, errors),
  ...haltRows(read('dhabas_halts.csv'), errors),
  ...noEntryRows(read('no_entry_hours.csv'), errors),
]

if (rows.length === 0) {
  console.log('No CSV rows found — keeping the global sample POIs.')
  process.exit(0)
}

writeFileSync(new URL('../supabase/sql/phase0_pois_real.sql', import.meta.url), toSql(rows))
const counts = rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {})
console.log('POIs written:', counts, 'total', rows.length)
if (errors.length) console.log(`Skipped ${errors.length}:\n  ` + errors.join('\n  '))
