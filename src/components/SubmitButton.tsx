'use client'

import { useFormStatus } from 'react-dom'

// Save button that shows it is working and ignores a second tap, so a slow save is not entered twice.
export function SubmitButton({ children, pending: label = 'Saving…', className = 'btn w-full' }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus()
  return <button className={className} disabled={pending} aria-busy={pending}>{pending ? label : children}</button>
}
