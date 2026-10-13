import 'server-only'
import { db } from '@/lib/db'
import { day, fmtWeekday } from '@/lib/dates'
import type { Role } from '@/generated/prisma/enums'

// Past days are locked for sales and the kitchen manager. Today and later days are always open, and so is
// everything for the admin. An older day opens for one person once the admin allows their request, for 24 hours.
// Calls are not covered: a call can always be logged.

export async function dayOpen(user: { id: string; role: Role }, date: Date) {
  if (user.role === 'ADMIN' || date >= day(0)) return true
  const ok = await db.dayRequest.findFirst({ where: { userId: user.id, date, status: 'ALLOWED', expiresAt: { gt: new Date() } } })
  return !!ok
}

export const lockedText = (date: Date) => `${fmtWeekday(date)} is a past day and is locked. Ask the admin for permission to change it.`

// The latest request this person made for the day, to show "waiting" or "refused".
export function latestRequest(userId: string, date: Date) {
  return db.dayRequest.findFirst({ where: { userId, date }, orderBy: { createdAt: 'desc' } })
}
