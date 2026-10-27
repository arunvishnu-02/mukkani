'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'
import { SHIFT1, SHIFT2 } from '@/lib/shifts'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, fmtWeekday, isDay, parseDay } from '@/lib/dates'
import { DUE_KINDS, ISSUE_DEPARTMENTS, ISSUE_STATUS } from '@/lib/labels'
import { FlowError, createLeadInvite } from '@/lib/workflow'
import { dayOpen, lockedText } from '@/lib/lock'
import { notifyAdmin } from '@/lib/notice'

// Daily issues (sales), staff tracking (kitchen manager), dues (admin) and the hand-set order of the attendance sheet.

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v === '' ? null : v
}
const date = (f: FormData, k: string) => (isDay(s(f, k)) ? parseDay(s(f, k)!) : null)
const back = (f: FormData, fallback: string) => s(f, 'back') ?? fallback
const id = (f: FormData, k = 'id') => z.string().uuid().parse(s(f, k))
const fail = (url: string, msg: string): never => redirect(`${url}${url.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`)
const yesNo = (v: string | null) => (v === 'yes' ? true : v === 'no' ? false : null)
const whole = (v: string | null, max: number) => (v == null ? null : z.coerce.number().int().min(0).max(max).parse(v))

function done(path: string): never {
  revalidatePath('/', 'layout')
  redirect(path)
}

// Daily issues
export async function saveIssue(form: FormData) {
  const user = await requireUser(['SALES'])
  const self = s(form, 'self') ?? '/issues?add=1'
  const issue = s(form, 'issue')
  if (!issue) fail(self, 'Write what the issue is')
  const data = {
    date: date(form, 'date') ?? day(0),
    // Other with a typed name is saved under that name.
    department: s(form, 'department') === 'Other' ? (s(form, 'departmentOther') ?? 'Other') : ISSUE_DEPARTMENTS.includes(s(form, 'department') ?? '') ? s(form, 'department')! : 'Other',
    issue: issue!,
    responsible: s(form, 'responsible'),
    status: (s(form, 'status') ?? 'OPEN') in ISSUE_STATUS ? (s(form, 'status') ?? 'OPEN') : 'OPEN',
    followUp: s(form, 'followUp'),
    remarks: s(form, 'remarks'),
  }
  if (s(form, 'id')) await db.issue.update({ where: { id: id(form) }, data })
  else await db.issue.create({ data: { ...data, byId: user.id } })
  done(back(form, '/issues'))
}

export async function setIssueStatus(form: FormData) {
  await requireUser(['SALES'])
  const status = s(form, 'status') ?? ''
  if (status in ISSUE_STATUS) await db.issue.update({ where: { id: id(form) }, data: { status } })
  done(back(form, '/issues'))
}

export async function deleteIssue(form: FormData) {
  const user = await requireUser(['SALES'])
  const issue = await db.issue.delete({ where: { id: id(form) } })
  await notifyAdmin(user, 'Deleted a daily issue', `${issue.department} · ${issue.issue}`)
  done(back(form, '/issues'))
}

// Office holidays: the whole service is off that day. Sales and admin set them on the Calendar.
export async function addHoliday(form: FormData) {
  const user = await requireUser(['SALES'])
  const d = date(form, 'date')
  const name = s(form, 'name')?.slice(0, 80) ?? 'Office holiday'
  const self = back(form, '/calendar')
  if (!d) fail(self, 'Pick the holiday date')
  if (d!.getUTCDay() === 0) fail(self, 'Sunday is already a holiday')
  await db.holiday.upsert({ where: { date: d! }, create: { date: d!, name, byId: user.id }, update: { name } })
  done(self)
}

export async function removeHoliday(form: FormData) {
  const user = await requireUser(['SALES'])
  const h = await db.holiday.findUnique({ where: { id: id(form) } })
  if (h) {
    await db.holiday.delete({ where: { id: h.id } })
    await notifyAdmin(user, 'Removed an office holiday', `${h.date.toISOString().slice(0, 10)} · ${h.name}`)
  }
  done(back(form, '/calendar'))
}

