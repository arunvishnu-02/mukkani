'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { addDays, day, fmtDay, fmtWeekday, isDay, isSunday, keyOf, parseDay } from '@/lib/dates'
import { getSettings } from '@/lib/settings'
import { dayOpen, lockedText } from '@/lib/lock'
import { LEAD_IMPORT_COLUMNS, parseCsv, sheetDate } from '@/lib/csv'
import { SOURCE } from '@/lib/labels'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { holidaySet, packagePlan } from '@/lib/queries'
import { notifyAdmin } from '@/lib/notice'
import {
  FlowError,
  bookTrial,
  cancelLeave,
  createLocationRequest,
  log,
  logLeadCall,
  markLeave,
  markNotInterested,
  saveAttendance,
  startPackage,
  trialFeedback,
  type AttendanceInput,
  type PackageStart,
} from '@/lib/workflow'
import { LeadSource, TrialResult } from '@/generated/prisma/enums'

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const date = (f: FormData, k: string) => (isDay(s(f, k)) ? parseDay(s(f, k)!) : null)
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
// When Other is picked, what was typed beside it is kept with it.
const reasonOf = (f: FormData) => (s(f, 'reason') === 'Other' && s(f, 'reasonOther') ? `Other: ${s(f, 'reasonOther')}` : s(f, 'reason'))
const withError = (url: string, e: unknown) => {
  if (!(e instanceof FlowError)) throw e
  return `${url}${url.includes('?') ? '&' : '?'}error=${encodeURIComponent(e.message)}`
}

// Runs a step; a FlowError goes back to the same screen with the message instead of an error page.
async function attempt(form: FormData, fallback: string, fn: () => Promise<unknown>, done?: string) {
  let to = done ?? back(form, fallback)
  try {
    await fn()
  } catch (e) {
    to = withError(s(form, 'self') ?? back(form, fallback), e)
  }
  revalidatePath('/', 'layout')
  redirect(to)
}

function packageStart(form: FormData): PackageStart {
  return {
    startDate: date(form, 'startDate') ?? undefined,
    slot: s(form, 'slot'),
    deliveryTime: s(form, 'deliveryTime'),
    regionId: s(form, 'regionId'),
    buttermilkQty: Number(s(form, 'buttermilkQty') ?? 0),
    paid: form.get('pkgPaid') === 'on',
  }
}

const leadFields = (form: FormData) => ({
  name: z.string().min(1, 'Name is needed').parse(s(form, 'name')),
  phone: z.string().min(6, 'Phone number is needed').parse(s(form, 'phone')),
  altPhone: s(form, 'altPhone'),
  address: s(form, 'address'),
  regionId: s(form, 'regionId'),
  source: z.enum(LeadSource).parse(s(form, 'source') ?? 'CALL'),
  sourceOther: s(form, 'source') === 'OTHER' ? s(form, 'sourceOther') : null,
  notes: s(form, 'notes'),
  avoidFoods: s(form, 'avoidFoods'),
  healthNotes: s(form, 'healthNotes'),
  dob: date(form, 'dob'),
  slot: s(form, 'slot'),
  deliveryTime: s(form, 'deliveryTime'),
})

// Leads
export async function createLead(form: FormData) {
  const user = await requireUser(['SALES'])
  const data = leadFields(form)
  // A new person can go straight to a trial box or a monthly pack instead of Follow up.
  const startAs = s(form, 'startAs') === 'TRIAL' ? 'TRIAL' : s(form, 'startAs') === 'MONTHLY' ? 'MONTHLY' : 'FOLLOW_UP'
  const lead = await db.lead.create({ data: { ...data, ownerId: user.id, nextFollowUpAt: startAs === 'FOLLOW_UP' ? (date(form, 'nextFollowUpAt') ?? day(0)) : null } })
  await log(lead.id, 'lead', 'Lead added', `Source: ${data.source.toLowerCase().replace('_', ' ')}`, user.id)
  if (startAs === 'TRIAL') await bookTrial(lead.id, user.id, date(form, 'trialDate') ?? day(1), data.slot)
  if (startAs === 'MONTHLY') {
    await startPackage(lead.id, user.id, { startDate: date(form, 'startDate') ?? undefined, slot: data.slot, deliveryTime: data.deliveryTime, regionId: data.regionId, buttermilkQty: Number(s(form, 'buttermilkQty') ?? 0), paid: form.get('pkgPaid') === 'on' })
  }
  revalidatePath('/', 'layout')
  redirect(startAs === 'MONTHLY' ? `/customers/${lead.id}` : startAs === 'TRIAL' ? '/trials?tab=booked' : `/leads?lead=${lead.id}`)
}

