import 'server-only'
import { db } from '@/lib/db'
import { day, isSunday } from '@/lib/dates'
import { matchSwaps, splitList, type Swap } from '@/lib/menu'
import { isButtermilkDay, planPackage, type PackagePlan } from '@/lib/plan'
import type { Prisma } from '@/generated/prisma/client'

export const leadInclude = {
  region: true,
  owner: { select: { name: true } },
  trialBoxes: { orderBy: { createdAt: 'desc' }, take: 1 },
  packages: { orderBy: { number: 'desc' }, take: 1 },
} satisfies Prisma.LeadInclude

export type LeadRow = Prisma.LeadGetPayload<{ include: typeof leadInclude }>

// A customer is anyone who has had a trial box or a package.
export const customerWhere: Prisma.LeadWhereInput = { OR: [{ trialBoxes: { some: {} } }, { packages: { some: {} } }] }

export async function regionsList() {
  return db.region.findMany({ orderBy: { name: 'asc' } })
}

const pkgInclude = { lead: { include: { region: true } } } satisfies Prisma.PackageInclude
export type PkgWithLead = Prisma.PackageGetPayload<{ include: typeof pkgInclude }>
export type Running = { pkg: PkgWithLead; plan: PackagePlan }

// The plan of every running package (one per customer: the oldest active one).
export async function runningPackages(today = day(0), where: Prisma.PackageWhereInput = {}): Promise<Running[]> {
  const pkgs = await db.package.findMany({
    where: { status: 'ACTIVE', ...where },
    include: pkgInclude,
    orderBy: [{ lead: { deliveryTime: 'asc' } }, { lead: { name: 'asc' } }],
  })
  const seen = new Set<string>()
  const first = [...pkgs].sort((a, b) => a.number - b.number).filter((p) => (seen.has(p.leadId) ? false : (seen.add(p.leadId), true)))
  const keep = new Set(first.map((p) => p.id))
  const list = pkgs.filter((p) => keep.has(p.id))
  if (list.length === 0) return []
  const minStart = list.reduce((m, p) => (p.startDate < m ? p.startDate : m), list[0].startDate)
  const att = await db.attendance.findMany({
    where: { leadId: { in: list.map((p) => p.leadId) }, date: { gte: minStart } },
    select: { leadId: true, date: true, status: true },
  })
  const byLead = new Map<string, typeof att>()
  for (const a of att) byLead.set(a.leadId, [...(byLead.get(a.leadId) ?? []), a])
  return list.map((pkg) => ({ pkg, plan: planFor(pkg, byLead.get(pkg.leadId) ?? [], today) }))
}

export function planFor(
  pkg: { startDate: Date; status: string; lead: { customerStatus: string; pausedUntil: Date | null } },
  attendance: { date: Date; status: 'DELIVERED' | 'ABSENT' | 'NOT_DELIVERED' }[],
  today = day(0),
) {
  return planPackage({
    start: pkg.startDate,
    attendance: attendance.filter((a) => a.date >= pkg.startDate),
    pause: pkg.lead.customerStatus === 'PAUSED' ? { from: today, until: pkg.lead.pausedUntil } : null,
    stopped: pkg.lead.customerStatus === 'INACTIVE' || pkg.status === 'CANCELLED',
    today,
  })
}

export async function packagePlan(packageId: string, today = day(0)) {
  const pkg = await db.package.findUniqueOrThrow({ where: { id: packageId }, include: pkgInclude })
  const att = await db.attendance.findMany({ where: { leadId: pkg.leadId, date: { gte: pkg.startDate } }, select: { date: true, status: true } })
  return { pkg, plan: planFor(pkg, att, today) }
}

export type SheetRow = {
  pkg: PkgWithLead
  lead: PkgWithLead['lead']
  dayNo: number | null
  absent: boolean
  bm: number
  altBox: number | null
  swap: Swap | null
  isNew: boolean
  attendance: { status: string; boxBack: boolean | null; remarks: string | null; buttermilk: boolean } | null
}

