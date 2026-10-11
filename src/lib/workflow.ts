import 'server-only'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { addDays, day, deliveryDayFrom, fmtWeekday } from '@/lib/dates'
import { nearestRegionId, reverseGeocode } from '@/lib/geo'
import { packagePlan } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { LEAD_CALL, NEEDS_NEXT_CALL } from '@/lib/labels'
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

// One trial per customer, ever. Delivery date defaults to tomorrow; the time slot is required.
export async function bookTrial(leadId: string, byId: string, date: Date, slot: string | null) {
  if (!slot) throw new FlowError('Pick a delivery time slot for the trial')
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
  const last = await db.package.findFirst({ where: { leadId }, orderBy: { number: 'desc' } })
  const startDate = deliveryDayFrom(p.startDate ?? day(1))
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
  if (!(p.slot ?? lead.slot)) throw new FlowError('Pick a delivery time slot')
  const pkg = await db.package.create({
    data: {
      leadId,
      number: (last?.number ?? 0) + 1,
      price: s.monthlyPrice,
      startDate,
      buttermilkQty: p.buttermilkQty ?? last?.buttermilkQty ?? 0,
      buttermilkPrice: s.buttermilkPrice,
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
}

// Sales enters the day's attendance from the paper sheet after 11 AM.
export async function saveAttendance(date: Date, rows: AttendanceInput[], byId: string) {
  for (const r of rows) {
    const data = { status: r.status, buttermilk: r.buttermilk, boxBack: r.boxBack, remarks: r.remarks, byId }
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
