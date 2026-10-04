import Image from 'next/image'
import { redirect } from 'next/navigation'
import { currentUser, HOME } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const user = await currentUser()
  if (user) redirect(HOME[user.role])
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 text-center">
          <Image src="/mukkani-logo.png" alt="Mukkani" width={220} height={105} priority className="mx-auto" />
          <div className="mt-1 text-xs text-muted">CRM for sales, kitchen and admin</div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