// Office staff (the admin's own team): attendance entered by admin only, never shown to the kitchen manager.
export async function saveOfficeAttendance(form: FormData) {
  const user = await requireUser(['ADMIN'])
  const d = date(form, 'date') ?? day(0)
  const self = back(form, '/admin/staff')
  const ids = form.getAll('staff').map(String).filter((x) => z.string().uuid().safeParse(x).success)
  const people = await db.staff.findMany({ where: { id: { in: ids }, active: true, kind: 'OFFICE' } })
  const rows: { staffId: string; attendance: string; inTime: string | null; outTime: string | null; remarks: string | null }[] = []
  for (const p of people) {
    const g = (k: string) => s(form, `${k}_${p.id}`)
    const att = g('att')
    if (att !== 'PRESENT' && att !== 'ABSENT') fail(self, `Choose Present or Absent for ${p.name}`)
    const present = att === 'PRESENT'
    const inTime = present ? g('in') : null; const outTime = present ? g('out') : null
    if (present && (!inTime || !outTime)) fail(self, `${p.name}: fill the in time and out time`)
    if (present && outTime! < inTime!) fail(self, `${p.name}: the out time is before the in time`)
    rows.push({ staffId: p.id, attendance: att!, inTime, outTime, remarks: g('remarks') })
  }
  if (rows.length === 0) fail(self, 'No office staff to save')
  for (const r of rows) {
    const data = { attendance: r.attendance, inTime: r.inTime, outTime: r.outTime, remarks: r.remarks, idCard: null, uniform: null, onTimePickup: null, inTime2: null, outTime2: null, startKm: null, endKm: null, byId: user.id }
    await db.staffDay.upsert({ where: { staffId_date: { staffId: r.staffId, date: d } }, create: { staffId: r.staffId, date: d, ...data }, update: data })
  }
  done(`${self}${self.includes('?') ? '&' : '?'}saved=${rows.length}`)
}

// Admin corrects any day of a customer: Delivered (with boxes), Absent (leave), Not delivered, or no entry.
export async function adminSetDay(form: FormData) {
  const user = await requireUser(['ADMIN'])
  const leadId = id(form, 'leadId')
  const d = date(form, 'date')
  const self = back(form, `/customers/${leadId}`)
  if (!d) fail(self, 'Pick the day')
  const st = s(form, 'status')
  if (st === 'CLEAR') {
    await db.attendance.deleteMany({ where: { leadId, date: d! } })
  } else {
    if (st !== 'DELIVERED' && st !== 'ABSENT' && st !== 'NOT_DELIVERED') fail(self, 'Choose what happened on that day')
    const boxes = st === 'DELIVERED' ? whole(s(form, 'boxes'), 3) : null
    const data = { status: st as 'DELIVERED' | 'ABSENT' | 'NOT_DELIVERED', boxes: boxes && boxes > 1 ? boxes : null, buttermilk: false, remarks: s(form, 'remarks'), byId: user.id }
    await db.attendance.upsert({ where: { leadId_date: { leadId, date: d! } }, create: { leadId, date: d!, ...data }, update: data })
  }
  await db.activity.create({ data: { leadId, kind: 'package', text: `${fmtWeekday(d!)}: ${st === 'CLEAR' ? 'entry removed' : st === 'DELIVERED' ? 'delivered' : st === 'ABSENT' ? 'leave' : 'not delivered'}`, detail: `Changed by admin${s(form, 'remarks') ? `: ${s(form, 'remarks')}` : ''}`, byId: user.id } })
  const { completeFinished } = await import('@/lib/workflow')
  await completeFinished([leadId])
  revalidatePath('/', 'layout')
  done(self)
}

export async function markNoticesSeen() {
  await requireUser(['ADMIN'])
  await db.adminNotice.updateMany({ where: { seenAt: null }, data: { seenAt: new Date() } })
  done('/admin/notices')
}

// Staff tracking
export async function saveStaff(form: FormData) {
  await requireUser(['ADMIN'])
  const self = back(form, '/admin/staff')
  const name = s(form, 'name')
  if (!name) fail(`${self}${self.includes('?') ? '&' : '?'}team=1`, 'Enter the name')
  const kind = s(form, 'kind') === 'DELIVERY' ? 'DELIVERY' : s(form, 'kind') === 'OFFICE' ? 'OFFICE' : 'KITCHEN'
  const data = { name: name!, kind, phone: s(form, 'phone'), shift2: kind === 'KITCHEN' && form.get('shift2') === 'on' }
  if (s(form, 'id')) await db.staff.update({ where: { id: id(form) }, data })
  else await db.staff.create({ data })
  done(self)
}

// A person who has left stays in old days' records but is no longer listed.
export async function setStaffActive(form: FormData) {
  await requireUser(['ADMIN'])
  await db.staff.update({ where: { id: id(form) }, data: { active: s(form, 'active') === 'yes' } })
  done(back(form, '/admin/staff'))
}

