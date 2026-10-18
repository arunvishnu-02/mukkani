import 'server-only'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { db } from '@/lib/db'

// Full copy of the database: every table, every row (photos included), gzipped JSON. One file a day, the last
// KEEP kept. Files live on the server outside the website folder, so nobody can open them by URL.
export const BACKUP_DIR = process.env.BACKUP_DIR || join(homedir(), 'mukkani-backups')
const KEEP = 30
const NAME = /^mukkani-(\d{4}-\d{2}-\d{2})-(\d{4})\.json\.gz$/

const istNow = () => new Date(Date.now() + 5.5 * 3_600_000)
export const todayIst = () => istNow().toISOString().slice(0, 10)

export async function listBackups() {
  await mkdir(BACKUP_DIR, { recursive: true })
  const names = (await readdir(BACKUP_DIR)).filter((n) => NAME.test(n)).sort().reverse()
  return Promise.all(names.map(async (name) => ({ name, size: (await stat(join(BACKUP_DIR, name))).size, day: name.match(NAME)![1] })))
}

export async function makeBackup(reason: string) {
  const tables = (await db.$queryRawUnsafe<{ t: string }[]>(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)).map((r) => r.t)
  const data: Record<string, unknown[]> = {}
  for (const t of tables) data[t] = await db.$queryRawUnsafe(`select * from "${t}"`)
  const json = JSON.stringify({ app: 'mukkani', made: new Date().toISOString(), reason, tables: data }, (_k, v) =>
    typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? { $bytes: Buffer.from(v).toString('base64') } : v,
  )
  await mkdir(BACKUP_DIR, { recursive: true })
  const stamp = istNow().toISOString()
  const name = `mukkani-${stamp.slice(0, 10)}-${stamp.slice(11, 13)}${stamp.slice(14, 16)}.json.gz`
  await writeFile(join(BACKUP_DIR, name), gzipSync(json), { mode: 0o600 })
  // Keep the newest KEEP days.
  const all = await listBackups()
  for (const old of all.slice(KEEP)) await rm(join(BACKUP_DIR, old.name), { force: true })
  return { name, rows: Object.values(data).reduce((n, r) => n + r.length, 0), tables: tables.length }
}

// Runs inside the app: once an hour, if today's backup is missing and it is past 1 AM India time, make it.
let started = false
export function startNightlyBackup() {
  if (started) return
  started = true
  const tick = async () => {
    try {
      if (istNow().getUTCHours() < 1) return
      const today = todayIst()
      if ((await listBackups()).some((b) => b.day === today)) return
      const r = await makeBackup('nightly')
      console.log(`Backup made: ${r.name} (${r.rows} rows)`)
    } catch (e) {
      console.error('Backup failed:', e)
    }
  }
  setTimeout(tick, 60_000)
  setInterval(tick, 60 * 60_000).unref?.()
}
