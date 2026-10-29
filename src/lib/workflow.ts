import 'server-only'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { addDays, day, deliveryDayFrom, fmtDay, fmtWeekday } from '@/lib/dates'
import { nearestRegionId, reverseGeocode } from '@/lib/geo'
import { packagePlan } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { LEAD_CALL, NEEDS_NEXT_CALL, SOURCE } from '@/lib/labels'
import type { AttendanceStatus, TrialResult } from '@/generated/prisma/enums'

export class FlowError extends Error {}

export async function log(leadId: string, kind: string, text: string, detail?: string | null, byId?: string | null) {
  await db.activity.create({ data: { leadId, kind, text, detail: detail ?? null, byId: byId ?? null } })
}

const callLabel = (v: string) => LEAD_CALL.find((x) => x[0] === v)?.[1] ?? v

// Sales call register: one result per call (plan doc section 4).
export async function logLeadCall(
  leadId: string,
  byId: string,
  outcome: string,
  note: string | null,
  opts: { next?: Date | null; trialDate?: Date; slot?: string | null; reason?: string | null; start?: PackageStart },
) {
  if (NEEDS_NEXT_CALL.includes(outcome) && !opts.next) throw new FlowError('Pick the next call date')
  // The step runs before the call is recorded, so a missing slot leaves nothing half done.
  if (NEEDS_NEXT_CALL.includes(outcome)) {
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
    await db.lead.update({
      where: { id: leadId },
      data: { nextFollowUpAt: opts.next, ...(lead.status === 'NOT_INTERESTED' ? { status: 'FOLLOW_UP', notInterestedReason: null } : {}) },
    })
  } else if (outcome === 'TRIAL') {
    await bookTrial(leadId, byId, opts.trialDate ?? day(1), opts.slot ?? null)
  } else if (outcome === 'MONTHLY') {
    await startPackage(leadId, byId, opts.start ?? {})
  } else if (outcome === 'NOT_INTERESTED') {
    await markNotInterested(leadId, byId, opts.reason ?? null)
  }
  await db.followUp.create({ data: { leadId, outcome: callLabel(outcome), note, byId } })
  await log(leadId, 'call', `Call: ${callLabel(outcome)}`, note, byId)
}

export async function markNotInterested(leadId: string, byId: string, reason: string | null) {
  await db.lead.update({ where: { id: leadId }, data: { status: 'NOT_INTERESTED', notInterestedReason: reason, nextFollowUpAt: null } })
  await log(leadId, 'status', 'Moved to Not interested', reason, byId)
}

// One trial per customer, ever. Delivery date defaults to tomorrow; the time slot is optional.
export async function bookTrial(leadId: string, byId: string, date: Date, slot: string | null) {
  if (await db.trialBox.findFirst({ where: { leadId } })) throw new FlowError('This customer has already had a trial box')
  const s = await appSettings()
  await db.trialBox.create({ data: { leadId, deliveryDate: date, slot, price: s.trialPrice } })
  await db.lead.update({ where: { id: leadId }, data: { status: 'TRIAL', slot, nextFollowUpAt: null } })
  await log(leadId, 'trial', 'Trial box booked', `${fmtWeekday(date)} · ${slot}`, byId)
}

// Trial feedback call after 10 AM on the trial day: Monthly pack, Follow up or Not interested.
export async function trialFeedback(
  trialId: string,
  byId: string,
  r: { result: TrialResult; feedback: string | null; paid: boolean; next?: Date | null; reason?: string | null; start?: PackageStart },
) {
  const t = await db.trialBox.findUniqueOrThrow({ where: { id: trialId } })
  // The next step runs first so a missing slot or date leaves the trial open.
  if (r.result === 'MONTHLY') await startPackage(t.leadId, byId, { ...r.start, slot: r.start?.slot ?? t.slot })
  else if (r.result === 'NOT_INTERESTED') await markNotInterested(t.leadId, byId, r.reason ?? null)
  else {
    if (!r.next) throw new FlowError('Pick the next call date')
    await db.lead.update({ where: { id: t.leadId }, data: { status: 'FOLLOW_UP', nextFollowUpAt: r.next } })
  }
  await db.trialBox.update({ where: { id: trialId }, data: { status: 'DONE', result: r.result, feedback: r.feedback, paid: r.paid } })
  await log(t.leadId, 'trial', 'Trial feedback recorded', r.feedback, byId)
}

export type PackageStart = {
  startDate?: Date
  slot?: string | null
  deliveryTime?: string | null
  regionId?: string | null
  buttermilkQty?: number
  paid?: boolean
}

