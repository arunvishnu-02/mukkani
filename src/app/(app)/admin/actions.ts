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

// Saves an uploaded photo in the database. Returns null when no file was picked.
async function saveUpload(file: FormDataEntryValue | null, kind: string, self: string) {
  if (!(file instanceof File) || file.size === 0) return null
  if (file.size > MAX_UPLOAD) fail(self, 'The photo is larger than 5 MB')
  if (!IMAGE_TYPES.includes(file.type)) fail(self, 'Upload a photo (JPG, PNG) or a PDF')
  const up = await db.upload.create({
    data: { kind, name: file.name.slice(0, 180), mime: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()) },
  })
  return up.id
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
  for (const k of ['monthlyPrice', 'trialPrice', 'buttermilkPrice', 'lowStockKg'] as const) {
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
  const billId = await saveUpload(form.get('bill'), 'bill', self)
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
    const old = await db.moneyEntry.findUniqueOrThrow({ where: { id } })
    await db.moneyEntry.update({ where: { id }, data: { ...data, ...(billId ? { billId } : {}) } })
    if (billId && old.billId) await db.upload.deleteMany({ where: { id: old.billId } })
  } else {
    await db.moneyEntry.create({ data: { ...data, billId, byId: user.id } })
  }
  done(back(form, '/admin/money'))
}

export async function deleteMoneyEntries(form: FormData) {
  await requireUser(['ADMIN'])
  const ids = form.getAll('ids').map(String).filter(Boolean)
  const rows = await db.moneyEntry.findMany({ where: { id: { in: ids } }, select: { billId: true } })
  await db.moneyEntry.deleteMany({ where: { id: { in: ids } } })
  const bills = rows.map((r) => r.billId).filter((x): x is string => !!x)
  if (bills.length) await db.upload.deleteMany({ where: { id: { in: bills } } })
  done(back(form, '/admin/money'))
}
