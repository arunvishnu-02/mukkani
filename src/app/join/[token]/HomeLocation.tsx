'use client'

import { useEffect, useRef, useState } from 'react'

type Pin = { lat: number; lng: number; accuracy: number | null }

// "Share my home location": asks the phone for its GPS position and carries it in the form.
export function HomeLocation() {
  const [pin, setPin] = useState<Pin | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'blocked' | 'none'>('idle')
  const field = useRef<HTMLInputElement>(null)
  // The browser's own "fill this in" message is replaced with ours; clear it once the location is in or cannot be had.
  useEffect(() => field.current?.setCustomValidity(''), [pin, state])
  return (
    <div className="relative rounded-xl border border-line bg-s2/60 p-3.5">
      {/* Needed before the form can be sent, unless this phone cannot share its location. */}
      <input ref={field} name="lat" value={pin?.lat ?? ''} onChange={() => {}} required={state !== 'blocked' && state !== 'none'} tabIndex={-1} aria-hidden onInvalid={(e) => e.currentTarget.setCustomValidity('Please tap "Share my home location"')} className="pointer-events-none absolute h-px w-px opacity-0" />
      <input type="hidden" name="lng" value={pin?.lng ?? ''} />
      <input type="hidden" name="accuracy" value={pin?.accuracy ?? ''} />
      <div className="text-sm font-semibold">Home location *</div>
      <p className="mt-0.5 text-xs text-muted">Stand at your door and tap the button, so the box reaches the right house every morning.</p>
      {pin ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-leaf-soft px-3 py-2 text-sm font-semibold text-leaf">
          <span className="flex size-5 items-center justify-center rounded-full bg-leaf text-xs text-white">✓</span>
          <span className="flex-1">Location added{pin.accuracy ? ` · accurate to ${Math.round(pin.accuracy)} m` : ''}</span>
          <a href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer" className="text-xs underline">See on map</a>
        </div>
      ) : null}
      <button
        type="button"
        disabled={state === 'busy'}
        className={`${pin ? 'btn-secondary' : 'btn'} mt-2.5 w-full`}
        onClick={() => {
          if (!navigator.geolocation) return setState('none')
          setState('busy')
          navigator.geolocation.getCurrentPosition(
            (pos) => { setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }); setState('idle') },
            () => setState('blocked'),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          )
        }}
      >
        {state === 'busy' ? 'Finding your location…' : pin ? 'Share again' : 'Share my home location'}
      </button>
      {state === 'blocked' && <p className="mt-2 text-xs font-medium text-red">Location permission was blocked. Allow location for this site and tap again, or type your address below.</p>}
      {state === 'none' && <p className="mt-2 text-xs font-medium text-red">This phone cannot share location. Please type your address below.</p>}
    </div>
  )
}
