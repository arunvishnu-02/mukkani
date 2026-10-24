import 'server-only'
import { db } from '@/lib/db'
import { day, keyOf } from '@/lib/dates'
import { ATTENDANCE, CUSTOMER_STATUS, DUE_KINDS, ISSUE_STATUS, LEAD_CALL, LEAD_STATUS, PACKAGE_STATUS, SOURCE, TRIAL_RESULT, TRIAL_STATUS, sourceLabel } from '@/lib/labels'
import type { Role } from '@/generated/prisma/enums'
import type { Tone } from '@/lib/labels'

// Every part of the app as a plain table that can be filtered, sorted and downloaded.
// One entry per report: who may open it, which filters it has, its columns and how its rows are loaded.

export type Cell = string | number | null
export type Column = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'money' }
export type Filters = { from: Date | null; to: Date | null; status: string | null; regionId: string | null }
export type Report = {
  title: string
  about: string
  group: 'Sales' | 'Kitchen' | 'Business'
  roles: Role[] // admin can always open every report
  date?: string // what the date filter means; no date filter when missing
  allTime?: boolean // show everything until a date is picked
  status?: [string, string][]
  region?: boolean
  columns: Column[]
  load: (f: Filters) => Promise<Record<string, Cell>[]>
  // The headline figure for this report's card on the All reports dashboard, for a period.
  kpi: (r: Range) => Promise<Kpi>
}
export type Range = { from: Date; to: Date } // `to` is the day after the last day
export type Kpi = { value: string | number; label: string; sub: string; tone: Tone }

const MAX = 3000
const d = (x: Date | null | undefined) => (x ? keyOf(x) : null)
const yes = (b: boolean | null | undefined) => (b == null ? null : b ? 'Yes' : 'No')
const three = (v: string | null | undefined) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : v === 'NONE' ? "Don't have" : null)
const label = <T extends string>(map: Record<T, [string, unknown]>, v: T | null | undefined) => (v ? (map[v]?.[0] ?? v) : null)
// A date column holds a calendar day; a timestamp is compared from the start of that day in India.
const days = (f: Filters) => (f.from || f.to ? { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } : undefined)
const stamp = (x: Date) => new Date(x.getTime() - 5.5 * 3_600_000)
const moments = (f: Filters) => (f.from || f.to ? { ...(f.from ? { gte: stamp(f.from) } : {}), ...(f.to ? { lt: stamp(f.to) } : {}) } : undefined)
const inRegion = (f: Filters) => (f.regionId ? { regionId: f.regionId } : {})
const within = (r: Range) => ({ gte: r.from, lt: r.to })
const atTimes = (r: Range) => ({ gte: stamp(r.from), lt: stamp(r.to) })
const rs = (n: number) => `Rs ${n.toLocaleString('en-IN')}`
const kg = (n: number) => `${Math.round(n * 10) / 10} kg`
const callLabel = (v: string) => LEAD_CALL.find((x) => x[0] === v)?.[1] ?? v

