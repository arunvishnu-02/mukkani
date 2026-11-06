'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day } from '@/lib/dates'
import { deliveryRegions, ensureRound, mapsKeys, NOT_DELIVERED_REASONS, refreshRound, todayStops } from '@/lib/delivery'
import { planRoute, type Pt } from '@/lib/route'
import { log, saveAttendance } from '@/lib/workflow'

// The stops this person may mark today (their regions only; admin may pick one region).
async function myStops(regionId?: string | null) {
  const user = await requireUser(['DELIVERY'])
  const regions = await deliveryRegions(user)
  const ids = regionId && regions.some((r) => r.id === regionId) ? [regionId] : regions.map((r) => r.id)
  const { stops } = await todayStops(ids)
  return { user, stops, regions: regions.filter((r) => ids.includes(r.id)) }
}

const pt = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })

const markInput = z.object({
  leadId: z.string().uuid(),
  regionId: z.string().uuid().nullable().optional(),
  delivered: z.boolean(),
  boxBack: z.boolean().nullable(),
  reason: z.enum(NOT_DELIVERED_REASONS).nullable(),
})

// Tap 1 + tap 2 on a stop. Writes today's attendance, the same row sales used to type in.
export async function markStopAction(input: z.infer<typeof markInput>) {
  const m = markInput.parse(input)
  const { user, stops } = await myStops(m.regionId)
  const stop = stops.find((s) => s.leadId === m.leadId)
  if (!stop) return { ok: false as const, error: 'This customer is not on your list today.' }
  const date = day(0)
  const status: 'DELIVERED' | 'ABSENT' | 'NOT_DELIVERED' = m.delivered ? 'DELIVERED' : m.reason === 'Customer on leave' ? 'ABSENT' : 'NOT_DELIVERED'
  await saveAttendance(
    date,
    [{ leadId: stop.leadId, status, buttermilk: m.delivered && stop.bm > 0, boxBack: m.delivered ? m.boxBack : null, altBox: stop.altBox, remarks: m.delivered ? null : m.reason }],
    user.id,
  )
  await db.attendance.update({ where: { leadId_date: { leadId: stop.leadId, date } }, data: { deliveredAt: new Date() } })
  if (user.role === 'DELIVERY') {
    const after = stops.map((s) => (s.leadId === stop.leadId ? { ...s, status } : s))
    await refreshRound(user.id, after)
  }
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

// Undo within a few seconds of marking: removes the attendance row the delivery person just wrote.
export async function undoStopAction(leadId: string, regionId?: string | null) {
  const id = z.string().uuid().parse(leadId)
  const { user, stops } = await myStops(regionId)
  if (!stops.some((s) => s.leadId === id)) return { ok: false as const }
  await db.attendance.deleteMany({ where: { leadId: id, date: day(0), deliveredAt: { not: null } } })
  await db.trialBox.updateMany({ where: { leadId: id, deliveryDate: day(0), status: 'DELIVERED' }, data: { status: 'BOOKED' } })
  if (user.role === 'DELIVERY') await refreshRound(user.id, stops.map((s) => (s.leadId === id ? { ...s, status: null } : s)))
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

// The phone's position every 30 seconds while Today is open. Only admin sees it.
export async function pingAction(p: Pt) {
  const user = await requireUser(['DELIVERY'])
  if (user.role !== 'DELIVERY') return
  const { lat, lng } = pt.parse(p)
  const { stops } = await myStops()
  const round = await ensureRound(user.id, stops.length)
  await db.deliveryRound.update({ where: { id: round.id }, data: { lastLat: lat, lastLng: lng, lastAt: new Date() } })
}

// Best order for the stops still to do, from where the delivery person is now.
export async function planRouteAction(input: { origin: Pt | null; manual: string[] | null; regionId?: string | null }) {
  const { stops, regions } = await myStops(input.regionId)
  const pending = stops.filter((s) => !s.status && s.lat != null && s.lng != null)
  const centre = regions.find((r) => r.lat != null && r.lng != null)
  const origin = input.origin ? pt.parse(input.origin) : centre ? { lat: centre.lat!, lng: centre.lng! } : pending[0] ? { lat: pending[0].lat!, lng: pending[0].lng! } : null
  if (!origin || pending.length === 0) return { order: [], legSec: {}, path: [], google: false, plannedAt: Date.now() }
  const manual = input.manual ? z.array(z.string().uuid()).max(200).parse(input.manual) : null
  const route = await planRoute(
    origin,
    pending.map((s) => ({ id: s.leadId, lat: s.lat!, lng: s.lng!, slotIdx: s.slotIdx, exact: s.exact, dueMin: s.dueMin })),
    mapsKeys().server,
    manual,
  )
  return { ...route, plannedAt: Date.now() }
}

// A stop with no pin: the delivery person stands at the door and saves the spot (one tap).
export async function saveSpotAction(leadId: string, p: Pt, regionId?: string | null) {
  const id = z.string().uuid().parse(leadId)
  const { lat, lng } = pt.parse(p)
  const { user, stops } = await myStops(regionId)
  if (!stops.some((s) => s.leadId === id)) return { ok: false as const }
  await db.lead.update({ where: { id }, data: { lat, lng, locationStatus: 'PIN_SAVED', locationUpdatedAt: new Date() } })
  await log(id, 'location', 'Location saved at the door by delivery', null, user.id)
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

// Stop early: notes the finish time even if some stops are not marked.
export async function finishRoundAction() {
  const user = await requireUser(['DELIVERY'])
  if (user.role !== 'DELIVERY') return
  await db.deliveryRound.updateMany({ where: { userId: user.id, date: day(0), finishedAt: null }, data: { finishedAt: new Date() } })
  revalidatePath('/', 'layout')
}