// Starts a monthly package (26 delivery days). The kitchen manager takes over the calls from here.
export async function startPackage(leadId: string, byId: string, p: PackageStart) {
  const s = await appSettings()
  // A pack with all 26 boxes delivered is closed first, so the sheet moves to the new month straight away.
  await completeFinished([leadId])
  const last = await db.package.findFirst({ where: { leadId }, orderBy: { number: 'desc' } })
  // A double tap on Start must not make a second month.
  if (last && Date.now() - last.createdAt.getTime() < 60_000) return last
  const startDate = deliveryDayFrom(p.startDate ?? day(1))
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
  const pkg = await db.package.create({
    data: {
      leadId,
      number: (last?.number ?? 0) + 1,
      price: s.monthlyPrice,
      startDate,
      buttermilkQty: p.buttermilkQty ?? last?.buttermilkQty ?? 0,
      buttermilkPrice: s.buttermilkPrice,
      boxesPerDay: last?.boxesPerDay ?? 1,
      paid: p.paid ?? false,
      paidAt: p.paid ? new Date() : null,
    },
  })
  await db.lead.update({
    where: { id: leadId },
    data: {
      status: 'MONTHLY',
      customerStatus: 'ACTIVE',
      pausedUntil: null,
      notInterestedReason: null,
      nextFollowUpAt: null,
      ...(p.slot ? { slot: p.slot } : {}),
      ...(p.deliveryTime ? { deliveryTime: p.deliveryTime } : {}),
      ...(p.regionId ? { regionId: p.regionId } : {}),
    },
  })
  await log(leadId, 'package', `Monthly pack ${pkg.number} starts ${fmtWeekday(startDate)}`, `Rs ${pkg.price}`, byId)
  return pkg
}

// Kitchen manager sets Active, Absent (one day), Paused (until a date) or Inactive (stopped for good).
export async function setCustomerStatus(leadId: string, byId: string, status: string, date: Date | null) {
  if (status === 'ABSENT') {
    const d = date ?? day(1)
    await db.attendance.upsert({
      where: { leadId_date: { leadId, date: d } },
      create: { leadId, date: d, status: 'ABSENT', byId },
      update: { status: 'ABSENT', byId },
    })
    await db.lead.update({ where: { id: leadId }, data: { customerStatus: 'ACTIVE', pausedUntil: null } })
    await log(leadId, 'status', `Absent on ${fmtWeekday(d)}`, 'End date moves forward', byId)
  } else if (status === 'PAUSED') {
    await db.lead.update({ where: { id: leadId }, data: { customerStatus: 'PAUSED', pausedUntil: date } })
    await log(leadId, 'status', 'Paused', date ? `Until ${fmtWeekday(date)}` : 'Until further notice', byId)
  } else if (status === 'INACTIVE') {
    await db.lead.update({ where: { id: leadId }, data: { customerStatus: 'INACTIVE', pausedUntil: null } })
    await db.package.updateMany({ where: { leadId, status: 'ACTIVE' }, data: { status: 'CANCELLED' } })
    await log(leadId, 'status', 'Inactive', 'Stopped for good', byId)
  } else {
    await db.lead.update({ where: { id: leadId }, data: { customerStatus: 'ACTIVE', pausedUntil: null } })
    await log(leadId, 'status', 'Active', null, byId)
  }
}

export type AttendanceInput = {
  leadId: string
  status: AttendanceStatus
  buttermilk: boolean
  boxBack: boolean | null
  altBox: number | null
  remarks: string | null
  boxes?: number | null // left out = keep what is stored
}

// A customer tells us in advance that they will not take the box on some days. Each day is saved as
// Absent, which takes them off that day's sheet and adds the day to the end of the pack.
export async function markLeave(leadId: string, dates: Date[], byId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { packages: { where: { status: 'ACTIVE' }, take: 1 } } })
  if (!lead || lead.packages.length === 0) throw new FlowError('Pick a customer with a running monthly pack')
  if (dates.length === 0) throw new FlowError('Those days are all Sundays, when there is no delivery')
  const taken = await db.attendance.findMany({ where: { leadId, date: { in: dates }, status: { not: 'ABSENT' } } })
  if (taken.length) throw new FlowError(`Attendance is already entered for ${fmtDay(taken[0].date)}. Change it in Delivery attendance.`)
  for (const date of dates) {
    const data = { status: 'ABSENT' as const, buttermilk: false, remarks: 'Leave informed', byId }
    await db.attendance.upsert({ where: { leadId_date: { leadId, date } }, create: { leadId, date, ...data }, update: data })
  }
  await log(leadId, 'leave', `Leave marked for ${dates.length === 1 ? fmtDay(dates[0]) : `${fmtDay(dates[0])} to ${fmtDay(dates[dates.length - 1])}`}`, null, byId)
  return lead.name
}

export async function cancelLeave(leadId: string, date: Date, byId: string) {
  const gone = await db.attendance.deleteMany({ where: { leadId, date, status: 'ABSENT' } })
  if (gone.count) await log(leadId, 'leave', `Leave cancelled for ${fmtDay(date)}`, null, byId)
}

