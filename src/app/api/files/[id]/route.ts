import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// Uploaded files. Bill photos are for admin only; the payment QR is for anyone logged in.
export async function GET(_req: Request, ctx: RouteContext<'/api/files/[id]'>) {
  const user = await currentUser()
  if (!user) return new Response('Not logged in', { status: 401 })
  const { id } = await ctx.params
  const file = await db.upload.findUnique({ where: { id } })
  if (!file) return new Response('Not found', { status: 404 })
  if (file.kind !== 'qr' && user.role !== 'ADMIN') return new Response('Not allowed', { status: 403 })
  return new Response(Buffer.from(file.data), {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
