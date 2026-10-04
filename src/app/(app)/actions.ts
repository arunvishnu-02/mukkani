'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { parseCsv } from '@/lib/csv'
import { day, parseDay } from '@/lib/dates'
import { PACKAGE } from '@/lib/labels'
import { createLocationRequest, log, logCall, recordResult, setLeadStatus } from '@/lib/workflow'
import { LeadStatus, PackageStatus, Role } from '@/generated/prisma/enums'

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback

export async function createLead(form: FormData) {
  const user = await requireUser(['SALES'])
  const data = z
    .object({
      name: z.string().min(1),
      phone: z.string().min(6),
      address: z.string().nullable(),
      regionId: z.string().uuid().nullable(),
      notes: z.string().nullable(),
      foodNotes: z.string().nullable(),
    })
    .parse({
      name: s(form, 'name'),
      phone: s(form, 'phone'),
      address: s(form, 'address'),
      regionId: s(form, 'regionId'),
      notes: s(form, 'notes'),
      foodNotes: s(form, 'foodNotes'),
    })
  const lead = await db.lead.create({ data: { ...data, ownerId: user.id, nextFollowUpAt: day(0) } })
  await log(lead.id, 'lead', 'Lead added', null, user.id)
  revalidatePath('/leads')
  redirect(`/leads?lead=${lead.id}`)
}

export async function updateLead(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const status = z.enum(LeadStatus).parse(s(form, 'status'))
  const start = s(form, 'trialStart')
  const end = s(form, 'trialEnd')
  await db.lead.update({
    where: { id },
    data: {
      name: z.string().min(1).parse(s(form, 'name')),
      phone: z.string().min(6).parse(s(form, 'phone')),
      regionId: s(form, 'regionId'),
      notes: s(form, 'notes'),
      foodNotes: s(form, 'foodNotes'),
      address: s(form, 'address'),
      nextFollowUpAt: s(form, 'nextFollowUpAt') ? parseDay(s(form, 'nextFollowUpAt')!) : null,
    },
  })
  await setLeadStatus(
    id,
    status,
    user.id,
    { start: start ? parseDay(start) : undefined, end: end ? parseDay(end) : undefined },
    { startDate: s(form, 'startDate') ? parseDay(s(form, 'startDate')!) : day(1), slot: s(form, 'slot') },
  )
  revalidatePath('/', 'layout')
  redirect(back(form, `/leads?lead=${id}`))
}

export async function logCallAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const outcome = z.enum(['INTERESTED', 'CALL_BACK', 'TRIAL', 'NOT_INTERESTED']).parse(s(form, 'outcome'))
  const next = s(form, 'next')
  await logCall(id, user.id, outcome, s(form, 'note'), next ? parseDay(next) : null)
  revalidatePath('/', 'layout')
  redirect(back(form, '/follow-ups'))
}

export async function recordResultAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  if (s(form, 'result') === 'CONVERTED') {
    await recordResult(id, user.id, {
      converted: true,
      startDate: s(form, 'startDate') ? parseDay(s(form, 'startDate')!) : day(1),
      slot: s(form, 'slot') ?? '',
      regionId: s(form, 'regionId'),
    })
  } else {
    await recordResult(id, user.id, { converted: false, next: s(form, 'next') === 'LOST' ? 'LOST' : 'FOLLOW_UP' })
  }
  revalidatePath('/', 'layout')
  redirect('/boxes')
}

export async function setPackageStatusAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const pkg = await db.package.update({
    where: { id: z.string().uuid().parse(s(form, 'id')) },
    data: { status: z.enum(PackageStatus).parse(s(form, 'status')) },
  })
  await log(pkg.leadId, 'package', `Package ${pkg.status.toLowerCase()}`, pkg.packageType, user.id)
  revalidatePath('/', 'layout')
  redirect(back(form, '/boxes?tab=regular'))
}

export async function requestLocationAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  const channel = s(form, 'channel') === 'SMS' ? 'SMS' : 'WhatsApp'
  await createLocationRequest(id, channel, user.id)
  revalidatePath('/', 'layout')
  redirect(`/leads/${id}/location?channel=${channel}`)
}

