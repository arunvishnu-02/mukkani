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

const PATTERNS = [
  /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // .../@10.86,78.69,17z
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // place data
  /[?&](?:q|ll|query|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  /^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/, // "10.86, 78.69"
]

function findPoint(text: string) {
  const t = decodeURIComponent(text)
  for (const p of PATTERNS) {
    const m = t.match(p)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}

// A pasted Google Maps link (long or maps.app.goo.gl short link) or "lat, lng" -> a point.
export async function pointFromText(text: string): Promise<{ lat: number; lng: number } | null> {
  const direct = findPoint(text)
  if (direct) return direct
  const url = text.match(/https?:\/\/\S+/)?.[0]
  if (!url || !/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/.test(url)) return null
  // Short links: follow the redirects and read the point from the final address.
  try {
    let at = url
    for (let i = 0; i < 4; i++) {
      const res = await fetch(at, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      const next = res.headers.get('location')
      if (!next) {
        if (res.ok) return findPoint(await res.text())
        return null
      }
      at = new URL(next, at).toString()
      const p = findPoint(at)
      if (p) return p
    }
  } catch {
    return null
  }
  return null
}
