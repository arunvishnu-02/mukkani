import 'server-only'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { day } from '@/lib/dates'
import { nearestRegionId, reverseGeocode } from '@/lib/geo'
import type { LeadStatus, TrialStatus } from '@/generated/prisma/enums'
import { LEAD_STATUS, TRIAL_STATUS, packagePrice } from '@/lib/labels'

const OPEN_TRIAL: TrialStatus[] = ['PENDING', 'ASSIGNED', 'PREPARING', 'DELIVERED', 'TRIAL_ACTIVE']

export async function log(leadId: string, kind: string, text: string, detail?: string | null, byId?: string | null) {
  await db.activity.create({ data: { leadId, kind, text, detail: detail ?? null, byId: byId ?? null } })
}

// Status change on a lead. "Trial Box Requested" creates the trial order and hands it to the kitchen.
export async function setLeadStatus(
  leadId: string,
  status: LeadStatus,
  byId: string,
  trial?: { start?: Date; end?: Date; notes?: string | null },
) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
  if (lead.status !== status) {
    await db.lead.update({ where: { id: leadId }, data: { status } })
    await log(leadId, 'status', `Status set to ${LEAD_STATUS[status][0]}`, null, byId)
  }
  if (status === 'TRIAL_REQUESTED') {
    const open = await db.trialBox.findFirst({ where: { leadId, status: { in: OPEN_TRIAL } } })
    if (!open) {
      const kitchen = await db.user.findFirst({ where: { role: 'KITCHEN', active: true }, orderBy: { createdAt: 'asc' } })
      const start = trial?.start ?? day(1)
      const end = trial?.end ?? new Date(start.getTime() + 6 * 86_400_000)
      await db.trialBox.create({
        data: { leadId, startDate: start, endDate: end, notes: trial?.notes ?? lead.foodNotes, assignedToId: kitchen?.id ?? null },
      })
      await log(leadId, 'trial', 'Trial box requested', kitchen ? `Assigned to ${kitchen.name}, kitchen notified` : 'Kitchen notified', byId)
    }
  }
}

export async function moveTrial(trialId: string, status: TrialStatus, byId: string) {
  const t = await db.trialBox.update({ where: { id: trialId }, data: { status } })
  await log(t.leadId, 'trial', `Trial box ${TRIAL_STATUS[status][0]}`, null, byId)
  if (status === 'DELIVERED' || status === 'TRIAL_ACTIVE') {
    await db.lead.update({ where: { id: t.leadId }, data: { status: 'TRIAL_ACTIVE' } })
  }
  if (status === 'COMPLETED') await log(t.leadId, 'alert', 'Trial completed', 'Record the result', byId)
}

export async function recordResult(
  trialId: string,
  byId: string,
  r: { converted: true; packageType: string; startDate: Date; slot: string; regionId: string | null } | { converted: false; next: 'LOST' | 'FOLLOW_UP' },
) {
  const t = await db.trialBox.update({
    where: { id: trialId },
    data: { status: 'COMPLETED', result: r.converted ? 'CONVERTED' : 'NOT_CONVERTED' },
  })
  if (r.converted) {
    await db.package.create({ data: { leadId: t.leadId, packageType: r.packageType, price: packagePrice(r.packageType), startDate: r.startDate } })
    await db.lead.update({
      where: { id: t.leadId },
      data: { status: 'CONVERTED', slot: r.slot, ...(r.regionId ? { regionId: r.regionId } : {}) },
    })
    await log(t.leadId, 'package', 'Converted to monthly package', r.packageType, byId)
  } else {
    await db.lead.update({ where: { id: t.leadId }, data: { status: r.next } })
    await log(t.leadId, 'status', 'Trial not converted', r.next === 'LOST' ? 'Marked Lost Lead' : 'Back to follow-up', byId)
  }
}

export async function logCall(
  leadId: string,
  byId: string,
  outcome: 'INTERESTED' | 'CALL_BACK' | 'TRIAL' | 'NOT_INTERESTED',
  note: string | null,
  next: Date | null,
) {
  const label = { INTERESTED: 'Interested', CALL_BACK: 'Call back later', TRIAL: 'Trial Box Requested', NOT_INTERESTED: 'Not interested' }[outcome]
  await db.followUp.create({ data: { leadId, outcome: label, note, byId } })
  await db.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: outcome === 'NOT_INTERESTED' ? null : next } })
  await log(leadId, 'call', `Call logged: ${label}`, note, byId)
  const status: LeadStatus = { INTERESTED: 'FOLLOW_UP', CALL_BACK: 'FOLLOW_UP', TRIAL: 'TRIAL_REQUESTED', NOT_INTERESTED: 'NOT_INTERESTED' }[outcome] as LeadStatus
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } })
  // Calls do not move a lead backwards once it has a trial or a package.
  if (['TRIAL_ACTIVE', 'CONVERTED'].includes(lead.status) && status !== 'TRIAL_REQUESTED') return
  if (lead.status === 'NEW' && status === 'FOLLOW_UP') return setLeadStatus(leadId, 'CONTACTED', byId)
  await setLeadStatus(leadId, status, byId)
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
