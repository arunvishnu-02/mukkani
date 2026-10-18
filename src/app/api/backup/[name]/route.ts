import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { currentUser } from '@/lib/auth'
import { BACKUP_DIR } from '@/lib/backup'

// Download one backup file. Admin only.
export async function GET(_req: Request, ctx: RouteContext<'/api/backup/[name]'>) {
  const user = await currentUser()
  if (!user || user.role !== 'ADMIN') return new Response('Not allowed', { status: 403 })
  const { name } = await ctx.params
  if (!/^mukkani-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz$/.test(name)) return new Response('Not found', { status: 404 })
  try {
    const file = await readFile(join(BACKUP_DIR, name))
    return new Response(file, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