const digits = (v: string) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')

// Leads > Import: a CSV file with the columns of the sample file. A row is skipped when it has no name
// or phone, or when its phone number is already a lead.
export async function importLeads(form: FormData) {
  const user = await requireUser(['SALES'])
  const self = '/leads?f=all&import=1'
  const stop = (msg: string): never => redirect(`${self}&error=${encodeURIComponent(msg)}`)
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return stop('Pick the CSV file to import')
  if (file.size > 2 * 1024 * 1024) return stop('The file is larger than 2 MB')
  const rows = parseCsv(await file.text())
  const head = (rows[0] ?? []).map((h) => h.toLowerCase())
  const col = (name: (typeof LEAD_IMPORT_COLUMNS)[number]) => head.indexOf(name.toLowerCase())
  if (col('Name') < 0 || col('Phone') < 0) return stop('The first row must have the column headings Name and Phone. Download the sample file to see the format.')
  if (rows.length > 2001) return stop('Import up to 2,000 leads at a time')

  const [regions, existing] = await Promise.all([db.region.findMany(), db.lead.findMany({ select: { phone: true } })])
  const seen = new Set(existing.map((l) => digits(l.phone)))
  const sources = new Map<string, LeadSource>(Object.entries(SOURCE).flatMap(([k, label]) => [[k.toLowerCase(), k as LeadSource], [label.toLowerCase(), k as LeadSource]]))
  const data = []
  let missing = 0
  let duplicate = 0
  for (const r of rows.slice(1)) {
    const get = (name: (typeof LEAD_IMPORT_COLUMNS)[number]) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '') || null
    const name = get('Name')
    const phone = get('Phone')
    if (!name || !phone || digits(phone).length < 6) { missing++; continue }
    if (seen.has(digits(phone))) { duplicate++; continue }
    seen.add(digits(phone))
    const dob = sheetDate(get('Date of birth') ?? '')
    const next = sheetDate(get('Next call date') ?? '')
    data.push({
      name,
      phone,
      altPhone: get('Alternate phone'),
      source: sources.get((get('Source') ?? '').toLowerCase()) ?? ('OTHER' as LeadSource),
      regionId: regions.find((x) => x.name.toLowerCase() === (get('Region') ?? '').toLowerCase())?.id ?? null,
      address: get('Address'),
      dob: dob ? parseDay(dob) : null,
      slot: get('Time slot'),
      avoidFoods: get('Foods to avoid'),
      healthNotes: get('Health issues'),
      notes: get('Notes'),
      nextFollowUpAt: next ? parseDay(next) : day(0),
      ownerId: user.id,
    })
  }
  if (data.length) {
    const made = await db.lead.createManyAndReturn({ data, select: { id: true } })
    await db.activity.createMany({ data: made.map((l) => ({ leadId: l.id, kind: 'lead', text: 'Lead added', detail: 'Imported from a file', byId: user.id })) })
  }
  revalidatePath('/', 'layout')
  redirect(`/leads?f=all&imported=${data.length}&duplicate=${duplicate}&missing=${missing}`)
}

export async function updateLead(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const data = leadFields(form)
  await db.lead.update({ where: { id }, data: { ...data, nextFollowUpAt: date(form, 'nextFollowUpAt') } })
  await log(id, 'lead', 'Details updated', null, user.id)
  revalidatePath('/', 'layout')
  redirect(back(form, `/leads?lead=${id}`))
}

export async function deleteLeads(form: FormData) {
  const user = await requireUser(['SALES'])
  const ids = form.getAll('ids').map(String).filter((x) => z.string().uuid().safeParse(x).success)
  const gone = await db.lead.findMany({ where: { id: { in: ids } }, select: { name: true, phone: true, status: true } })
  await db.lead.deleteMany({ where: { id: { in: ids } } })
  if (gone.length) await notifyAdmin(user, `Deleted ${gone.length} lead${gone.length > 1 ? 's' : ''}`, gone.map((l) => `${l.name}${l.phone ? ` (${l.phone})` : ''} · ${l.status}`).join('\n'))
  revalidatePath('/', 'layout')
  redirect(back(form, '/leads'))
}