// Everyone on the attendance sheet for a date: monthly customers due that day plus trial boxes.
export async function daySheet(date: Date) {
  const today = day(0)
  const running = await runningPackages(today, { startDate: { lte: date } })
  const [menu, attendance, altBoxes, trials, paused] = await Promise.all([
    db.menu.findUnique({ where: { date } }),
    db.attendance.findMany({ where: { date } }),
    db.altBox.findMany({ where: { givenOn: date } }),
    db.trialBox.findMany({ where: { deliveryDate: date }, include: { lead: { include: { region: true } } }, orderBy: { lead: { deliveryTime: 'asc' } } }),
    db.lead.findMany({ where: { customerStatus: 'PAUSED', packages: { some: { status: 'ACTIVE' } } }, include: { region: true }, orderBy: { name: 'asc' } }),
  ])
  const att = new Map(attendance.map((a) => [a.leadId, a]))
  const alt = new Map(altBoxes.map((a) => [a.leadId, a.boxNo]))
  const due = isSunday(date)
    ? []
    : running.filter(({ plan }) => {
        const d = plan.dayOn(date)
        return d && (d.kind === 'planned' || d.kind === 'delivered' || d.kind === 'leave' || d.kind === 'notDelivered')
      })
  const menuFruits = splitList(menu?.fruits)
  const swaps = menu ? matchSwaps([...due.map((r) => r.pkg.lead), ...trials.map((t) => t.lead)], menuFruits, splitList(menu.swapFruits)) : new Map<string, Swap>()
  const rows: SheetRow[] = due.map(({ pkg, plan }) => {
    const d = plan.dayOn(date)!
    const a = att.get(pkg.leadId)
    return {
      pkg,
      lead: pkg.lead,
      dayNo: d.dayNo,
      absent: d.kind === 'leave',
      bm: isButtermilkDay(date) ? pkg.buttermilkQty : 0,
      altBox: alt.get(pkg.leadId) ?? null,
      swap: swaps.get(pkg.leadId) ?? null,
      isNew: pkg.number === 1 && d.dayNo === 1,
      attendance: a ? { status: a.status, boxBack: a.boxBack, remarks: a.remarks, buttermilk: a.buttermilk } : null,
    }
  })
  const boxes = rows.filter((r) => !r.absent).length + trials.length
  return {
    menu,
    rows,
    trials: trials.map((t) => ({ trial: t, swap: swaps.get(t.leadId) ?? null, attendance: att.get(t.leadId) ?? null })),
    paused,
    boxes,
    monthly: rows.filter((r) => !r.absent).length,
    swapCount: [...swaps.values()].filter((s) => s.swapTo).length,
    buttermilk: rows.reduce((a, r) => a + (r.absent ? 0 : r.bm), 0),
    altBoxes: altBoxes.length,
    entered: rows.filter((r) => r.attendance).length + trials.filter((t) => att.has(t.leadId)).length,
  }
}

// Swap fruit totals for the kitchen: { Apple: 3, Guava: 2 }
export function swapTotals(swaps: (Swap | null)[]) {
  const out = new Map<string, number>()
  for (const s of swaps) if (s?.swapTo) out.set(s.swapTo, (out.get(s.swapTo) ?? 0) + 1)
  return [...out.entries()].sort((a, b) => b[1] - a[1])
}

export function groupByRegion<T>(rows: T[], region: (r: T) => string | null | undefined) {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = region(r) ?? 'No region'
    m.set(k, [...(m.get(k) ?? []), r])
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

// Birthdays today, by day and month of the date of birth.
export async function birthdaysToday() {
  const t = day(0)
  const leads = await db.lead.findMany({ where: { dob: { not: null }, status: { not: 'NOT_INTERESTED' } } })
  return leads.filter((l) => l.dob!.getUTCDate() === t.getUTCDate() && l.dob!.getUTCMonth() === t.getUTCMonth())
}

