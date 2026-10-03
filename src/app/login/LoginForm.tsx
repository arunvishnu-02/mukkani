'use client'

import { useActionState } from 'react'
import { login } from './actions'

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm font-medium text-red">{error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
