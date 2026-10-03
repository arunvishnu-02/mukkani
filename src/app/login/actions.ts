'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { HOME } from '@/lib/auth'
import { createSession, destroySession } from '@/lib/session'

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const user = await db.user.findUnique({ where: { username } })
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return 'Wrong username or password.'
  await createSession({ uid: user.id, role: user.role, name: user.name })
  redirect(HOME[user.role])
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
