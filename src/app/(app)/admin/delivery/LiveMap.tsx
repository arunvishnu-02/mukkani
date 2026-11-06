'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadGoogleMaps, MAP_OPTIONS } from '@/components/gmaps'

type Person = { id: string; name: string; lat: number; lng: number; ago: string }

// Admin only: where each delivery person was last seen today. Refreshes every 30 seconds.
export function LiveMap({ apiKey, people, centre }: { apiKey: string | null; people: Person[]; centre: { lat: number; lng: number } }) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const g = useRef<{ maps: any; map: any; marks: any[]; fitted: boolean } | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(t)
  }, [router])

  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!box.current) return
        g.current = { maps, map: new maps.Map(box.current, { ...MAP_OPTIONS, center: centre, zoom: 12 }), marks: [], fitted: false }
        setReady(true)
      })
      .catch(() => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  useEffect(() => {
    const c = g.current
    if (!ready || !c) return
    c.marks.forEach((m) => m.setMap(null))
    c.marks = people.map(
      (p) =>
        new c.maps.Marker({
          map: c.map,
          position: p,
          title: `${p.name} · ${p.ago}`,
          label: { text: p.name.slice(0, 1), color: '#fff', fontWeight: '700' },
          icon: { path: c.maps.SymbolPath.CIRCLE, scale: 13, fillColor: '#5d2a92', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
        }),
    )
    if (!c.fitted && people.length) {
      const b = new c.maps.LatLngBounds()
      people.forEach((p) => b.extend(p))
      c.map.fitBounds(b, 60)
      if (people.length === 1) c.map.setZoom(15)
      c.fitted = true
    }
  }, [ready, people])

  if (!apiKey) return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">Add GOOGLE_MAPS_BROWSER_KEY in hPanel to see the live map. Positions are listed below.</div>
  if (error) return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">The map could not load. Check the Google Maps key.</div>
  return <div ref={box} className="h-full w-full" />
}
