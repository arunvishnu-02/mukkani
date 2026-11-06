'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, MAP_OPTIONS } from '@/components/gmaps'

type Pt = { lat: number; lng: number }

// Set the delivery spot by hand: paste a Google Maps link, tap the map, or use this phone's position at the door.
export function SetLocation({ id, action, mapKey, start }: { id: string; action: (f: FormData) => Promise<void>; mapKey: string | null; start: Pt }) {
  const [pt, setPt] = useState<Pt | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pin = useRef<any>(null)
  const map = useRef<any>(null)

  useEffect(() => {
    if (!mapKey) return
    loadGoogleMaps(mapKey)
      .then((maps) => {
        if (!box.current) return
        map.current = new maps.Map(box.current, { ...MAP_OPTIONS, center: start, zoom: 15 })
        pin.current = new maps.Marker({ map: map.current, position: start, draggable: true })
        const set = (ll: any) => setPt({ lat: ll.lat(), lng: ll.lng() })
        map.current.addListener('click', (e: any) => {
          pin.current.setPosition(e.latLng)
          set(e.latLng)
        })
        pin.current.addListener('dragend', (e: any) => set(e.latLng))
      })
      .catch(() => setNote('The map could not load. Paste a link instead.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey])

  const here = () => {
    if (!navigator.geolocation) return setNote('This device cannot share its position.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const v = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPt(v)
        pin.current?.setPosition(v)
        map.current?.panTo(v)
        setBusy(false)
        setNote(`Got your position (accurate to ${Math.round(p.coords.accuracy)} m). Tap Save pin.`)
      },
      () => (setBusy(false), setNote('Location permission was blocked for this site.')),
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="lat" value={pt?.lat ?? ''} />
      <input type="hidden" name="lng" value={pt?.lng ?? ''} />
      <div>
        <label className="label" htmlFor="where">Paste a Google Maps link or type lat, lng</label>
        <input id="where" name="where" className="input" placeholder="https://maps.app.goo.gl/... or 10.8620, 78.6930" disabled={!!pt} />
      </div>
      {mapKey && (
        <div>
          <div className="label">Or tap the house on the map (drag the pin to adjust)</div>
          <div ref={box} className="h-64 w-full overflow-hidden rounded-[10px] border border-line bg-s2" />
        </div>
      )}
      <button type="button" onClick={here} disabled={busy} className="btn-secondary min-h-11 w-full">{busy ? 'Finding you…' : 'Use my current position (standing at the door)'}</button>
      {pt && <p className="font-mono text-xs text-muted">Pin: {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)} <button type="button" className="ml-2 font-sans font-semibold text-brand" onClick={() => setPt(null)}>Clear</button></p>}
      {note && <p className="text-[13px] text-muted">{note}</p>}
      <button className="btn min-h-11 w-full">Save pin</button>
    </form>
  )
}