export async function saveStaffDay(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const d = date(form, 'date') ?? day(0)
  const self = back(form, '/kitchen/staff')
  if (!(await dayOpen(user, d))) fail(self, lockedText(d))
  const ids = form.getAll('staff').map(String)
  const people = await db.staff.findMany({ where: { id: { in: ids.filter((x) => z.string().uuid().safeParse(x).success) }, active: true, kind: { in: ['KITCHEN', 'DELIVERY'] } } })
  const THREE = ['YES', 'NO', 'NONE']
  const inside = (t: string, [from, to]: readonly [string, string]) => t >= from && t <= to
  // Everything is checked first; nothing is saved unless every person is complete.
  const rows: { staffId: string; data: Prisma.StaffDayUncheckedCreateInput }[] = []
  for (const p of people) {
    const g = (k: string) => s(form, `${k}_${p.id}`)
    const who = p.name
    const att = g('att')
    if (att !== 'PRESENT' && att !== 'ABSENT') fail(self, `Choose Present or Absent for ${who}`)
    const base = { staffId: p.id, date: d, byId: user.id, attendance: att as string, remarks: g('remarks') }
    if (att === 'ABSENT') { rows.push({ staffId: p.id, data: { ...base, idCard: null, uniform: null, onTimePickup: null, inTime: null, outTime: null, inTime2: null, outTime2: null, startKm: null, endKm: null } }); continue }
    const idCard = g('idCard'); const uniform = g('uniform')
    if (!idCard || !THREE.includes(idCard)) fail(self, `${who}: choose ID card Yes, No or Don't have`)
    if (!uniform || !THREE.includes(uniform)) fail(self, `${who}: choose ${p.kind === 'DELIVERY' ? 'dress code' : 'uniform'} Yes, No or Don't have`)
    if (p.kind === 'KITCHEN') {
      const t = { inTime: g('in'), outTime: g('out'), inTime2: p.shift2 ? g('in2') : null, outTime2: p.shift2 ? g('out2') : null }
      for (const [k, v] of Object.entries(t)) if (!v && (p.shift2 || !k.endsWith('2'))) fail(self, p.shift2 ? `${who}: fill all four shift times` : `${who}: fill the in and out time`)
      if (!inside(t.inTime!, SHIFT1) || !inside(t.outTime!, SHIFT1)) fail(self, `${who}: the first shift is between 3:00 AM and 7:00 AM`)
      if (t.outTime! < t.inTime!) fail(self, `${who}: the first shift out time is before the in time`)
      if (p.shift2 && (!inside(t.inTime2!, SHIFT2) || !inside(t.outTime2!, SHIFT2))) fail(self, `${who}: the second shift is between 11:00 AM and 2:00 PM`)
      if (p.shift2 && t.outTime2! < t.inTime2!) fail(self, `${who}: the second shift out time is before the in time`)
      rows.push({ staffId: p.id, data: { ...base, idCard, uniform, onTimePickup: null, ...t, startKm: null, endKm: null } })
    } else {
      const pickup = g('pickup')
      if (pickup !== 'yes' && pickup !== 'no') fail(self, `${who}: choose On-time pick-up Yes or No`)
      const inTime = g('in'); const outTime = g('out')
      if (!inTime) fail(self, `${who}: fill the in time`)
      if (!outTime) fail(self, `${who}: fill the time the deliveries were complete`)
      const startKm = whole(g('startKm'), 999_999); const endKm = whole(g('endKm'), 999_999)
      if (startKm == null || endKm == null) fail(self, `${who}: fill the starting and ending km`)
      if (endKm! < startKm!) fail(self, `${who}: the ending km is lower than the starting km`)
      rows.push({ staffId: p.id, data: { ...base, idCard, uniform, onTimePickup: pickup === 'yes', inTime, outTime, inTime2: null, outTime2: null, startKm, endKm } })
    }
  }
  if (rows.length === 0) fail(self, 'No staff to save')
  for (const r of rows) {
    const { staffId, date: _d, ...rest } = r.data as Prisma.StaffDayUncheckedCreateInput & { date: Date }
    await db.staffDay.upsert({ where: { staffId_date: { staffId, date: d } }, create: r.data, update: rest })
  }
  done(`${self}${self.includes('?') ? '&' : '?'}saved=${rows.length}`)
}

// Dues
export async function saveDue(form: FormData) {
  const user = await requireUser(['ADMIN'])
  const self = s(form, 'self') ?? '/admin/dues?add=1'
  const title = s(form, 'title')
  const amount = Number(s(form, 'amount'))
  const dueDate = date(form, 'dueDate')
  if (!title) fail(self, 'Enter what is due')
  if (!(amount > 0)) fail(self, 'Enter the amount')
  if (!dueDate) fail(self, 'Pick the due date')
  const kind = s(form, 'kind') ?? 'OTHER'
  const data = { kind: kind in DUE_KINDS ? kind : 'OTHER', title: title!, amount: Math.round(amount), dueDate: dueDate!, repeatMonthly: form.get('repeatMonthly') === 'on', note: s(form, 'note') }
  if (s(form, 'id')) await db.due.update({ where: { id: id(form) }, data })
  else await db.due.create({ data: { ...data, byId: user.id } })
  done(back(form, '/admin/dues'))
}