// A customer added directly: someone who starts a monthly package without going through a lead and a trial.
export async function createCustomer(form: FormData) {
  const user = await requireUser(['SALES'])
  const name = z.string().min(1).parse(s(form, 'name'))
  const phone = z.string().min(6).parse(s(form, 'phone'))
  const digits = (v: string) => v.replace(/\D/g, '')
  const taken = (await db.lead.findMany({ select: { id: true, phone: true } })).find((l) => digits(l.phone) === digits(phone))
  if (taken) redirect(`/customers?new=1&error=phone&lead=${taken.id}`)
  const lead = await db.lead.create({
    data: {
      name, phone, status: 'CONVERTED', ownerId: user.id,
      regionId: z.string().uuid().nullable().parse(s(form, 'regionId')),
      address: s(form, 'address'), foodNotes: s(form, 'foodNotes'), notes: s(form, 'notes'), slot: s(form, 'slot'),
      packages: { create: { packageType: PACKAGE, startDate: s(form, 'startDate') ? parseDay(s(form, 'startDate')!) : day(0) } },
    },
  })
  await log(lead.id, 'package', 'Customer added', PACKAGE, user.id)
  revalidatePath('/', 'layout')
  redirect(`/customers/${lead.id}`)
}

// Customers from a CSV file in the format of the sample file. A phone number already in the CRM is skipped, so the
// same file can be imported twice without making duplicates.
export async function importCustomers(form: FormData) {
  const user = await requireUser(['SALES'])
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) redirect('/customers?import=1&error=nofile')
  const [header, ...rows] = parseCsv(await file.text())
  const col = (name: string) => (header ?? []).findIndex((h) => h.toLowerCase() === name)
  const at = { name: col('name'), phone: col('phone'), location: col('location'), address: col('address'), health: col('health issues'), notes: col('notes'), slot: col('slot'), start: col('start date'), status: col('status') }
  if (at.name < 0 || at.phone < 0) redirect('/customers?import=1&error=columns')
  const digits = (v: string) => v.replace(/\D/g, '')
  const [regions, existing] = await Promise.all([db.region.findMany(), db.lead.findMany({ select: { phone: true } })])
  const known = new Set(existing.map((l) => digits(l.phone)))
  let added = 0, skipped = 0, invalid = 0
  for (const r of rows) {
    const get = (i: number) => (i >= 0 && r[i] ? r[i] : null)
    const name = get(at.name)
    const phone = get(at.phone)
    if (!name || !phone || digits(phone).length < 6) { invalid++; continue }
    if (known.has(digits(phone))) { skipped++; continue }
    known.add(digits(phone))
    const location = get(at.location)
    const region = location ? regions.find((x) => x.name.toLowerCase() === location.toLowerCase()) : undefined
    // Start date as 2026-10-04, or 04/10/2026 and 04-10-2026 the way Excel saves it.
    const raw = get(at.start)
    const dmy = raw?.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
    const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : raw
    const start = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(parseDay(iso).getTime()) ? parseDay(iso) : day(0)
    const lead = await db.lead.create({
      data: {
        name, phone, status: 'CONVERTED', ownerId: user.id, regionId: region?.id ?? null,
        // A location that is not one of the regions is kept in the address, so nothing from the file is lost.
        address: get(at.address) ?? (region ? null : location),
        foodNotes: get(at.health), notes: get(at.notes), slot: get(at.slot),
        packages: { create: { packageType: PACKAGE, startDate: start, status: get(at.status)?.toLowerCase().startsWith('pause') ? 'PAUSED' : 'ACTIVE' } },
      },
    })
    await log(lead.id, 'package', 'Customer imported from file', PACKAGE, user.id)
    added++
  }
  revalidatePath('/', 'layout')
  redirect(`/customers?added=${added}&skipped=${skipped}&invalid=${invalid}`)
}

// Admin
export async function saveUser(form: FormData) {
  await requireUser(['ADMIN'])
  const id = s(form, 'id')
  const data = {
    name: z.string().min(1).parse(s(form, 'name')),
    username: z.string().min(3).parse(s(form, 'username')?.toLowerCase()),
    role: z.enum(Role).parse(s(form, 'role')),
    phone: s(form, 'phone'),
    active: form.get('active') !== 'off',
  }
  const password = s(form, 'password')
  if (id) {
    await db.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) } })
  } else {
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters')
    await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } })
  }
  revalidatePath('/admin/users')
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

export async function saveRegion(form: FormData) {
  await requireUser(['ADMIN'])
  const id = s(form, 'id')
  const num = (k: string) => (s(form, k) ? Number(s(form, k)) : null)
  const data = { name: z.string().min(1).parse(s(form, 'name')), lat: num('lat'), lng: num('lng'), ownerId: s(form, 'ownerId') }
  if (id) await db.region.update({ where: { id }, data })
  else await db.region.create({ data })
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function deleteRegion(form: FormData) {
  await requireUser(['ADMIN'])
  // Leads in this region stay; their region becomes "not set".
  await db.region.delete({ where: { id: z.string().uuid().parse(s(form, 'id')) } })
  revalidatePath('/', 'layout')
  redirect('/admin/users')
}
