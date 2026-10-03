import 'server-only'
import { db } from '@/lib/db'

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLng = r(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// Region = the nearest region centre within 25 km. Region centres are set by the admin.
export async function nearestRegionId(lat: number, lng: number) {
  const regions = await db.region.findMany({ where: { lat: { not: null }, lng: { not: null } } })
  let best: { id: string; d: number } | null = null
  for (const r of regions) {
    const d = km(lat, lng, r.lat!, r.lng!)
    if (!best || d < best.d) best = { id: r.id, d }
  }
  return best && best.d <= 25 ? best.id : null
}

// Address from OpenStreetMap (free, no key). Best effort: returns null when offline or slow.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (process.env.REVERSE_GEOCODE === 'off') return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
      { headers: { 'User-Agent': 'mukkani-crm/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return null
    const j = (await res.json()) as { display_name?: string }
    return j.display_name?.split(', ').slice(0, 5).join(', ') ?? null
  } catch {
    return null
  }
}
