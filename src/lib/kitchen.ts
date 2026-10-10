import 'server-only'
import { db } from '@/lib/db'
import { day } from '@/lib/dates'
import { callDays, type PackagePlan } from '@/lib/plan'
import { runningPackages, type Running } from '@/lib/queries'

export type DueCall = Running & { dayNo: number; date: Date; renewal: boolean }

// Kitchen manager calls due today or in the last few days and not logged yet (one per customer: the latest due).
export async function dueCalls(today = day(0)) {
  const running = await runningPackages(today)
  // A renewal call marked Not decided stays on the list until the customer decides.
  const logged = await db.customerCall.findMany({
    where: { packageId: { in: running.map((r) => r.pkg.id) }, OR: [{ renewal: null }, { renewal: { in: ['YES', 'NO'] } }] },
    select: { packageId: true, dayNo: true },
  })
  const done = new Set(logged.map((c) => `${c.packageId}:${c.dayNo}`))
  const out: DueCall[] = []
  for (const r of running) {
    const due = callDays(r.pkg.number)
      .map((n) => ({ n, date: r.plan.dateOfDay(n) }))
      .filter((x): x is { n: number; date: Date } => !!x.date && x.date <= today && x.date >= day(-6))
      .pop()
    if (due && !done.has(`${r.pkg.id}:${due.n}`)) out.push({ ...r, dayNo: due.n, date: due.date, renewal: due.n === 26 })
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Renewal said yes on the day 26 call, next package not paid yet.
export async function waitingPayment() {
  const calls = await db.customerCall.findMany({
    where: { dayNo: 26, renewal: 'YES' },
    include: { package: { include: { lead: { include: { region: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  const next = await db.package.findMany({ where: { leadId: { in: calls.map((c) => c.leadId) }, paid: true }, select: { leadId: true, number: true } })
  return calls.filter((c) => !next.some((n) => n.leadId === c.leadId && n.number === c.package.number + 1))
}

export const monthLabel = (plan: PackagePlan, number: number) => `Month ${number} · day ${plan.todayNo ?? plan.delivered} of 26`
