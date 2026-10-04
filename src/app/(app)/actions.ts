'use server'

import { PACKAGE_TYPES } from '@/lib/labels'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, parseDay } from '@/lib/dates'
import { createLocationRequest, log, logCall, moveTrial, recordResult, setLeadStatus } from '@/lib/workflow'
import { LeadSource, LeadStatus, PackageStatus, Role, TrialStatus } from '@/generated/prisma/enums'

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
      altPhone: z.string().nullable(),
      address: z.string().nullable(),
      regionId: z.string().uuid().nullable(),
      source: z.enum(LeadSource),
      notes: z.string().nullable(),
      foodNotes: z.string().nullable(),
    })
    .parse({
      name: s(form, 'name'),
      phone: s(form, 'phone'),
      altPhone: s(form, 'altPhone'),
      address: s(form, 'address'),
      regionId: s(form, 'regionId'),
      source: s(form, 'source') ?? 'CALL',
      notes: s(form, 'notes'),
      foodNotes: s(form, 'foodNotes'),
    })
  const lead = await db.lead.create({ data: { ...data, ownerId: user.id, nextFollowUpAt: day(0) } })
  await log(lead.id, 'lead', 'Lead added', `Source: ${data.source.toLowerCase()}`, user.id)
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
      regionId: s(form, 'regionId'),
      notes: s(form, 'notes'),
      foodNotes: s(form, 'foodNotes'),
      address: s(form, 'address'),
      altPhone: s(form, 'altPhone'),
      nextFollowUpAt: s(form, 'nextFollowUpAt') ? parseDay(s(form, 'nextFollowUpAt')!) : null,
    },
  })
  await setLeadStatus(id, status, user.id, {
    start: start ? parseDay(start) : undefined,
    end: end ? parseDay(end) : undefined,
  })
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

export async function moveTrialAction(form: FormData) {
  const user = await requireUser(['SALES'])
  await moveTrial(z.string().uuid().parse(s(form, 'id')), z.enum(TrialStatus).parse(s(form, 'status')), user.id)
  revalidatePath('/', 'layout')
  redirect(back(form, '/boxes'))
}

export async function recordResultAction(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'id'))
  if (s(form, 'result') === 'CONVERTED') {
    await recordResult(id, user.id, {
      converted: true,
      packageType: s(form, 'packageType') ?? PACKAGE_TYPES[0],
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
