'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, parseDay } from '@/lib/dates'
import { DEFAULTS, type SettingKey } from '@/lib/settings'
import { Role } from '@/generated/prisma/enums'

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
const fail = (url: string, msg: string): never => redirect(`${url}${url.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`)

function done(path: string): never {
  revalidatePath('/', 'layout')
  redirect(path)
}

const MAX_UPLOAD = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

const MAX_BILLS = 6

const picked = (file: FormDataEntryValue | null): file is File => file instanceof File && file.size > 0

function checkUpload(file: File, self: string) {
  if (file.size > MAX_UPLOAD) fail(self, `${file.name} is larger than 5 MB`)
  if (!IMAGE_TYPES.includes(file.type)) fail(self, 'Upload a photo (JPG, PNG) or a PDF')
}

// Saves an uploaded photo in the database. Returns null when no file was picked.
async function saveUpload(file: FormDataEntryValue | null, kind: string, self: string) {
  if (!picked(file)) return null
  checkUpload(file, self)
  const up = await db.upload.create({
    data: { kind, name: file.name.slice(0, 180), mime: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()) },
  })
  return up.id
}

// A monthly pack paid: the payment screenshots (UPI / GPay) and a note. Sales and admin.
// Posted through /api/form/payment because it carries photos.
export async function savePackagePayment(form: FormData) {
  const user = await requireUser(['SALES'])
  const id = z.string().uuid().parse(s(form, 'packageId'))
  const old = await db.package.findUniqueOrThrow({ where: { id } })
  const self = back(form, `/customers/${old.leadId}`)
  const remove = form.getAll('removeProof').map(String).filter((x) => old.paymentProofIds.includes(x))
  const keep = old.paymentProofIds.filter((x) => !remove.includes(x))
  const files = form.getAll('proof').filter(picked)
  if (keep.length + files.length > 4) fail(self, 'Up to 4 payment screenshots')
  for (const f of files) checkUpload(f, self)
  const added: string[] = []
  for (const f of files) added.push((await saveUpload(f, 'payment', self))!)
  const note = s(form, 'paymentNote')?.slice(0, 200) ?? null
  await db.package.update({ where: { id }, data: { paid: true, paidAt: old.paidAt ?? new Date(), paymentProofIds: [...keep, ...added], paymentNote: note } })
  if (remove.length) await db.upload.deleteMany({ where: { id: { in: remove }, kind: 'payment' } })
  if (!old.paid) await db.activity.create({ data: { leadId: old.leadId, kind: 'package', text: `Month ${old.number} paid`, detail: [`Rs ${old.price + old.buttermilkQty * old.buttermilkPrice}`, note, added.length ? `${added.length} screenshot${added.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' · '), byId: user.id } })
  done(`/customers/${old.leadId}?paid=1`)
}

export async function backupNow() {
  await requireUser(['ADMIN'])
  const { makeBackup } = await import('@/lib/backup')
  let to = '/admin/backups'
  try {
    const r = await makeBackup('by admin')
    to = `/admin/backups?made=${encodeURIComponent(r.name)}`
  } catch (e) {
    to = `/admin/backups?error=${encodeURIComponent(`Backup failed: ${(e as Error).message}`)}`
  }
  redirect(to)
}

// Team + regions
export async function saveUser(form: FormData) {
  await requireUser(['ADMIN'])
  const id = s(form, 'id')
  const self = `/admin/users?user=${id ?? 'new'}`
  const data = {
    name: z.string().min(1).parse(s(form, 'name')),
    username: z.string().min(3).parse(s(form, 'username')?.toLowerCase()),
    role: z.enum(Role).parse(s(form, 'role')),
    phone: s(form, 'phone'),
    active: form.get('active') !== 'off',
  }
  const password = s(form, 'password')
  if (password && password.length < 6) fail(self, 'Password must be at least 6 characters')
  const taken = await db.user.findUnique({ where: { username: data.username } })
  if (taken && taken.id !== id) fail(self, `The username "${data.username}" is already used`)
  if (id) {
    await db.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) } })
  } else {
    if (!password) fail(self, 'Set a password for the new user')
    await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password!, 10) } })
  }
  done('/admin/users')
}

export async function saveRegion(form: FormData) {
  await requireUser(['ADMIN'])
  const id = s(form, 'id')
  const num = (k: string) => (s(form, k) ? z.coerce.number().min(-180).max(180).parse(s(form, k)) : null)
  const data = { name: z.string().min(1).parse(s(form, 'name')), lat: num('lat'), lng: num('lng'), ownerId: s(form, 'ownerId') }
  const taken = await db.region.findUnique({ where: { name: data.name } })
  if (taken && taken.id !== id) fail(`/admin/users?region=${id ?? 'new'}`, `The region "${data.name}" already exists`)
  if (id) await db.region.update({ where: { id }, data })
  else await db.region.create({ data })
  done('/admin/users')
}

// Settings: every key from DEFAULTS that the form sends, plus the payment QR image.
export async function saveSettings(form: FormData) {
  await requireUser(['ADMIN'])
  const self = back(form, '/admin/settings')
  for (const k of ['monthlyPrice', 'trialPrice', 'buttermilkPrice', 'lowStockKg', 'altBoxTotal'] as const) {
    const v = s(form, k)
    if (v != null && !(Number(v) >= 0)) fail(self, 'Prices and stock limits must be numbers')
  }
  const keys = Object.keys(DEFAULTS).filter((k) => k !== 'paymentQrId' && form.has(k)) as SettingKey[]
  for (const key of keys) {
    const value = String(form.get(key) ?? '').replace(/\r\n/g, '\n').trim() || DEFAULTS[key]
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
  }
  const qr = await saveUpload(form.get('qr'), 'qr', self)
  if (qr) {
    const old = await db.setting.findUnique({ where: { key: 'paymentQrId' } })
    await db.setting.upsert({ where: { key: 'paymentQrId' }, create: { key: 'paymentQrId', value: qr }, update: { value: qr } })
    if (old?.value) await db.upload.deleteMany({ where: { id: old.value, kind: 'qr' } })
  }
  done(`${self}${self.includes('?') ? '&' : '?'}saved=1`)
}

// Purchase + expenses
export async function saveMoneyEntry(form: FormData) {
  const user = await requireUser(['ADMIN'])
  const id = s(form, 'id')
  const self = s(form, 'self') ?? '/admin/money?add=1'
  const item = s(form, 'item')
  const amount = Number(s(form, 'amount'))
  if (!item) fail(self, 'Enter what was bought or paid for')
  if (!(amount > 0)) fail(self, 'Enter the amount')
  const old = id ? await db.moneyEntry.findUniqueOrThrow({ where: { id } }) : null
  const remove = form.getAll('removeBill').map(String).filter((x) => old?.billIds.includes(x))
  const keep = (old?.billIds ?? []).filter((x) => !remove.includes(x))
  const files = form.getAll('bill').filter(picked)
  if (keep.length + files.length > MAX_BILLS) fail(self, `An entry can have up to ${MAX_BILLS} bill photos`)
  for (const f of files) checkUpload(f, self)
  const added: string[] = []
  for (const f of files) added.push((await saveUpload(f, 'bill', self))!)
  const billIds = [...keep, ...added]
  const data = {
    date: s(form, 'date') ? parseDay(s(form, 'date')!) : day(0),
    type: s(form, 'type') === 'EXPENSE' ? ('EXPENSE' as const) : ('PURCHASE' as const),
    item: item!,
    category: s(form, 'category') ?? 'Other bills',
    quantity: s(form, 'quantity'),
    amount: Math.round(amount),
    paidTo: s(form, 'paidTo'),
  }
  if (id) {
    await db.moneyEntry.update({ where: { id }, data: { ...data, billIds } })
    if (remove.length) await db.upload.deleteMany({ where: { id: { in: remove }, kind: 'bill' } })
  } else {
    await db.moneyEntry.create({ data: { ...data, billIds, byId: user.id } })
  }
  done(back(form, '/admin/money'))
}

export async function deleteMoneyEntries(form: FormData) {
  await requireUser(['ADMIN'])
  const ids = form.getAll('ids').map(String).filter(Boolean)
  const rows = await db.moneyEntry.findMany({ where: { id: { in: ids } }, select: { billIds: true } })
  await db.moneyEntry.deleteMany({ where: { id: { in: ids } } })
  const bills = rows.flatMap((r) => r.billIds)
  if (bills.length) await db.upload.deleteMany({ where: { id: { in: bills } } })
  done(back(form, '/admin/money'))
}