// Call register
export async function logCallAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const outcome = z.enum(['INTERESTED', 'NO_ANSWER', 'CALL_BACK', 'TRIAL', 'MONTHLY', 'NOT_INTERESTED']).parse(s(form, 'outcome'))
  await attempt(form, '/calls', () =>
    logLeadCall(id, user.id, outcome, s(form, 'note'), {
      next: date(form, 'next'),
      trialDate: date(form, 'trialDate') ?? day(1),
      slot: s(form, 'trialSlot'),
      reason: reasonOf(form),
      start: packageStart(form),
    }),
  )
}

// Trials
export async function bookTrialAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'leadId'))
  await attempt(form, '/trials', () => bookTrial(id, user.id, date(form, 'trialDate') ?? day(1), s(form, 'slot')))
}

export async function trialFeedbackAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const result = z.enum(TrialResult).parse(s(form, 'result'))
  await attempt(form, '/trials', () =>
    trialFeedback(id, user.id, {
      result,
      feedback: s(form, 'feedback'),
      paid: form.get('paid') === 'on',
      next: date(form, 'next'),
      reason: reasonOf(form),
      start: packageStart(form),
    }),
  )
}

export async function startPackageAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const id = z.string().uuid().parse(s(form, 'leadId'))
  await attempt(form, `/customers/${id}`, () => startPackage(id, user.id, packageStart(form)))
}

// Add-on drink add-on: Rs 299 a month per bottle, Mon/Wed/Fri, monthly customers only.
export async function setButtermilkAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  const qty = z.coerce.number().int().min(0).max(5).parse(s(form, 'qty') ?? 0)
  const boxes = z.coerce.number().int().min(1).max(3).optional().parse(s(form, 'boxes') ?? undefined)
  const before = await db.package.findUniqueOrThrow({ where: { id } })
  const p = await db.package.update({ where: { id }, data: { buttermilkQty: qty, ...(boxes ? { boxesPerDay: boxes } : {}) } })
  if (qty !== before.buttermilkQty) await log(p.leadId, 'package', qty ? `Add-on drink: ${qty} bottle${qty > 1 ? 's' : ''}` : 'Add-on drink stopped', null, user.id)
  if (boxes && boxes !== before.boxesPerDay) await log(p.leadId, 'package', `Boxes each day: ${boxes}`, null, user.id)
  revalidatePath('/', 'layout')
  redirect(back(form, `/customers/${p.leadId}`))
}

// Monthly pack payment: marked paid when the money comes in, or back to not paid if it was a mistake.
export async function setPackagePaidAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  const paid = s(form, 'paid') === 'yes'
  const p = await db.package.update({ where: { id }, data: { paid, paidAt: paid ? new Date() : null } })
  await log(p.leadId, 'package', paid ? `Month ${p.number} paid` : `Month ${p.number} marked not paid`, paid ? `Rs ${p.price + p.buttermilkQty * p.buttermilkPrice}` : null, user.id)
  revalidatePath('/', 'layout')
  redirect(back(form, `/customers/${p.leadId}`))
}

// Daily menu, added by sales the day before.
export async function saveMenuAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const d = date(form, 'date') ?? day(1)
  const fruits = form.getAll('fruits').map(String)
  const swaps = form.getAll('swapFruits').map(String)
  const self = back(form, '/menu')
  if (fruits.length === 0) redirect(withError(self, new FlowError('Pick at least one fruit')))
  if (!(await dayOpen(user, d))) redirect(withError(self, new FlowError(lockedText(d))))
  const data = { fruits: fruits.join(', '), swapFruits: swaps.join(', '), salad: s(form, 'salad'), note: s(form, 'note'), byId: user.id }
  await db.menu.upsert({ where: { date: d }, create: { date: d, ...data }, update: data })
  revalidatePath('/', 'layout')
  redirect(`${self}${self.includes('?') ? '&' : '?'}saved=1`)
}

