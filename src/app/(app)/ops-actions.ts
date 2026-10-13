'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { day, isDay, parseDay } from '@/lib/dates'
import { DUE_KINDS, ISSUE_DEPARTMENTS, ISSUE_STATUS } from '@/lib/labels'
import { FlowError, createLeadInvite } from '@/lib/workflow'
import { dayOpen, lockedText } from '@/lib/lock'

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
  await requireUser(['SALES'])
  await db.issue.delete({ where: { id: id(form) } })
  done(back(form, '/issues'))
}

// Staff tracking
export async function saveStaff(form: FormData) {
  await requireUser(['KITCHEN'])
  const self = back(form, '/kitchen/staff')
  const name = s(form, 'name')
  if (!name) fail(`${self}${self.includes('?') ? '&' : '?'}team=1`, 'Enter the name')
  const data = { name: name!, kind: s(form, 'kind') === 'DELIVERY' ? 'DELIVERY' : 'KITCHEN', phone: s(form, 'phone') }
  if (s(form, 'id')) await db.staff.update({ where: { id: id(form) }, data })
  else await db.staff.create({ data })
  done(self)
}

// A person who has left stays in old days' records but is no longer listed.
export async function setStaffActive(form: FormData) {
  await requireUser(['KITCHEN'])
  await db.staff.update({ where: { id: id(form) }, data: { active: s(form, 'active') === 'yes' } })
  done(back(form, '/kitchen/staff'))
}

export async function saveStaffDay(form: FormData) {
  const user = await requireUser(['KITCHEN'])
  const d = date(form, 'date') ?? day(0)
  const self = back(form, '/kitchen/staff')
  if (!(await dayOpen(user, d))) fail(self, lockedText(d))
  let saved = 0
  for (const staffId of form.getAll('staff').map(String)) {
    const g = (k: string) => s(form, `${k}_${staffId}`)
    const startKm = whole(g('startKm'), 999_999)
    const endKm = whole(g('endKm'), 999_999)
    if (startKm != null && endKm != null && endKm < startKm) fail(self, 'An ending km is lower than the starting km. Check the two numbers.')
    const data = { idCard: yesNo(g('idCard')), uniform: yesNo(g('uniform')), onTimePickup: yesNo(g('pickup')), inTime: g('in'), outTime: g('out'), startKm, endKm, remarks: g('remarks'), byId: user.id }
    const touched = Object.entries(data).some(([k, v]) => k !== 'byId' && v != null)
    const where = { staffId_date: { staffId: z.string().uuid().parse(staffId), date: d } }
    if (touched) { await db.staffDay.upsert({ where, create: { staffId, date: d, ...data }, update: data }); saved++ }
    else await db.staffDay.deleteMany({ where: { staffId, date: d } })
  }
  done(`${self}${self.includes('?') ? '&' : '?'}saved=${saved}`)
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
  await requireUser(['KITCHEN'])
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
  await requireUser()
  await db.leadInvite.deleteMany({ where: { id: id(form), filledAt: null } })
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
