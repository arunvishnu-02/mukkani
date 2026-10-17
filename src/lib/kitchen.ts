import 'server-only'
import { db } from '@/lib/db'
import { day } from '@/lib/dates'
import { callDays, type PackagePlan } from '@/lib/plan'
import { runningPackages, type Running } from '@/lib/queries'
import { finishedWithoutNext } from '@/lib/renewals'

export type DueCall = Running & { dayNo: number; date: Date; renewal: boolean }

// Kitchen manager calls due today or in the last few days and not logged yet (one per customer: the latest due).
export async function dueCalls(today = day(0)) {
  // A pack whose 26th box is entered is Completed; its renewal call must still show until it is made.
  const running = [...(await runningPackages(today)), ...(await finishedWithoutNext(today, 14))]
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

// Trials booked and monthly packs started after 2 PM today. By then the kitchen has planned tomorrow,
// so these are shown to the kitchen manager as a notice.
export async function lateAdds() {
  const cutoff = new Date(day(0).getTime() + (14 - 5.5) * 3_600_000) // 2 PM India time
  const [trials, packs] = await Promise.all([
    db.trialBox.findMany({ where: { createdAt: { gte: cutoff }, status: 'BOOKED' }, include: { lead: { include: { region: true } } }, orderBy: { createdAt: 'asc' } }),
    db.package.findMany({ where: { createdAt: { gte: cutoff }, status: 'ACTIVE' }, include: { lead: { include: { region: true } } }, orderBy: { createdAt: 'asc' } }),
  ])
  return [
    ...trials.map((t) => ({ id: t.id, leadId: t.leadId, name: t.lead.name, region: t.lead.region?.name ?? null, kind: 'Trial box' as const, date: t.deliveryDate, at: t.createdAt })),
    ...packs.map((p) => ({ id: p.id, leadId: p.leadId, name: p.lead.name, region: p.lead.region?.name ?? null, kind: (p.number > 1 ? 'Renewal' : 'New monthly pack') as 'Renewal' | 'New monthly pack', date: p.startDate, at: p.createdAt })),
  ]
}

export const monthLabel = (plan: PackagePlan, number: number) => `Month ${number} · day ${plan.todayNo ?? plan.delivered} of 26`