// Marks a due as paid. A monthly one makes next month's entry on the same day of the month.
export async function payDue(form: FormData) {
  const user = await requireUser(['ADMIN'])
  const due = await db.due.findUniqueOrThrow({ where: { id: id(form) } })
  if (s(form, 'paid') === 'no') {
    await db.due.update({ where: { id: due.id }, data: { paidAt: null } })
  } else if (!due.paidAt) {
    await db.due.update({ where: { id: due.id }, data: { paidAt: new Date() } })
    if (due.repeatMonthly) {
      const y = due.dueDate.getUTCFullYear()
      const m = due.dueDate.getUTCMonth() + 1
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      const next = new Date(Date.UTC(y, m, Math.min(due.dueDate.getUTCDate(), last)))
      const exists = await db.due.count({ where: { title: due.title, kind: due.kind, dueDate: next } })
      if (!exists) await db.due.create({ data: { kind: due.kind, title: due.title, amount: due.amount, dueDate: next, repeatMonthly: true, note: due.note, byId: user.id } })
    }
  }
  done(back(form, '/admin/dues'))
}

export async function deleteDue(form: FormData) {
  await requireUser(['ADMIN'])
  await db.due.delete({ where: { id: id(form) } })
  done(back(form, '/admin/dues'))
}

// Attendance sheet order: the kitchen manager numbers a region's customers in the order the boxes are delivered.
export async function saveSheetOrder(form: FormData) {
  await requireUser(['KITCHEN', 'SALES'])
  const rows = form.getAll('lead').map((leadId) => ({ leadId: z.string().uuid().parse(String(leadId)), pos: Number(s(form, `pos_${leadId}`)) }))
  // Sort by the typed number (ties keep the order shown), then store 1, 2, 3...
  const ordered = rows.map((r, i) => ({ ...r, i })).sort((a, b) => (Number.isFinite(a.pos) && a.pos > 0 ? a.pos : 9999) - (Number.isFinite(b.pos) && b.pos > 0 ? b.pos : 9999) || a.i - b.i)
  await db.$transaction(ordered.map((r, n) => db.lead.update({ where: { id: r.leadId }, data: { sheetOrder: n + 1 } })))
  const to = back(form, '/kitchen/sheet')
  done(`${to}${to.includes('?') ? '&' : '?'}ordered=${ordered.length}`)
}

// Customer form link: any login can make one.
export async function createInvite(form: FormData) {
  const user = await requireUser()
  let to = '/invite'
  try {
    const invite = await createLeadInvite(s(form, 'phone') ?? '', s(form, 'name'), s(form, 'source') ?? 'WHATSAPP', user.id)
    to = `/invite?new=${invite.id}`
  } catch (e) {
    if (!(e instanceof FlowError)) throw e
    to = `/invite?error=${encodeURIComponent(e.message)}`
  }
  done(to)
}

export async function deleteInvite(form: FormData) {
  const user = await requireUser()
  const invite = await db.leadInvite.findFirst({ where: { id: id(form), filledAt: null } })
  await db.leadInvite.deleteMany({ where: { id: id(form), filledAt: null } })
  if (invite) await notifyAdmin(user, 'Deleted a customer form link', [invite.name, invite.phone].filter(Boolean).join(' · '))
  done('/invite')
}

// Past-day permission: sales or the kitchen manager ask, the admin allows (for 24 hours) or refuses.
export async function askDayPermission(form: FormData) {
  const user = await requireUser()
  const d = date(form, 'date')
  const to = back(form, '/')
  if (!d || d >= day(0)) done(to)
  const note = s(form, 'note')
  if (!note) fail(to, 'Say why you need to change that day')
  const open = await db.dayRequest.findFirst({ where: { userId: user.id, date: d!, status: 'PENDING' } })
  if (!open) await db.dayRequest.create({ data: { userId: user.id, date: d!, area: s(form, 'area') ?? 'Other', note } })
  done(to)
}

export async function decideDayRequest(form: FormData) {
  const admin = await requireUser(['ADMIN'])
  const allow = s(form, 'decision') === 'allow'
  await db.dayRequest.update({
    where: { id: id(form) },
    data: { status: allow ? 'ALLOWED' : 'REFUSED', decidedAt: new Date(), decidedById: admin.id, expiresAt: allow ? new Date(Date.now() + 24 * 3_600_000) : null },
  })
  done('/admin/requests')
}
