import 'server-only'
import { db } from '@/lib/db'
import { day } from '@/lib/dates'
import { daySheet } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import type { User } from '@/generated/prisma/client'

// One drop on the delivery person's Today map.
export type Stop = {
  leadId: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  region: string | null
  slot: string | null
  slotIdx: number
  // Minutes after midnight the customer asked for (from "Delivery time"), or the end of their slot.
  dueMin: number | null
  exact: boolean
  timeLabel: string | null
  trial: boolean
  dayNo: number | null
  bm: number
  altBox: number | null
  swapTo: string | null
  status: 'DELIVERED' | 'ABSENT' | 'NOT_DELIVERED' | null
  boxBack: boolean | null
  remarks: string | null
  doneAt: string | null
}

// Reasons shown as buttons after "Not delivered". "Customer on leave" saves as Absent (leave).
export const NOT_DELIVERED_REASONS = ['Door locked', 'Customer on leave', 'Not reachable', 'Wrong address', 'Other'] as const

// "6:45", "6.45 am", "before 7" -> minutes after midnight (morning times).
export function parseClock(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// "6:30 to 7:00" -> end of the slot in minutes.
export function slotEnd(slot: string | null | undefined): number | null {
  if (!slot) return null
  const parts = slot.split(/to|-|–/i)
  return parseClock(parts[parts.length - 1])
}

// The regions this person delivers. Admin sees every region.
export async function deliveryRegions(user: Pick<User, 'id' | 'role'>) {
  return db.region.findMany({
    where: user.role === 'ADMIN' ? {} : { deliveryUserId: user.id },
    orderBy: { name: 'asc' },
    include: { deliveryUser: { select: { name: true } } },
  })
}

// Today's drops in the given regions: the same list as the kitchen attendance sheet.
export async function todayStops(regionIds: string[], date = day(0)) {
  const [sheet, st] = await Promise.all([daySheet(date), appSettings()])
  const ids = new Set(regionIds)
  const slotIdx = (slot: string | null) => {
    const i = slot ? st.slots.findIndex((x) => x === slot) : -1
    return i < 0 ? st.slots.length : i
  }
  const att = await db.attendance.findMany({ where: { date, leadId: { in: [...sheet.rows.map((r) => r.lead.id), ...sheet.trials.map((t) => t.trial.leadId)] } } })
  const doneAt = new Map(att.map((a) => [a.leadId, (a.deliveredAt ?? a.updatedAt).toISOString()]))
  const stops: Stop[] = []
  const leave: { leadId: string; name: string }[] = []
  for (const r of sheet.rows) {
    if (!r.lead.regionId || !ids.has(r.lead.regionId)) continue
    if (r.absent && !r.attendance) {
      leave.push({ leadId: r.lead.id, name: r.lead.name })
      continue
    }
    const exact = parseClock(r.lead.deliveryTime)
    stops.push({
      leadId: r.lead.id,
      name: r.lead.name,
      address: r.lead.address,
      lat: r.lead.lat,
      lng: r.lead.lng,
      region: r.lead.region?.name ?? null,
      slot: r.lead.slot,
      slotIdx: slotIdx(r.lead.slot),
      dueMin: exact ?? slotEnd(r.lead.slot),
      exact: exact != null,
      timeLabel: r.lead.deliveryTime ?? r.lead.slot,
      trial: false,
      dayNo: r.dayNo,
      bm: r.bm,
      altBox: r.altBox,
      swapTo: r.swap?.swapTo ?? null,
      status: (r.attendance?.status as Stop['status']) ?? null,
      boxBack: r.attendance?.boxBack ?? null,
      remarks: r.attendance?.remarks ?? null,
      doneAt: r.attendance ? (doneAt.get(r.lead.id) ?? null) : null,
    })
  }
  for (const t of sheet.trials) {
    const lead = t.trial.lead
    if (!lead.regionId || !ids.has(lead.regionId)) continue
    const slot = t.trial.slot ?? lead.slot
    const exact = parseClock(lead.deliveryTime)
    stops.push({
      leadId: lead.id,
      name: lead.name,
      address: lead.address,
      lat: lead.lat,
      lng: lead.lng,
      region: lead.region?.name ?? null,
      slot,
      slotIdx: slotIdx(slot),
      dueMin: exact ?? slotEnd(slot),
      exact: exact != null,
      timeLabel: lead.deliveryTime ?? slot,
      trial: true,
      dayNo: null,
      bm: 0,
      altBox: null,
      swapTo: t.swap?.swapTo ?? null,
      status: (t.attendance?.status as Stop['status']) ?? null,
      boxBack: t.attendance?.boxBack ?? null,
      remarks: t.attendance?.remarks ?? null,
      doneAt: t.attendance ? (doneAt.get(lead.id) ?? null) : null,
    })
  }
  stops.sort((a, b) => a.slotIdx - b.slotIdx || (a.dueMin ?? 9999) - (b.dueMin ?? 9999) || a.name.localeCompare(b.name))
  return { stops, leave }
}

// The day's round: created the first time the delivery person opens Today (that is the login time for the day).
export async function ensureRound(userId: string, total: number, date = day(0)) {
  return db.deliveryRound.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, total },
    update: { total },
  })
}

// Counts done / missed and notes the finish time once every stop is marked.
export async function refreshRound(userId: string, stops: Stop[], date = day(0)) {
  const round = await db.deliveryRound.findUnique({ where: { userId_date: { userId, date } } })
  if (!round) return null
  const done = stops.filter((s) => s.status === 'DELIVERED').length
  const missed = stops.filter((s) => s.status && s.status !== 'DELIVERED').length
  const all = stops.length > 0 && done + missed === stops.length
  return db.deliveryRound.update({
    where: { id: round.id },
    data: { done, missed, total: stops.length, finishedAt: all ? (round.finishedAt ?? new Date()) : null },
  })
}

// Directions link that opens Google Maps navigation on the phone (no API key needed).
export const navigateUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=two-wheeler`

export const mapsKeys = () => ({
  browser: process.env.GOOGLE_MAPS_BROWSER_KEY || null,
  server: process.env.GOOGLE_MAPS_SERVER_KEY || null,
})
