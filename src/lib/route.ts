import 'server-only'

export type Pt = { lat: number; lng: number }
export type RouteStop = Pt & { id: string; slotIdx: number; exact: boolean; dueMin: number | null }
export type PlannedRoute = {
  order: string[]
  // Travel seconds from the previous point (or the start) to each stop, by stop id.
  legSec: Record<string, number>
  path: Pt[]
  google: boolean
}

const MAX_STOPS = 26 // Routes API: up to 25 intermediates + the destination

export function km(a: Pt, b: Pt) {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

// Rough two-wheeler time when Google is not available: road ~1.3x straight line at 20 km/h.
const guessSec = (a: Pt, b: Pt) => Math.round(((km(a, b) * 1.3) / 20) * 3600)

function nearestOrder<T extends Pt>(from: Pt, list: T[]): T[] {
  const left = [...list]
  const out: T[] = []
  let at: Pt = from
  while (left.length) {
    let bi = 0
    for (let i = 1; i < left.length; i++) if (km(at, left[i]) < km(at, left[bi])) bi = i
    const next = left.splice(bi, 1)[0]
    out.push(next)
    at = next
  }
  return out
}

// Google polyline decoding.
function decode(str: string): Pt[] {
  const pts: Pt[] = []
  let i = 0, lat = 0, lng = 0
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number
      do {
        b = str.charCodeAt(i++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const d = result & 1 ? ~(result >> 1) : result >> 1
      if (k === 0) lat += d
      else lng += d
    }
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return pts
}

type Leg = { duration?: string }
type GRoute = { legs?: Leg[]; polyline?: { encodedPolyline?: string }; optimizedIntermediateWaypointIndex?: number[] }

async function computeRoute(key: string, origin: Pt, stops: Pt[], optimize: boolean, mode: 'TWO_WHEELER' | 'DRIVE'): Promise<GRoute | null> {
  const wp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.legs.duration,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex',
    },
    body: JSON.stringify({
      origin: wp(origin),
      destination: wp(stops[stops.length - 1]),
      intermediates: stops.slice(0, -1).map(wp),
      travelMode: mode,
      optimizeWaypointOrder: optimize && stops.length > 2,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const j = (await res.json()) as { routes?: GRoute[] }
  return j.routes?.[0] ?? null
}

// One piece of the round: a set of stops in a given order (optimize = let Google reorder all but the last).
async function leg(key: string | null, origin: Pt, stops: RouteStop[], optimize: boolean) {
  let ordered = stops
  if (optimize && stops.length > 2) {
    // Google keeps the destination fixed: use the stop farthest from the start, reorder the rest.
    const far = stops.reduce((m, s) => (km(origin, s) > km(origin, m) ? s : m), stops[0])
    ordered = [...stops.filter((s) => s !== far), far]
  }
  if (key) {
    for (const mode of ['TWO_WHEELER', 'DRIVE'] as const) {
      try {
        const r = await computeRoute(key, origin, ordered, optimize, mode)
        if (!r?.legs) continue
        const idx = r.optimizedIntermediateWaypointIndex
        const final =
          optimize && idx && idx.length === ordered.length - 1 && idx.every((i) => i >= 0)
            ? [...idx.map((i) => ordered[i]), ordered[ordered.length - 1]]
            : ordered
        const legSec = final.map((_, i) => Number((r.legs![i]?.duration ?? '0s').replace('s', '')) || 0)
        return { stops: final, legSec, path: r.polyline?.encodedPolyline ? decode(r.polyline.encodedPolyline) : [origin, ...final], google: true }
      } catch {
        // try the next mode, then fall back
      }
    }
  }
  const final = optimize ? nearestOrder(origin, stops) : ordered
  const legSec = final.map((s, i) => guessSec(i === 0 ? origin : final[i - 1], s))
  return { stops: final, legSec, path: [origin, ...final], google: false }
}

// The round: slot by slot (6:30, then 7:00, then 7:30). Inside a slot, customers with an exact
// time go first in time order, then Google picks the shortest order for the rest.
// manual = the delivery person's own order (after moving a stop up or down).
export async function planRoute(origin: Pt, stops: RouteStop[], key: string | null, manual?: string[] | null): Promise<PlannedRoute> {
  const pieces: { stops: RouteStop[]; optimize: boolean }[] = []
  if (manual?.length) {
    const byId = new Map(stops.map((s) => [s.id, s]))
    const list = [...manual.map((id) => byId.get(id)).filter((s): s is RouteStop => !!s), ...stops.filter((s) => !manual.includes(s.id))]
    pieces.push({ stops: list, optimize: false })
  } else {
    const slots = [...new Set(stops.map((s) => s.slotIdx))].sort((a, b) => a - b)
    for (const idx of slots) {
      const inSlot = stops.filter((s) => s.slotIdx === idx)
      const fixed = inSlot.filter((s) => s.exact).sort((a, b) => (a.dueMin ?? 0) - (b.dueMin ?? 0))
      const free = inSlot.filter((s) => !s.exact)
      if (fixed.length) pieces.push({ stops: fixed, optimize: false })
      if (free.length) pieces.push({ stops: free, optimize: true })
    }
  }
  // Long pieces are cut into chunks Google accepts (ordered by nearest stop first).
  const chunks: { stops: RouteStop[]; optimize: boolean }[] = []
  let at: Pt = origin
  for (const p of pieces) {
    if (p.stops.length <= MAX_STOPS) chunks.push(p)
    else {
      const ordered = p.optimize ? nearestOrder(at, p.stops) : p.stops
      for (let i = 0; i < ordered.length; i += MAX_STOPS) chunks.push({ stops: ordered.slice(i, i + MAX_STOPS), optimize: false })
    }
    at = p.stops[p.stops.length - 1]
  }
  const out: PlannedRoute = { order: [], legSec: {}, path: [], google: !!key }
  let from: Pt = origin
  for (const c of chunks) {
    const r = await leg(key, from, c.stops, c.optimize)
    r.stops.forEach((s, i) => {
      out.order.push(s.id)
      out.legSec[s.id] = r.legSec[i]
    })
    out.path.push(...r.path)
    out.google = out.google && r.google
    from = r.stops[r.stops.length - 1]
  }
  return out
}
