'use client'

import { useState } from 'react'

// Password input with an eye button to show or hide what was typed.
export function PasswordField({ id, name = 'password', autoComplete, required, minLength }: { id?: string; name?: string; autoComplete?: string; required?: boolean; minLength?: number }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? 'text' : 'password'} className="input pr-11" autoComplete={autoComplete} required={required} minLength={minLength} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-brand focus-visible:text-brand focus-visible:outline-none"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  )
}
