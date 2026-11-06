'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Every form in the app: the button that was pressed shows it is working until the next page shows,
// so people do not tap Save twice on a slow phone connection.
export function FormFeedback() {
  const path = usePathname()
  const search = useSearchParams()
  useEffect(() => {
    const clear = () => document.querySelectorAll('[data-pending]').forEach((b) => (b.removeAttribute('data-pending'), b.removeAttribute('aria-busy')))
    clear()
    const onSubmit = (e: SubmitEvent) => {
      const btn = e.submitter ?? (e.target as HTMLFormElement).querySelector('button:not([type=button])')
      if (!btn) return
      setTimeout(() => {
        btn.setAttribute('data-pending', '')
        btn.setAttribute('aria-busy', 'true')
      }, 0)
      setTimeout(clear, 10_000)
    }
    document.addEventListener('submit', onSubmit)
    return () => document.removeEventListener('submit', onSubmit)
  }, [path, search])
  return null
}
