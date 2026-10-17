import 'server-only'
import { db } from '@/lib/db'

type Who = { id: string; name: string; role: string }

// Tells admin that sales or the kitchen manager deleted something. Admin's own deletes are not reported.
export async function notifyAdmin(user: Who, text: string, detail?: string | null) {
  if (user.role === 'ADMIN') return
  await db.adminNotice.create({ data: { text, detail: detail ?? null, byId: user.id, byName: user.name, byRole: user.role } })
}
