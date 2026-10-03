import { redirect } from 'next/navigation'
import { currentUser, HOME } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const user = await currentUser()
  if (user) redirect(HOME[user.role])
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-tur font-display text-xl font-bold text-side">M</span>
          <div>
            <div className="font-display text-xl font-bold">Mukkani CRM</div>
            <div className="text-xs text-muted">Sales, kitchen and admin</div>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