// Sales enters the day's attendance from the paper sheet after 9 AM.
export async function saveAttendance(date: Date, rows: AttendanceInput[], byId: string) {
  for (const r of rows) {
    const data = { status: r.status, buttermilk: r.buttermilk, boxBack: r.boxBack, remarks: r.remarks, byId, ...(r.boxes !== undefined ? { boxes: r.boxes } : {}) }
    await db.attendance.upsert({ where: { leadId_date: { leadId: r.leadId, date } }, create: { leadId: r.leadId, date, ...data }, update: data })
    const alt = await db.altBox.findFirst({ where: { leadId: r.leadId, givenOn: date } })
    if (r.altBox && !alt) await db.altBox.create({ data: { leadId: r.leadId, boxNo: r.altBox, givenOn: date } })
    else if (r.altBox && alt && alt.boxNo !== r.altBox) await db.altBox.update({ where: { id: alt.id }, data: { boxNo: r.altBox } })
    else if (!r.altBox && alt) await db.altBox.delete({ where: { id: alt.id } })
    const trial = await db.trialBox.findFirst({ where: { leadId: r.leadId, deliveryDate: date } })
    if (trial && trial.status === 'BOOKED' && r.status === 'DELIVERED') await db.trialBox.update({ where: { id: trial.id }, data: { status: 'DELIVERED' } })
  }
  await completeFinished(rows.map((r) => r.leadId))
}

// A package with 26 delivered days is complete; its monthly report is ready.
export async function completeFinished(leadIds: string[]) {
  const pkgs = await db.package.findMany({ where: { leadId: { in: leadIds }, status: 'ACTIVE' } })
  for (const p of pkgs) {
    const { plan } = await packagePlan(p.id)
    if (plan.done) {
      await db.package.update({ where: { id: p.id }, data: { status: 'COMPLETED' } })
      await log(p.leadId, 'package', `Monthly pack ${p.number} completed`, 'Monthly report is ready', null)
    }
  }
  // The last box can be entered a day early (to send the report on day 25). If that day is then changed to
  // Absent or cleared, the customer's latest pack is short of 26 again and goes back to running.
  const latest = await db.package.findMany({ where: { leadId: { in: leadIds }, status: 'COMPLETED' }, orderBy: { number: 'desc' } })
  const seen = new Set<string>()
  for (const p of latest) {
    if (seen.has(p.leadId)) continue
    seen.add(p.leadId)
    if (await db.package.findFirst({ where: { leadId: p.leadId, number: { gt: p.number } } })) continue
    const { plan } = await packagePlan(p.id)
    if (!plan.done && plan.delivered >= 20) {
      await db.package.update({ where: { id: p.id }, data: { status: 'ACTIVE' } })
      await log(p.leadId, 'package', `Monthly pack ${p.number} running again`, 'A box of the last days was changed, so it is short of 26', null)
    }
  }
}

// Kitchen manager calls monthly customers on delivery day 1, 5, 15, 26 (first month) or 15, 26.
export async function logCustomerCall(
  packageId: string,
  dayNo: number,
  byId: string,
  c: { outcome: string; note: string | null; renewal: string | null; reason: string | null },
) {
  const pkg = await db.package.findUniqueOrThrow({ where: { id: packageId } })
  const data = { outcome: c.outcome, note: c.note, renewal: c.renewal, reason: c.reason, byId }
  await db.customerCall.upsert({
    where: { packageId_dayNo: { packageId, dayNo } },
    create: { packageId, dayNo, leadId: pkg.leadId, ...data },
    update: data,
  })
  await log(pkg.leadId, 'call', `Day ${dayNo} call: ${c.outcome.toLowerCase().replace('_', ' ')}`, c.note, byId)
  if (c.renewal === 'NO') await markNotInterested(pkg.leadId, byId, c.reason)
}

// Payment screenshot received: start the next package right after the current one ends.
export async function markRenewalPaid(packageId: string, byId: string) {
  const { pkg, plan } = await packagePlan(packageId)
  const next = await db.package.findFirst({ where: { leadId: pkg.leadId, number: pkg.number + 1 } })
  if (next) {
    if (!next.paid) await db.package.update({ where: { id: next.id }, data: { paid: true, paidAt: new Date() } })
    return next
  }
  const start = deliveryDayFrom(addDays(plan.end ?? plan.originalEnd, 1))
  return startPackage(pkg.leadId, byId, { startDate: start, paid: true })
}

