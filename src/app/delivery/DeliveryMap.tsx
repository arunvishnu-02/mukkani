'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, MAP_OPTIONS } from '@/components/gmaps'

type Pt = { lat: number; lng: number }
export type MapStop = Pt & { id: string; label: string; kind: 'next' | 'todo' | 'done' | 'missed' }

const COLOR = { next: '#5d2a92', todo: '#7a6a8c', done: '#2b8a35', missed: '#b4412f' }

// The delivery map: numbered pins in route order, the route line, and the blue live dot.
export function DeliveryMap({ apiKey, me, centre, stops, path, onPick }: { apiKey: string; me: Pt | null; centre: Pt | null; stops: MapStop[]; path: Pt[]; onPick: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const g = useRef<{ maps: any; map: any; markers: any[]; line: any; meDot: any; fitted: boolean } | null>(null)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  }, [onPick])

  useEffect(() => {
    let off = false
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (off || !box.current) return
        const map = new maps.Map(box.current, { ...MAP_OPTIONS, center: centre ?? me ?? { lat: 10.85, lng: 78.69 }, zoom: 14 })
        g.current = { maps, map, markers: [], line: null, meDot: null, fitted: false }
        setReady(true)
      })
      .catch(() => setError(true))
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  // Pins and the route line.
  useEffect(() => {
    const c = g.current
    if (!ready || !c) return
    c.markers.forEach((m) => m.setMap(null))
    c.markers = stops.map((s) => {
      const big = s.kind === 'next'
      const m = new c.maps.Marker({
        map: c.map,
        position: s,
        zIndex: big ? 100 : s.kind === 'todo' ? 50 : 10,
        label: s.label ? { text: s.label, color: '#fff', fontSize: big ? '14px' : '12px', fontWeight: '700' } : undefined,
        icon: { path: c.maps.SymbolPath.CIRCLE, scale: big ? 15 : s.label ? 11 : 7, fillColor: COLOR[s.kind], fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      })
      m.addListener('click', () => pick.current(s.id))
      return m
    })
    c.line?.setMap(null)
    c.line = path.length > 1 ? new c.maps.Polyline({ map: c.map, path, strokeColor: '#5d2a92', strokeOpacity: 0.85, strokeWeight: 5 }) : null
    if (!c.fitted && (stops.length || me)) {
      const b = new c.maps.LatLngBounds()
      stops.forEach((s) => b.extend(s))
      if (me) b.extend(me)
      c.map.fitBounds(b, 40)
      if (stops.length + (me ? 1 : 0) === 1) c.map.setZoom(16)
      c.fitted = true
    }
  }, [ready, stops, path, me])

  // Live position.
  useEffect(() => {
    const c = g.current
    if (!ready || !c || !me) return
    if (!c.meDot)
      c.meDot = new c.maps.Marker({ map: c.map, position: me, zIndex: 200, icon: { path: c.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } })
    else c.meDot.setPosition(me)
  }, [ready, me])

  if (error) return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">The map could not load. Check the internet or the Google Maps key. The list below still works.</div>
  return (
    <>
      <div ref={box} className="h-full w-full" />
      {me && ready && (
        <button onClick={() => g.current?.map.panTo(me)} className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-surface shadow-md active:scale-95" aria-label="Show my position">
          <svg viewBox="0 0 24 24" className="size-5 text-[#1a73e8]" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </button>
      )}
    </>
  )
}