export const REPORTS: Record<string, Report> = {
  leads: {
    title: 'Leads',
    about: 'Every person added, with category, source and next call',
    group: 'Sales',
    roles: ['SALES'],
    date: 'Added on',
    allTime: true,
    status: Object.entries(LEAD_STATUS).map(([k, v]) => [k, v[0]]),
    region: true,
    columns: [
      { key: 'added', label: 'Added on', type: 'date' }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'category', label: 'Category' },
      { key: 'source', label: 'Source' }, { key: 'region', label: 'Region' }, { key: 'sales', label: 'Sales person' }, { key: 'next', label: 'Next call', type: 'date' },
      { key: 'reason', label: 'Not interested reason' }, { key: 'address', label: 'Address' },
    ],
    kpi: async (r) => {
      const [added, follow] = await Promise.all([db.lead.count({ where: { createdAt: atTimes(r) } }), db.lead.count({ where: { status: 'FOLLOW_UP' } })])
      return { value: added, label: 'new leads', sub: `${follow} in follow up now`, tone: 'sky' }
    },
    load: async (f) =>
      (await db.lead.findMany({ where: { createdAt: moments(f), ...(f.status ? { status: f.status as never } : {}), ...inRegion(f) }, include: { region: true, owner: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: MAX })).map((l) => ({
        added: d(new Date(l.createdAt.getTime() + 5.5 * 3_600_000)), name: l.name, phone: l.phone, category: label(LEAD_STATUS, l.status), source: sourceLabel(l), region: l.region?.name ?? null,
        sales: l.owner?.name ?? null, next: l.status === 'FOLLOW_UP' ? d(l.nextFollowUpAt) : null, reason: l.notInterestedReason, address: l.address,
      })),
  },
  calls: {
    title: 'Sales calls',
    about: 'Every call logged in the call register',
    group: 'Sales',
    roles: ['SALES'],
    date: 'Call date',
    region: true,
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'result', label: 'Result' }, { key: 'note', label: 'What the customer said' }, { key: 'by', label: 'Called by' }],
    kpi: async (r) => {
      const [calls, due] = await Promise.all([db.followUp.count({ where: { createdAt: atTimes(r) } }), db.lead.count({ where: { status: 'FOLLOW_UP', nextFollowUpAt: { lt: r.to } } })])
      return { value: calls, label: 'calls made', sub: `${due} follow-up calls due or overdue`, tone: 'warn' }
    },
    load: async (f) =>
      (await db.followUp.findMany({ where: { createdAt: moments(f), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true } }, by: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: MAX })).map((c) => ({
        date: d(new Date(c.createdAt.getTime() + 5.5 * 3_600_000)), name: c.lead.name, phone: c.lead.phone, region: c.lead.region?.name ?? null, result: callLabel(c.outcome), note: c.note, by: c.by?.name ?? null,
      })),
  },
  trials: {
    title: 'Trial boxes',
    about: 'Trials with delivery date, payment and result',
    group: 'Sales',
    roles: ['SALES', 'KITCHEN'],
    date: 'Delivery date',
    status: Object.entries(TRIAL_STATUS).map(([k, v]) => [k, v[0]]),
    region: true,
    columns: [
      { key: 'date', label: 'Delivery date', type: 'date' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'slot', label: 'Slot' },
      { key: 'status', label: 'Status' }, { key: 'result', label: 'Result' }, { key: 'price', label: 'Price', type: 'money' }, { key: 'paid', label: 'Paid' }, { key: 'feedback', label: 'Feedback' }, { key: 'sales', label: 'Sales person' },
    ],
    kpi: async (r) => {
      const [n, won, waiting] = await Promise.all([db.trialBox.count({ where: { deliveryDate: within(r) } }), db.trialBox.count({ where: { deliveryDate: within(r), result: 'MONTHLY' } }), db.trialBox.count({ where: { status: { not: 'DONE' } } })])
      return { value: n, label: 'trial boxes', sub: `${won} became monthly · ${waiting} waiting for a result`, tone: 'brand' }
    },
    load: async (f) =>
      (await db.trialBox.findMany({ where: { deliveryDate: days(f), ...(f.status ? { status: f.status as never } : {}), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true, owner: { select: { name: true } } } } }, orderBy: { deliveryDate: 'desc' }, take: MAX })).map((t) => ({
        date: d(t.deliveryDate), name: t.lead.name, phone: t.lead.phone, region: t.lead.region?.name ?? null, slot: t.slot, status: label(TRIAL_STATUS, t.status), result: t.result ? (TRIAL_RESULT[t.result]?.[0] ?? t.result) : null,
        price: t.price, paid: yes(t.paid), feedback: t.feedback, sales: t.lead.owner?.name ?? null,
      })),
  },
  packs: {
    title: 'Monthly packs',
    about: 'Every monthly pack with start date, payment and add-on drinks',
    group: 'Sales',
    roles: ['SALES', 'KITCHEN'],
    date: 'Start date',
    allTime: true,
    status: Object.entries(PACKAGE_STATUS).map(([k, v]) => [k, v[0]]),
    region: true,
    columns: [
      { key: 'start', label: 'Start date', type: 'date' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'month', label: 'Month no.', type: 'number' },
      { key: 'status', label: 'Pack status' }, { key: 'customer', label: 'Customer status' }, { key: 'price', label: 'Price', type: 'money' }, { key: 'drinks', label: 'Add-on drinks', type: 'number' },
      { key: 'paid', label: 'Paid' }, { key: 'paidOn', label: 'Paid on', type: 'date' }, { key: 'time', label: 'Delivery time' },
    ],
    kpi: async (r) => {
      const [running, started, unpaid] = await Promise.all([db.package.count({ where: { status: 'ACTIVE' } }), db.package.count({ where: { createdAt: atTimes(r) } }), db.package.count({ where: { status: 'ACTIVE', paid: false } })])
      return { value: running, label: 'packs running now', sub: `${started} started in this period · ${unpaid} not paid`, tone: 'leaf' }
    },
    load: async (f) =>
      (await db.package.findMany({ where: { startDate: days(f), ...(f.status ? { status: f.status as never } : {}), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true } } }, orderBy: { startDate: 'desc' }, take: MAX })).map((p) => ({
        start: d(p.startDate), name: p.lead.name, phone: p.lead.phone, region: p.lead.region?.name ?? null, month: p.number, status: label(PACKAGE_STATUS, p.status), customer: label(CUSTOMER_STATUS, p.lead.customerStatus),
        price: p.price, drinks: p.buttermilkQty, paid: yes(p.paid), paidOn: d(p.paidAt), time: p.lead.deliveryTime ?? p.lead.slot,
      })),
  },
  attendance: {
    title: 'Delivery attendance',
    about: 'Delivered, absent and not delivered, day by day',
    group: 'Sales',
    roles: ['SALES', 'KITCHEN'],
    date: 'Date',
    status: Object.entries(ATTENDANCE).map(([k, v]) => [k, v[0]]),
    region: true,
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'status', label: 'Attendance' }, { key: 'drink', label: 'Add-on drink' }, { key: 'box', label: 'Box returned' }, { key: 'remarks', label: 'Remarks' }],
    kpi: async (r) => {
      const g = await db.attendance.groupBy({ by: ['status'], where: { date: within(r) }, _count: true })
      const n = (k: string) => g.find((x) => x.status === k)?._count ?? 0
      return { value: n('DELIVERED'), label: 'boxes delivered', sub: `${n('ABSENT')} absent · ${n('NOT_DELIVERED')} not delivered`, tone: 'leaf' }
    },
    load: async (f) =>
      (await db.attendance.findMany({ where: { date: days(f), ...(f.status ? { status: f.status as never } : {}), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true } } }, orderBy: [{ date: 'desc' }], take: MAX })).map((a) => ({
        date: d(a.date), name: a.lead.name, phone: a.lead.phone, region: a.lead.region?.name ?? null, status: label(ATTENDANCE, a.status), drink: yes(a.buttermilk), box: yes(a.boxBack), remarks: a.remarks,
      })),
  },
  issues: {
    title: 'Daily issues',
    about: 'Problems noted each day and where they stand',
    group: 'Sales',
    roles: ['SALES'],
    date: 'Date',
    status: Object.entries(ISSUE_STATUS).map(([k, v]) => [k, v[0]]),
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'department', label: 'Department' }, { key: 'issue', label: 'Issue' }, { key: 'responsible', label: 'Responsible person' }, { key: 'status', label: 'Status' }, { key: 'followUp', label: 'Follow-up' }, { key: 'remarks', label: 'Remarks' }],
    kpi: async (r) => {
      const [open, added] = await Promise.all([db.issue.count({ where: { status: { not: 'DONE' } } }), db.issue.count({ where: { date: within(r) } })])
      return { value: open, label: 'open issues', sub: `${added} noted in this period`, tone: open ? 'red' : 'leaf' }
    },
    load: async (f) =>
      (await db.issue.findMany({ where: { date: days(f), ...(f.status ? { status: f.status } : {}) }, orderBy: { date: 'desc' }, take: MAX })).map((i) => ({
        date: d(i.date), department: i.department, issue: i.issue, responsible: i.responsible, status: ISSUE_STATUS[i.status]?.[0] ?? i.status, followUp: i.followUp, remarks: i.remarks,
      })),
  },
  menu: {
    title: 'Daily menu',
    about: 'The fruits, salad and customization fruits of each day',
    group: 'Kitchen',
    roles: ['SALES', 'KITCHEN'],
    date: 'Date',
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'fruits', label: 'Fruits' }, { key: 'salad', label: 'Salad' }, { key: 'swap', label: 'Customization fruits' }, { key: 'note', label: 'Note for kitchen' }],
    kpi: async (r) => {
      const [n, next] = await Promise.all([db.menu.count({ where: { date: within(r) } }), db.menu.findFirst({ where: { date: { gte: r.to } }, orderBy: { date: 'asc' } })])
      return { value: n, label: 'days with a menu', sub: next ? `Next menu added: ${next.fruits}` : 'Next menu not added yet', tone: next ? 'brand' : 'warn' }
    },
    load: async (f) => (await db.menu.findMany({ where: { date: days(f) }, orderBy: { date: 'desc' }, take: MAX })).map((m) => ({ date: d(m.date), fruits: m.fruits, salad: m.salad, swap: m.swapFruits || null, note: m.note })),
  },
  'customer-calls': {
    title: 'Customer calls',
    about: 'Day 1, 5, 15 and 26 calls to monthly customers, with renewals',
    group: 'Kitchen',
    roles: ['KITCHEN', 'SALES'],
    date: 'Call date',
    region: true,
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'month', label: 'Month no.', type: 'number' }, { key: 'day', label: 'Call day', type: 'number' }, { key: 'outcome', label: 'How it went' }, { key: 'renewal', label: 'Renewal' }, { key: 'reason', label: 'Reason' }, { key: 'note', label: 'Note' }],
    kpi: async (r) => {
      const [n, yes] = await Promise.all([db.customerCall.count({ where: { createdAt: atTimes(r) } }), db.customerCall.count({ where: { createdAt: atTimes(r), renewal: 'YES' } })])
      return { value: n, label: 'customer calls', sub: `${yes} said yes to renewal`, tone: 'sky' }
    },
    load: async (f) =>
      (await db.customerCall.findMany({ where: { createdAt: moments(f), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true } }, package: { select: { number: true } } }, orderBy: { createdAt: 'desc' }, take: MAX })).map((c) => ({
        date: d(new Date(c.createdAt.getTime() + 5.5 * 3_600_000)), name: c.lead.name, phone: c.lead.phone, region: c.lead.region?.name ?? null, month: c.package.number, day: c.dayNo,
        outcome: c.outcome.charAt(0) + c.outcome.slice(1).toLowerCase().replace(/_/g, ' '), renewal: c.renewal ? c.renewal.charAt(0) + c.renewal.slice(1).toLowerCase().replace(/_/g, ' ') : null, reason: c.reason, note: c.note,
      })),
  },
  'alt-boxes': {
    title: 'Alternative boxes',
    about: 'Alternative boxes given and collected',
    group: 'Kitchen',
    roles: ['KITCHEN', 'SALES'],
    date: 'Given on',
    status: [['OUT', 'Not collected'], ['BACK', 'Collected']],
    region: true,
    columns: [{ key: 'given', label: 'Given on', type: 'date' }, { key: 'box', label: 'Box no.', type: 'number' }, { key: 'name', label: 'Who has it' }, { key: 'phone', label: 'Phone' }, { key: 'region', label: 'Region' }, { key: 'state', label: 'Status' }, { key: 'back', label: 'Collected on', type: 'date' }],
    kpi: async (r) => {
      const [out, given] = await Promise.all([db.altBox.count({ where: { collectedOn: null } }), db.altBox.count({ where: { givenOn: within(r) } })])
      return { value: out, label: 'boxes not collected', sub: `${given} given in this period`, tone: out ? 'warn' : 'leaf' }
    },
    load: async (f) =>
      (await db.altBox.findMany({ where: { givenOn: days(f), ...(f.status === 'OUT' ? { collectedOn: null } : f.status === 'BACK' ? { collectedOn: { not: null } } : {}), ...(f.regionId ? { lead: { regionId: f.regionId } } : {}) }, include: { lead: { include: { region: true } } }, orderBy: { givenOn: 'desc' }, take: MAX })).map((a) => ({
        given: d(a.givenOn), box: a.boxNo, name: a.lead?.name ?? `${a.holder ?? 'Someone'} (not a customer)`, phone: a.lead?.phone ?? null, region: a.lead?.region?.name ?? null, state: a.collectedOn ? 'Collected' : 'Not collected', back: d(a.collectedOn),
      })),
  },
  stock: {
    title: 'Stock',
    about: 'Fruit that came in and fruit used, in kg',
    group: 'Kitchen',
    roles: ['KITCHEN'],
    date: 'Date',
    status: [['IN', 'Came in'], ['USED', 'Used']],
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'fruit', label: 'Fruit' }, { key: 'kind', label: 'Entry' }, { key: 'kg', label: 'Kg', type: 'number' }, { key: 'note', label: 'Note' }],
    kpi: async (r) => {
      const g = await db.stockEntry.groupBy({ by: ['kind'], where: { date: within(r) }, _sum: { qtyKg: true } })
      const n = (k: string) => g.find((x) => x.kind === k)?._sum.qtyKg ?? 0
      return { value: kg(n('IN')), label: 'fruit came in', sub: `${kg(n('USED'))} used`, tone: 'brand' }
    },
    load: async (f) => (await db.stockEntry.findMany({ where: { date: days(f), ...(f.status ? { kind: f.status } : {}) }, orderBy: [{ date: 'desc' }, { fruit: 'asc' }], take: MAX })).map((s) => ({ date: d(s.date), fruit: s.fruit, kind: s.kind === 'IN' ? 'Came in' : s.kind === 'USED' ? 'Used' : s.kind, kg: s.qtyKg, note: s.note })),
  },
  wastage: {
    title: 'Wastage',
    about: 'Fruit cut and fruit wasted, with the reason',
    group: 'Kitchen',
    roles: ['KITCHEN'],
    date: 'Date',
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'fruit', label: 'Fruit' }, { key: 'cut', label: 'Cut (kg)', type: 'number' }, { key: 'waste', label: 'Waste (kg)', type: 'number' }, { key: 'share', label: 'Waste %', type: 'number' }, { key: 'reason', label: 'Reason' }],
    kpi: async (r) => {
      const a = await db.wastage.aggregate({ where: { date: within(r) }, _sum: { wasteKg: true, cutKg: true } })
      const waste = a._sum.wasteKg ?? 0
      const cut = a._sum.cutKg ?? 0
      return { value: kg(waste), label: 'fruit wasted', sub: cut ? `${Math.round((waste / cut) * 100)}% of ${kg(cut)} cut` : 'no fruit cut entered', tone: 'red' }
    },
    load: async (f) => (await db.wastage.findMany({ where: { date: days(f) }, orderBy: [{ date: 'desc' }, { fruit: 'asc' }], take: MAX })).map((w) => ({ date: d(w.date), fruit: w.fruit, cut: w.cutKg, waste: w.wasteKg, share: w.cutKg ? Math.round((w.wasteKg / w.cutKg) * 100) : null, reason: w.reason })),
  },
  staff: {
    title: 'Staff tracking',
    about: 'ID card, uniform, in and out time and delivery km, day by day',
    group: 'Kitchen',
    roles: ['KITCHEN'],
    date: 'Date',
    status: [['KITCHEN', 'Kitchen staff'], ['DELIVERY', 'Delivery persons']],
    columns: [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'name', label: 'Name' }, { key: 'work', label: 'Work' }, { key: 'present', label: 'Present' }, { key: 'idCard', label: 'ID card' }, { key: 'uniform', label: 'Uniform / dress code' }, { key: 'pickup', label: 'On-time pick-up' },
      { key: 'in', label: 'In time (shift 1)' }, { key: 'out', label: 'Out time (shift 1) / deliveries complete' }, { key: 'in2', label: 'In time (shift 2)' }, { key: 'out2', label: 'Out time (shift 2)' }, { key: 'startKm', label: 'Starting km', type: 'number' }, { key: 'endKm', label: 'Ending km', type: 'number' }, { key: 'km', label: 'Total km', type: 'number' }, { key: 'remarks', label: 'Remarks' },
    ],
    kpi: async (r) => {
      const rows = await db.staffDay.findMany({ where: { date: within(r), staff: { kind: { in: ['KITCHEN', 'DELIVERY'] } } }, select: { startKm: true, endKm: true, idCard: true, uniform: true, onTimePickup: true, attendance: true } })
      const km = rows.reduce((a, x) => a + (x.startKm != null && x.endKm != null ? x.endKm - x.startKm : 0), 0)
      const no = rows.filter((x) => x.idCard === 'NO' || x.uniform === 'NO' || x.onTimePickup === false).length
      return { value: `${km} km`, label: 'delivery distance', sub: `${rows.length} staff days recorded · ${no} with a No`, tone: 'sky' }
    },
    load: async (f) =>
      (await db.staffDay.findMany({ where: { date: days(f), staff: f.status ? { kind: f.status } : { kind: { in: ['KITCHEN', 'DELIVERY'] } } }, include: { staff: true }, orderBy: [{ date: 'desc' }], take: MAX })).map((s) => ({
        date: d(s.date), name: s.staff.name, work: s.staff.kind === 'DELIVERY' ? 'Delivery' : 'Kitchen', present: s.attendance === 'ABSENT' ? 'Absent' : 'Present', idCard: three(s.idCard), uniform: three(s.uniform), pickup: yes(s.onTimePickup), in: s.inTime, out: s.outTime, in2: s.inTime2, out2: s.outTime2,
        startKm: s.startKm, endKm: s.endKm, km: s.startKm != null && s.endKm != null ? s.endKm - s.startKm : null, remarks: s.remarks,
      })),
  },
  money: {
    title: 'Purchase + expenses',
    about: 'Everything bought or paid for',
    group: 'Business',
    roles: ['ADMIN'],
    date: 'Date',
    status: [['PURCHASE', 'Purchase'], ['EXPENSE', 'Expense']],
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'type', label: 'Type' }, { key: 'item', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'qty', label: 'Quantity' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'paidTo', label: 'Paid to' }, { key: 'bills', label: 'Bill photos', type: 'number' }],
    kpi: async (r) => {
      const a = await db.moneyEntry.aggregate({ where: { date: within(r) }, _sum: { amount: true }, _count: true })
      return { value: rs(a._sum.amount ?? 0), label: 'spent', sub: `${a._count} purchase and expense entries`, tone: 'red' }
    },
    load: async (f) =>
      (await db.moneyEntry.findMany({ where: { date: days(f), ...(f.status ? { type: f.status as never } : {}) }, orderBy: { date: 'desc' }, take: MAX })).map((m) => ({ date: d(m.date), type: m.type === 'PURCHASE' ? 'Purchase' : 'Expense', item: m.item, category: m.category, qty: m.quantity, amount: m.amount, paidTo: m.paidTo, bills: m.billIds.length })),
  },
  dues: {
    title: 'Dues',
    about: 'Rent, salary and bank dues, paid and to pay',
    group: 'Business',
    roles: ['ADMIN'],
    date: 'Due date',
    allTime: true,
    status: [['UNPAID', 'To pay'], ['PAID', 'Paid']],
    columns: [{ key: 'due', label: 'Due date', type: 'date' }, { key: 'kind', label: 'Type' }, { key: 'title', label: 'For' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'state', label: 'Status' }, { key: 'paidOn', label: 'Paid on', type: 'date' }, { key: 'monthly', label: 'Every month' }, { key: 'note', label: 'Note' }],
    kpi: async () => {
      const unpaid = await db.due.findMany({ where: { paidAt: null }, select: { amount: true, dueDate: true } })
      const late = unpaid.filter((x) => x.dueDate < day(0)).length
      return { value: rs(unpaid.reduce((a, x) => a + x.amount, 0)), label: 'still to pay', sub: `${unpaid.length} dues · ${late} overdue`, tone: late ? 'red' : 'warn' }
    },
    load: async (f) =>
      (await db.due.findMany({ where: { dueDate: days(f), ...(f.status === 'PAID' ? { paidAt: { not: null } } : f.status === 'UNPAID' ? { paidAt: null } : {}) }, orderBy: { dueDate: 'desc' }, take: MAX })).map((x) => ({
        due: d(x.dueDate), kind: DUE_KINDS[x.kind] ?? x.kind, title: x.title, amount: x.amount, state: x.paidAt ? 'Paid' : 'To pay', paidOn: d(x.paidAt), monthly: yes(x.repeatMonthly), note: x.note,
      })),
  },
}

export const reportsFor = (role: Role) => Object.entries(REPORTS).filter(([, r]) => role === 'ADMIN' || r.roles.includes(role))