// Attendance entered from the paper sheet. One row per customer on the sheet.
// Leave told in advance: Absent on each delivery day from `from` to `to` (Sundays skipped).
export async function markLeaveAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const fallback = user.role === 'KITCHEN' ? '/kitchen/sheet' : '/attendance'
  let to = back(form, fallback)
  try {
    const leadId = z.string().uuid({ message: 'Pick the customer' }).safeParse(s(form, 'leadId'))
    if (!leadId.success) throw new FlowError('Pick the customer')
    const from = date(form, 'from')
    const until = date(form, 'to') ?? from
    if (!from || !until) throw new FlowError('Pick the leave date')
    if (from < day(0)) throw new FlowError('Leave can be marked for today or a later day. For a past day, enter Absent in Delivery attendance.')
    if (until < from) throw new FlowError('The Until date is before the leave date')
    if (until > addDays(from, 13)) throw new FlowError('Up to 14 days here. For a longer break, set the customer to Paused in Customers.')
    const dates: Date[] = []
    const hol = await holidaySet()
    for (let d = from; d <= until; d = addDays(d, 1)) if (!isSunday(d) && !hol.has(keyOf(d))) dates.push(d)
    const name = await markLeave(leadId.data, dates, user.id)
    const days = dates.length === 1 ? fmtDay(dates[0]) : `${dates.length} days from ${fmtDay(dates[0])}`
    to = `${to}${to.includes('?') ? '&' : '?'}leave=${encodeURIComponent(`${name} is on leave ${days}. They are off the attendance sheet.`)}`
  } catch (e) {
    to = withError(s(form, 'self') ?? back(form, fallback), e)
  }
  revalidatePath('/', 'layout')
  redirect(to)
}

export async function cancelLeaveAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const leadId = z.string().uuid().parse(s(form, 'leadId'))
  const d = date(form, 'date')
  if (d && d >= day(0)) {
    await cancelLeave(leadId, d, user.id)
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { name: true } })
    await notifyAdmin(user, 'Took back a leave', `${lead?.name ?? 'A customer'} · ${fmtWeekday(d)}`)
  }
  revalidatePath('/', 'layout')
  redirect(back(form, user.role === 'KITCHEN' ? '/kitchen/sheet' : '/attendance'))
}

