import { redirect } from 'next/navigation'
import { HOME, requireUser } from '@/lib/auth'

export default async function Home() {
  const user = await requireUser()
  redirect(HOME[user.role])
}
