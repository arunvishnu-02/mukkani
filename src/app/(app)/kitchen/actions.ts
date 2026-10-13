'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, isDay, parseDay } from '@/lib/dates'
import { log, logCustomerCall, markRenewalPaid, setCustomerStatus } from '@/lib/workflow'
import { WASTE_REASONS } from '@/lib/labels'
import { appSettings } from '@/lib/settings'
import { dayOpen, lockedText } from '@/lib/lock'

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const date = (f: FormData, k: string) => (isDay(s(f, k)) ? parseDay(s(f, k)!) : null)
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
const locked = (to: string, d: Date): never => redirect(`${to}${to.includes('?') ? '&' : '?'}error=${encodeURIComponent(lockedText(d))}`)
const kg = (v: string | null) => (v == null ? null : z.coerce.number().min(0).max(10000).parse(v))

function done(path: string): never {
  revalidatePath('/', 'layout')
  redirect(path)
}

export async function setCustomerStatusAction(form: FormData) {
  const user = await requireUser(['KITCHEN', 'SALES'])
  const leadId = z.string().uuid().parse(s(form, 'leadId'))
  const status = z.enum(['ACTIVE', 'ABSENT', 'PAUSED', 'INACTIVE']).parse(s(form, 'status'))
  await setCustomerStatus(leadId, user.id, status, date(form, 'date'))
  done(back(form, user.role === 'KITCHEN' ? '/kitchen/customers' : '/customers'))
}

// Day 1/5/15/26 calls. Day 26 is the renewal call.
export async function customerCallAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const packageId = z.string().uuid().parse(s(form, 'packageId'))
  const dayNo = z.coerce.number().int().min(1).max(26).parse(s(form, 'dayNo'))
  const renewal = s(form, 'renewal')
  const outcome = s(form, 'outcome') ?? (renewal ? 'RENEWAL' : null)
  if (!outcome) redirect(`/kitchen/calls?call=${packageId}&error=${encodeURIComponent('Pick how the call went')}`)
  await logCustomerCall(packageId, dayNo, user.id, { outcome, note: s(form, 'note'), renewal, reason: renewal === 'NO' ? (s(form, 'reason') === 'Other' && s(form, 'reasonOther') ? `Other: ${s(form, 'reasonOther')}` : s(form, 'reason')) : null })
  if (renewal === 'YES' && form.get('paid') === 'on') await markRenewalPaid(packageId, user.id)
  done(back(form, '/kitchen/calls'))
}

// Payment screenshot came in: the next package starts after the last day of this one.
export async function markPaidAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const packageId = z.string().uuid().parse(s(form, 'packageId'))
  await markRenewalPaid(packageId, user.id)
  done(back(form, '/kitchen/calls'))
}

export async function addAltBoxAction(form: FormData) {
  const user = await requireUser(['KITCHEN', 'SALES'])
  const to = back(form, '/kitchen/alt-boxes')
  const stop = (msg: string): never => redirect(`${to}${to.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`)
  // The box goes to a customer, or to someone else whose name is typed (a shop, a staff member).
  const lead = z.string().uuid().safeParse(s(form, 'leadId'))
  const holder = lead.success ? null : s(form, 'holder')
  if (!lead.success && !holder) stop('Pick the customer, or type who has the box')
  const { altBoxTotal } = await appSettings()
  const boxNo = Number(s(form, 'boxNo'))
  if (!Number.isInteger(boxNo) || boxNo < 1 || boxNo > altBoxTotal) stop(`Pick a box number from 1 to ${altBoxTotal}`)
  const out = await db.altBox.findFirst({ where: { boxNo, collectedOn: null }, include: { lead: { select: { name: true } } } })
  if (out) stop(`Box ${boxNo} is still with ${out.lead?.name ?? out.holder ?? 'someone'}. Mark it collected first.`)
  const givenOn = date(form, 'givenOn') ?? day(0)
  if (!(await dayOpen(user, givenOn))) locked(to, givenOn)
  await db.altBox.create({ data: { leadId: lead.success ? lead.data : null, holder, boxNo, givenOn } })
  if (lead.success) await log(lead.data, 'box', `Alternative box ${boxNo} sent`, null, user.id)
  done(to)
}

export async function collectAltBoxAction(form: FormData) {
  const user = await requireUser(['KITCHEN', 'SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const collected = s(form, 'collected') === 'yes'
  const box = await db.altBox.update({ where: { id }, data: { collectedOn: collected ? day(0) : null } })
  if (collected && box.leadId) await log(box.leadId, 'box', `Alternative box ${box.boxNo} collected`, null, user.id)
  done(back(form, '/kitchen/alt-boxes'))
}

export async function addStockAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const fruit = z.string().min(1).parse(s(form, 'fruit'))
  const qty = kg(s(form, 'qtyKg'))
  if (!qty) redirect(`${back(form, '/kitchen/stock')}${back(form, '/kitchen/stock').includes('?') ? '&' : '?'}error=${encodeURIComponent('Enter the quantity in kg')}`)
  const on = date(form, 'date') ?? day(0)
  if (!(await dayOpen(user, on))) locked(back(form, '/kitchen/stock'), on)
  await db.stockEntry.create({
    data: { fruit, kind: s(form, 'kind') === 'USED' ? 'USED' : 'IN', qtyKg: qty!, date: on, note: s(form, 'note'), byId: user.id },
  })
  done(back(form, '/kitchen/stock'))
}

export async function deleteStockAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const entry = await db.stockEntry.findUniqueOrThrow({ where: { id: z.string().uuid().parse(s(form, 'id')) } })
  if (!(await dayOpen(user, entry.date))) locked(back(form, '/kitchen/stock'), entry.date)
  await db.stockEntry.delete({ where: { id: entry.id } })
  done(back(form, '/kitchen/stock'))
}

// One row per fruit for the day: cut today (kg), waste (kg) and the reason.
export async function saveWastageAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const d = date(form, 'date') ?? day(0)
  if (!(await dayOpen(user, d))) locked(back(form, '/kitchen/wastage'), d)
  for (const fruit of form.getAll('fruit').map(String)) {
    const waste = kg(s(form, `waste_${fruit}`))
    const cut = kg(s(form, `cut_${fruit}`))
    if (waste == null && cut == null) {
      await db.wastage.deleteMany({ where: { date: d, fruit } })
      continue
    }
    const picked = z.enum(WASTE_REASONS).parse(s(form, `reason_${fruit}`) ?? WASTE_REASONS[0])
    const why = s(form, `reasonNote_${fruit}`)
    const reason = picked === 'Other' && why ? `Other: ${why}` : picked
    const data = { cutKg: cut ?? 0, wasteKg: waste ?? 0, reason, byId: user.id }
    await db.wastage.upsert({ where: { date_fruit: { date: d, fruit } }, create: { date: d, fruit, ...data }, update: data })
  }
  done(back(form, '/kitchen/wastage'))
}
