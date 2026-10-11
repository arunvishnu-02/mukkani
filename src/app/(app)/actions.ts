'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, fmtWeekday, parseDay } from '@/lib/dates'
import { getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { packagePlan } from '@/lib/queries'
import {
  FlowError,
  bookTrial,
  createLocationRequest,
  log,
  logLeadCall,
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
const date = (f: FormData, k: string) => (s(f, k) ? parseDay(s(f, k)!) : null)
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
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
  const lead = await db.lead.create({ data: { ...data, ownerId: user.id, nextFollowUpAt: date(form, 'nextFollowUpAt') ?? day(0) } })
  await log(lead.id, 'lead', 'Lead added', `Source: ${data.source.toLowerCase().replace('_', ' ')}`, user.id)
  revalidatePath('/', 'layout')
  redirect(`/leads?lead=${lead.id}`)
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
  await requireUser(['SALES'])
  const ids = form.getAll('ids').map(String)
  await db.lead.deleteMany({ where: { id: { in: ids } } })
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
      reason: s(form, 'reason'),
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
      reason: s(form, 'reason'),
      start: packageStart(form),
    }),
  )
}

export async function startPackageAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'leadId'))
  await attempt(form, `/customers/${id}`, () => startPackage(id, user.id, packageStart(form)))
}

// Buttermilk add-on: Rs 299 a month per bottle, Mon/Wed/Fri, monthly customers only.
export async function setButtermilkAction(form: FormData) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  const qty = z.coerce.number().int().min(0).max(5).parse(s(form, 'qty') ?? 0)
  const p = await db.package.update({ where: { id }, data: { buttermilkQty: qty } })
  await log(p.leadId, 'package', qty ? `Buttermilk: ${qty} bottle${qty > 1 ? 's' : ''}` : 'Buttermilk stopped', null, user.id)
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
  const data = { fruits: fruits.join(', '), swapFruits: swaps.join(', '), salad: s(form, 'salad'), note: s(form, 'note'), byId: user.id }
  await db.menu.upsert({ where: { date: d }, create: { date: d, ...data }, update: data })
  revalidatePath('/', 'layout')
  redirect(`${self}${self.includes('?') ? '&' : '?'}saved=1`)
}

// Attendance entered from the paper sheet. One row per customer on the sheet.
export async function saveAttendanceAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const d = date(form, 'date') ?? day(0)
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