export async function createLocationRequest(leadId: string, channel: string, byId: string) {
  const token = randomBytes(6).toString('base64url')
  const req = await db.locationRequest.create({
    data: { token, leadId, channel, createdById: byId, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
  })
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
  if (lead.locationStatus === 'MISSING') await db.lead.update({ where: { id: leadId }, data: { locationStatus: 'LINK_SENT' } })
  await log(leadId, 'location', `Location link sent on ${channel}`, null, byId)
  return req
}

// Called from the public customer page. The pin, address and region update the profile automatically.
export async function saveSharedLocation(token: string, lat: number, lng: number, accuracy: number | null) {
  const req = await db.locationRequest.findUnique({ where: { token } })
  if (!req || req.expiresAt < new Date()) return { ok: false as const, error: 'This link has expired. Ask Mukkani for a new one.' }
  const [address, regionId] = await Promise.all([reverseGeocode(lat, lng), nearestRegionId(lat, lng)])
  const lead = await db.lead.update({
    where: { id: req.leadId },
    data: {
      lat,
      lng,
      accuracyM: accuracy == null ? null : Math.round(accuracy),
      locationStatus: 'PIN_SAVED',
      locationUpdatedAt: new Date(),
      ...(address ? { address } : {}),
      ...(regionId ? { regionId } : {}),
    },
    include: { region: true },
  })
  await db.locationRequest.update({ where: { id: req.id }, data: { sharedAt: new Date() } })
  await log(lead.id, 'location', 'Location shared by customer', 'Profile updated automatically')
  return { ok: true as const, address: lead.address, accuracy: lead.accuracyM }
}

// Customer form link. Staff enter the phone number; the customer fills in the rest on their own phone.
const phoneDigits = (v: string) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')

export async function createLeadInvite(phone: string, name: string | null, source: string, byId: string) {
  if (phoneDigits(phone).length < 10) throw new FlowError('Enter the 10-digit phone number')
  const token = randomBytes(6).toString('base64url')
  return db.leadInvite.create({ data: { token, phone, name, source, createdById: byId, expiresAt: new Date(Date.now() + 14 * 86_400_000) } })
}

export type InviteAnswers = {
  name: string
  phone: string
  altPhone: string | null
  address: string | null
  dob: Date | null
  slot: string | null
  avoidFoods: string | null
  avoidSalad: string | null
  healthNotes: string | null
  regionId: string | null
  lat: number | null
  lng: number | null
  accuracy: number | null
}

// The customer pressed Submit. Their answers become a new lead in Follow up, or complete the lead that
// already has this phone number. A shared location sets the pin, the address and the nearest region.
export async function submitLeadInvite(token: string, a: InviteAnswers) {
  const invite = await db.leadInvite.findUnique({ where: { token } })
  if (!invite || invite.expiresAt < new Date()) return { ok: false as const, error: 'This link has expired. Please ask Mukkani for a new one.' }
  if (invite.filledAt) return { ok: true as const }
  const hasPin = a.lat != null && a.lng != null
  const [found, region] = await Promise.all([hasPin ? reverseGeocode(a.lat!, a.lng!) : null, hasPin ? nearestRegionId(a.lat!, a.lng!) : null])
  const maker = invite.createdById ? await db.user.findUnique({ where: { id: invite.createdById } }) : null
  const digits = phoneDigits(a.phone)
  const same = (await db.lead.findMany({ select: { id: true, phone: true } })).find((l) => phoneDigits(l.phone) === digits)
  const details = {
    name: a.name,
    altPhone: a.altPhone,
    // What the customer typed is kept; the map's address is used only when they typed none.
    address: a.address ?? found,
    dob: a.dob,
    slot: a.slot,
    avoidFoods: a.avoidFoods,
    avoidSalad: a.avoidSalad,
    healthNotes: a.healthNotes,
    regionId: region ?? a.regionId,
    ...(hasPin ? { lat: a.lat, lng: a.lng, accuracyM: a.accuracy == null ? null : Math.round(a.accuracy), locationStatus: 'PIN_SAVED' as const, locationUpdatedAt: new Date() } : {}),
  }
  // Nothing the customer left empty wipes what staff already entered on an existing lead.
  const filled = Object.fromEntries(Object.entries(details).filter(([, v]) => v != null))
  const lead = same
    ? await db.lead.update({ where: { id: same.id }, data: filled })
    : await db.lead.create({
        data: { ...details, phone: a.phone, source: (invite.source in SOURCE ? invite.source : 'OTHER') as never, ownerId: maker?.role === 'KITCHEN' ? null : (maker?.id ?? null), nextFollowUpAt: day(0) },
      })
  await db.leadInvite.update({ where: { id: invite.id }, data: { filledAt: new Date(), leadId: lead.id } })
  await log(lead.id, 'lead', same ? 'Details filled in by the customer' : 'Lead added by the customer from the form link', hasPin ? 'Home location shared' : 'No location shared', invite.createdById)
  return { ok: true as const }
}
