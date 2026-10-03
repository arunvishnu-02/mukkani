'use client'

import { useState } from 'react'
import { shareLocation } from './actions'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; address: string | null; accuracy: number | null } | { kind: 'error'; msg: string }

export function ShareButton({ token }: { token: string }) {
  const [s, setS] = useState<State>({ kind: 'idle' })
  if (s.kind === 'done')
    return (
      <div className="space-y-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-leaf-soft text-xl font-bold text-leaf">✓</div>
        <h1 className="font-display text-2xl font-bold">Location shared. Thank you!</h1>
        <p className="text-sm text-muted">We saved this spot for your deliveries:</p>
        <div className="rounded-lg border border-line p-3 text-sm font-semibold">
          {s.address ?? 'Your exact pin'}
          {s.accuracy ? <div className="font-mono text-xs font-medium text-muted">accurate to {s.accuracy} m</div> : null}
        </div>
        <p className="text-xs text-muted">You can close this page now.</p>
      </div>
    )
  return (
    <div className="space-y-3">
      <button
        className="btn w-full py-3.5 text-base"
        disabled={s.kind === 'busy'}
        onClick={() => {
          if (!navigator.geolocation) return setS({ kind: 'error', msg: 'This phone cannot share location. Please call us.' })
          setS({ kind: 'busy' })
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const r = await shareLocation(token, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null)
                setS(r.ok ? { kind: 'done', address: r.address, accuracy: r.accuracy } : { kind: 'error', msg: r.error })
              } catch {
                setS({ kind: 'error', msg: 'Could not save. Please try again.' })
              }
            },
            () => setS({ kind: 'error', msg: 'Location permission was blocked. Allow location for this site in your browser and try again.' }),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          )
        }}
      >
        {s.kind === 'busy' ? 'Finding your location…' : 'Share my location'}
      </button>
      {s.kind === 'error' && <p className="text-sm font-medium text-red">{s.msg}</p>}
      <p className="text-center text-xs text-muted">Your phone will ask for permission. We only use this for deliveries.</p>
    </div>
  )
}
