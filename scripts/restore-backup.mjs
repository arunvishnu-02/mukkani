// Puts a backup file back into a database: node scripts/restore-backup.mjs <file.json.gz> <DATABASE_URL>
// It REPLACES every table in that database with the backup's rows, so check the URL twice.
// Try it on a test database first; for the live one, add --yes.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import pg from 'pg'

const [file, url, yes] = process.argv.slice(2)
if (!file || !url) { console.log('Usage: node scripts/restore-backup.mjs <file.json.gz> <DATABASE_URL> [--yes]'); process.exit(1) }
const backup = JSON.parse(gunzipSync(readFileSync(file)).toString(), (_k, v) => (v && typeof v === 'object' && '$bytes' in v ? Buffer.from(v.$bytes, 'base64') : v))
const tables = Object.keys(backup.tables).filter((t) => t !== '_prisma_migrations')
console.log(`Backup made ${backup.made}: ${tables.map((t) => `${t} ${backup.tables[t].length}`).join(', ')}`)
if (yes !== '--yes') { console.log('\nNothing changed. Add --yes to restore into this database.'); process.exit(0) }

const c = new pg.Client({ connectionString: url })
await c.connect()
await c.query('begin')
try {
  await c.query('set local session_replication_role = replica') // foreign keys are checked after all rows are in
  await c.query(`truncate ${tables.map((t) => `"${t}"`).join(', ')} cascade`)
  for (const t of tables) {
    const rows = backup.tables[t]
    if (!rows.length) continue
    const cols = (await c.query(`select column_name, udt_name from information_schema.columns where table_schema='public' and table_name=$1`, [t])).rows
    const type = Object.fromEntries(cols.map((r) => [r.column_name, r.udt_name]))
    const keys = Object.keys(rows[0]).filter((k) => k in type)
    for (const r of rows) {
      const vals = keys.map((k) => (Array.isArray(r[k]) || (r[k] && typeof r[k] === 'object' && !(r[k] instanceof Buffer) && type[k] === 'jsonb') ? r[k] : r[k]))
      await c.query(`insert into "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) values (${keys.map((k, i) => `$${i + 1}::${type[k].startsWith('_') ? `${type[k].slice(1)}[]` : `"${type[k]}"`}`).join(', ')})`, vals)
    }
    console.log(`${t}: ${rows.length}`)
  }
  await c.query('commit')
  console.log('Restored.')
} catch (e) {
  await c.query('rollback')
  console.error('Nothing changed, restore failed:', e.message)
  process.exitCode = 1
}
await c.end()
