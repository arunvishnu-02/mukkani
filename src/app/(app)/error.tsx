'use client'

import { useEffect, useRef } from 'react'

// Shown instead of a blank browser error when a page fails (a slow or dropped database connection):
// try again by itself twice, then stop and show a reference so the cause can be found in the server log.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tries = useRef(0)
  useEffect(() => {
    if (tries.current >= 2) return
    const t = setTimeout(() => { tries.current += 1; reset() }, 2500)
    return () => clearTimeout(t)
  }, [reset])
  const gaveUp = tries.current >= 2
  return (
    <div className="mx-auto mt-20 max-w-sm rounded-[14px] border border-line bg-white p-6 text-center">
      <h1 className="font-display text-lg font-semibold">{gaveUp ? 'This page could not load' : 'Loading again…'}</h1>
      <p className="mt-1 text-[13px] text-muted">{gaveUp ? 'Tap Try now. If it keeps failing, send this reference to your developer.' : 'The connection was slow. Trying again.'}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted">Ref: {error.digest}</p>}
      <button onClick={() => { tries.current = 0; reset() }} className="btn mt-4">Try now</button>
    </div>
  )
}
