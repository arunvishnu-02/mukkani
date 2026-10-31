'use client'

import { useEffect } from 'react'

// Shown instead of a blank browser error when a page fails (a slow or dropped database connection):
// try once more by itself, then offer the button.
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const t = setTimeout(reset, 2500)
    return () => clearTimeout(t)
  }, [reset])
  return (
    <div className="mx-auto mt-20 max-w-sm rounded-[14px] border border-line bg-white p-6 text-center">
      <h1 className="font-display text-lg font-semibold">Loading again…</h1>
      <p className="mt-1 text-[13px] text-muted">The connection was slow. Trying again.</p>
      <button onClick={reset} className="btn mt-4">Try now</button>
    </div>
  )
}
