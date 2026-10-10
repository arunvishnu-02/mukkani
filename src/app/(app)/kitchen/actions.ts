'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, parseDay } from '@/lib/dates'
import { log, logCustomerCall, markRenewalPaid, setCustomerStatus } from '@/lib/workflow'
import { WASTE_REASONS } from '@/lib/labels'

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const date = (f: FormData, k: string) => (s(f, k) ? parseDay(s(f, k)!) : null)
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
const kg = (v: string | null) => (v == null ? null : z.coerce.number().min(0).max(10000).parse(v))

function done(path: string): never {
  revalidatePath('/', 'layout')
  redirect(path)
}

export async function setCustomerStatusAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const leadId = z.string().uuid().parse(s(form, 'leadId'))
  const status = z.enum(['ACTIVE', 'ABSENT', 'PAUSED', 'INACTIVE']).parse(s(form, 'status'))
  await setCustomerStatus(leadId, user.id, status, date(form, 'date'))
  done(back(form, '/kitchen/customers'))
}

// Day 1/5/15/26 calls. Day 26 is the renewal call.
export async function customerCallAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const packageId = z.string().uuid().parse(s(form, 'packageId'))
  const dayNo = z.coerce.number().int().min(1).max(26).parse(s(form, 'dayNo'))
  const renewal = s(form, 'renewal')
  const outcome = s(form, 'outcome') ?? (renewal ? 'RENEWAL' : null)
  if (!outcome) redirect(`/kitchen/calls?call=${packageId}&error=${encodeURIComponent('Pick how the call went')}`)
  await logCustomerCall(packageId, dayNo, user.id, { outcome, note: s(form, 'note'), renewal, reason: renewal === 'NO' ? s(form, 'reason') : null })
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
  const leadId = z.string().uuid().parse(s(form, 'leadId'))
  const boxNo = z.coerce.number().int().min(1).max(100).parse(s(form, 'boxNo'))
  const givenOn = date(form, 'givenOn') ?? day(0)
  await db.altBox.create({ data: { leadId, boxNo, givenOn } })
  await log(leadId, 'box', `Alternative box ${boxNo} sent`, null, user.id)
  done(back(form, '/kitchen/alt-boxes'))
}

export async function collectAltBoxAction(form: FormData) {
  const user = await requireUser(['KITCHEN', 'SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const collected = s(form, 'collected') === 'yes'
  const box = await db.altBox.update({ where: { id }, data: { collectedOn: collected ? day(0) : null } })
  if (collected) await log(box.leadId, 'box', `Alternative box ${box.boxNo} collected`, null, user.id)
  done(back(form, '/kitchen/alt-boxes'))
}

export async function addStockAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const fruit = z.string().min(1).parse(s(form, 'fruit'))
  const qty = kg(s(form, 'qtyKg'))
  if (!qty) redirect(`${back(form, '/kitchen/stock')}${back(form, '/kitchen/stock').includes('?') ? '&' : '?'}error=${encodeURIComponent('Enter the quantity in kg')}`)
  await db.stockEntry.create({
    data: { fruit, kind: s(form, 'kind') === 'USED' ? 'USED' : 'IN', qtyKg: qty, date: date(form, 'date') ?? day(0), note: s(form, 'note'), byId: user.id },
  })
  done(back(form, '/kitchen/stock'))
}

export async function deleteStockAction(form: FormData) {
  await requireUser(['KITCHEN'])
  await db.stockEntry.delete({ where: { id: z.string().uuid().parse(s(form, 'id')) } })
  done(back(form, '/kitchen/stock'))
}

// One row per fruit for the day: cut today (kg), waste (kg) and the reason.
export async function saveWastageAction(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const d = date(form, 'date') ?? day(0)
  for (const fruit of form.getAll('fruit').map(String)) {
    const waste = kg(s(form, `waste_${fruit}`))
    const cut = kg(s(form, `cut_${fruit}`))
    if (waste == null && cut == null) {
      await db.wastage.deleteMany({ where: { date: d, fruit } })
      continue
    }
    const reason = z.enum(WASTE_REASONS).parse(s(form, `reason_${fruit}`) ?? WASTE_REASONS[0])
    const data = { cutKg: cut ?? 0, wasteKg: waste ?? 0, reason, byId: user.id }
    await db.wastage.upsert({ where: { date_fruit: { date: d, fruit } }, create: { date: d, fruit, ...data }, update: data })
  }
  done(back(form, '/kitchen/wastage'))
}
