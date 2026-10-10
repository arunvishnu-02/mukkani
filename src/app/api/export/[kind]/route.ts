import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, keyOf, parseDay } from '@/lib/dates'
import { ATTENDANCE, LEAD_STATUS, PACKAGE_STATUS, SOURCE, TRIAL_RESULT, TRIAL_STATUS } from '@/lib/labels'
import { period } from '@/lib/report'

// CSV downloads for admin (open in Excel). ?period=day|week|month or ?from=YYYY-MM-DD&to=YYYY-MM-DD (to is inclusive).
type Row = (string | number | boolean | null | undefined)[]

const cell = (v: Row[number]) => {
  const s = v == null ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
  // Quote everything; a leading = + - @ would run as a formula in Excel.
  return `"${(/^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}
const d = (x: Date | null | undefined) => (x ? keyOf(x) : '')

export async function GET(req: Request, ctx: RouteContext<'/api/export/[kind]'>) {
  const user = await currentUser()
  if (!user) return new Response('Not logged in', { status: 401 })
  if (user.role !== 'ADMIN') return new Response('Not allowed', { status: 403 })
  const { kind } = await ctx.params
  const url = new URL(req.url)
  const p = period(url.searchParams.get('period') ?? 'month')
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseDay(s) : null)
  const from = valid(url.searchParams.get('from')) ?? p.from
  const toIncl = valid(url.searchParams.get('to'))
  const to = toIncl ? new Date(toIncl.getTime() + 86_400_000) : p.to
  const range = { gte: from, lt: to }
  let head: string[] = []
  let rows: Row[] = []

  if (kind === 'leads') {
    const leads = await db.lead.findMany({ include: { region: true, owner: true }, orderBy: { createdAt: 'desc' } })
    head = ['Name', 'Phone', 'Category', 'Not interested reason', 'Source', 'Region', 'Address', 'Slot', 'Delivery time', 'Foods to avoid', 'Health issues', 'Date of birth', 'Sales', 'Next call', 'Added on']
    rows = leads.map((l) => [l.name, l.phone, LEAD_STATUS[l.status][0], l.notInterestedReason, SOURCE[l.source], l.region?.name, l.address, l.slot, l.deliveryTime, l.avoidFoods, l.healthNotes, d(l.dob), l.owner?.name, d(l.nextFollowUpAt), d(l.createdAt)])
  } else if (kind === 'packages') {
    const pkgs = await db.package.findMany({ where: { startDate: { lt: to } }, include: { lead: { include: { region: true } } }, orderBy: { startDate: 'desc' } })
    head = ['Customer', 'Phone', 'Region', 'Month no.', 'Start date', 'Status', 'Price', 'Buttermilk bottles', 'Buttermilk price', 'Paid', 'Paid on']
    rows = pkgs.map((p) => [p.lead.name, p.lead.phone, p.lead.region?.name, p.number, d(p.startDate), PACKAGE_STATUS[p.status][0], p.price, p.buttermilkQty, p.buttermilkQty * p.buttermilkPrice, p.paid, d(p.paidAt)])
  } else if (kind === 'trials') {
    const trials = await db.trialBox.findMany({ where: { deliveryDate: range }, include: { lead: { include: { region: true, owner: true } } }, orderBy: { deliveryDate: 'desc' } })
    head = ['Customer', 'Phone', 'Region', 'Delivery date', 'Slot', 'Price', 'Paid', 'Status', 'Result', 'Feedback', 'Sales']
    rows = trials.map((t) => [t.lead.name, t.lead.phone, t.lead.region?.name, d(t.deliveryDate), t.slot, t.price, t.paid, TRIAL_STATUS[t.status][0], t.result ? TRIAL_RESULT[t.result][0] : '', t.feedback, t.lead.owner?.name])
  } else if (kind === 'attendance') {
    const att = await db.attendance.findMany({ where: { date: range }, include: { lead: { include: { region: true } } }, orderBy: [{ date: 'asc' }] })
    head = ['Date', 'Customer', 'Phone', 'Region', 'Status', 'Buttermilk', 'Box returned', 'Remarks']
    rows = att.map((a) => [d(a.date), a.lead.name, a.lead.phone, a.lead.region?.name, ATTENDANCE[a.status][0], a.buttermilk, a.boxBack, a.remarks])
  } else if (kind === 'money') {
    const money = await db.moneyEntry.findMany({ where: { date: range }, orderBy: { date: 'asc' } })
    head = ['Date', 'Type', 'Item', 'Category', 'Quantity', 'Amount', 'Paid to', 'Bill photo']
    rows = money.map((m) => [d(m.date), m.type === 'PURCHASE' ? 'Purchase' : 'Expense', m.item, m.category, m.quantity, m.amount, m.paidTo, m.billId ? 'Yes' : 'No'])
  } else if (kind === 'wastage') {
    const w = await db.wastage.findMany({ where: { date: range }, orderBy: [{ date: 'asc' }, { fruit: 'asc' }] })
    head = ['Date', 'Fruit', 'Cut (kg)', 'Waste (kg)', 'Reason']
    rows = w.map((x) => [d(x.date), x.fruit, x.cutKg, x.wasteKg, x.reason])
  } else {
    return new Response('Unknown download', { status: 404 })
  }

  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const name = kind === 'leads' ? `mukkani-leads-${keyOf(day(0))}` : `mukkani-${kind}-${keyOf(from)}-to-${keyOf(new Date(to.getTime() - 86_400_000))}`
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'Cache-Control': 'no-store' },
  })
}