// One row of the attendance screen, stored the moment it is tapped. Answers instead of moving to another page.
export async function saveAttendanceRowAction(dateKey: string, row: { leadId: string; status: string; buttermilk: boolean; boxBack: boolean | null; altBox: number | null; remarks: string | null; boxes?: number | null }) {
  const user = await requireUser(['SALES'])
  const parsed = z.object({
    leadId: z.string().uuid(),
    status: z.enum(['DELIVERED', 'ABSENT', 'NOT_DELIVERED']),
    buttermilk: z.boolean(),
    boxBack: z.boolean().nullable(),
    altBox: z.number().int().min(1).max(100).nullable(),
    remarks: z.string().max(300).nullable(),
    boxes: z.number().int().min(1).max(3).nullable().optional(),
  }).safeParse(row)
  if (!parsed.success || !isDay(dateKey)) return { ok: false }
  if (!(await dayOpen(user, parseDay(dateKey)))) return { ok: false }
  await saveAttendance(parseDay(dateKey), [parsed.data], user.id)
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Takes back a row entered by mistake, so it shows as "To enter" again.
export async function clearAttendanceRowAction(dateKey: string, leadId: string) {
  const user = await requireUser(['SALES'])
  if (!isDay(dateKey) || !z.string().uuid().safeParse(leadId).success) return { ok: false }
  if (!(await dayOpen(user, parseDay(dateKey)))) return { ok: false }
  const gone = await db.attendance.findFirst({ where: { leadId, date: parseDay(dateKey) }, include: { lead: { select: { name: true } } } })
  await db.attendance.deleteMany({ where: { leadId, date: parseDay(dateKey) } })
  if (gone) await notifyAdmin(user, 'Cleared an attendance entry', `${gone.lead.name} · ${fmtWeekday(parseDay(dateKey))} · was ${gone.status.replace('_', ' ').toLowerCase()}`)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveAttendanceAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const d = date(form, 'date') ?? day(0)
  if (!(await dayOpen(user, d))) redirect(withError(back(form, '/attendance'), new FlowError(lockedText(d))))
  const rows: AttendanceInput[] = []
  for (const leadId of form.getAll('lead').map(String)) {
    const st = s(form, `st_${leadId}`)
    if (!st) continue
    const box = s(form, `alt_${leadId}`)
    const back = s(form, `back_${leadId}`)
    rows.push({
      leadId,
      status: z.enum(['DELIVERED', 'ABSENT', 'NOT_DELIVERED']).parse(st),
      buttermilk: form.get(`bm_${leadId}`) === 'on',
      boxBack: back == null ? null : back === 'yes',
      altBox: box ? z.coerce.number().int().min(1).max(100).parse(box) : null,
      remarks: s(form, `rm_${leadId}`),
    })
  }
  await saveAttendance(d, rows, user.id)
  revalidatePath('/', 'layout')
  redirect(`${back(form, '/attendance')}&saved=${rows.length}`)
}

// End-date reminder: record it, then open WhatsApp with the message ready.
// The renewal answer, taken by sales (the kitchen's day 26 call stores the same answer).
// No: the customer moves to Not interested; the current month still runs to its last box.
export async function saveRenewalDecisionAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const packageId = z.string().uuid().parse(s(form, 'packageId'))
  const decision = z.enum(['YES', 'NO', 'UNDECIDED']).parse(s(form, 'decision'))
  const reason = s(form, 'reason') === 'Other' ? s(form, 'reasonOther') ?? 'Other' : s(form, 'reason')
  const pkg = await db.package.findUniqueOrThrow({ where: { id: packageId } })
  const data = { outcome: 'RENEWAL', renewal: decision, reason: decision === 'NO' ? reason : null, note: s(form, 'note'), byId: user.id }
  await db.customerCall.upsert({ where: { packageId_dayNo: { packageId, dayNo: 26 } }, create: { packageId, dayNo: 26, leadId: pkg.leadId, ...data }, update: data })
  await log(pkg.leadId, 'call', decision === 'YES' ? 'Renewal: continuing' : decision === 'NO' ? 'Renewal: not continuing' : 'Renewal: not decided', decision === 'NO' ? reason : null, user.id)
  if (decision === 'NO') await markNotInterested(pkg.leadId, user.id, reason)
  revalidatePath('/', 'layout')
  redirect(decision === 'YES' ? `/customers/${pkg.leadId}?start=1` : back(form, '/renewals'))
}

export async function sendReminderAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  const [{ pkg, plan }, st] = await Promise.all([packagePlan(id), getSettings()])
  await db.package.update({ where: { id }, data: { reminderSentAt: new Date() } })
  await log(pkg.leadId, 'reminder', 'End-date reminder sent on WhatsApp', null, user.id)
  revalidatePath('/', 'layout')
  redirect(waLink(pkg.lead.phone, fill(st.msgReminder, { name: firstName(pkg.lead.name), endDate: fmtWeekday(plan.end) })))
}

export async function requestLocationAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const channel = s(form, 'channel') === 'SMS' ? 'SMS' : 'WhatsApp'
  await createLocationRequest(id, channel, user.id)
  revalidatePath('/', 'layout')
  redirect(`/leads/${id}/location?channel=${channel}`)
}

// Monthly report: the note printed on it can be edited before printing.
export async function saveReportNoteAction(form: FormData) {
  await requireUser(['SALES', 'KITCHEN'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  await db.package.update({ where: { id }, data: { reportNote: s(form, 'reportNote') } })
  revalidatePath('/', 'layout')
  redirect(back(form, `/reports?pkg=${id}`))
}

export async function deleteRegion(form: FormData) {
  await requireUser(['ADMIN'])
  // Leads in this region stay; their region becomes "not set".
  await db.region.delete({ where: { id: z.string().uuid().parse(s(form, 'id')) } })
  revalidatePath('/', 'layout')
  redirect('/admin/users')
}

export async function deleteUser(form: FormData) {
  const me = await requireUser(['ADMIN'])
  const id = z.string().uuid().parse(s(form, 'id'))
  if (id === me.id) throw new Error('You cannot delete your own login')
  // Leads, regions and trial boxes of this user stay; they just lose the owner.
  await db.user.delete({ where: { id } })
  revalidatePath('/', 'layout')
  redirect('/admin/users')
}
