import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { readSession } from '@/lib/session'
import type { Role } from '@/generated/prisma/enums'

export const HOME: Record<Role, string> = { ADMIN: '/admin', SALES: '/dashboard', KITCHEN: '/kitchen' }

export const currentUser = cache(async () => {
  const s = await readSession()
  if (!s) return null
  const user = await db.user.findUnique({ where: { id: s.uid } })
  return user && user.active ? user : null
})

// Admin may open every screen. Pass the roles that may use a page or action.
export async function requireUser(roles?: Role[]) {
  const user = await currentUser()
  if (!user) redirect('/login')
  if (roles && user.role !== 'ADMIN' && !roles.includes(user.role)) redirect(HOME[user.role])
  return user
}
