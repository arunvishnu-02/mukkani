import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { addDays, day } from '@/lib/dates'
import { holidaySet, planFor, runningPackages, type Running } from '@/lib/queries'

export type RenewalRow = Running & {
  finished: boolean // 26 boxes done
  decision: 'YES' | 'NO' | 'UNDECIDED' | null // from the day 26 renewal call
  reason: string | null
  calledAt: Date | null
}

// Packs that finished in the last few weeks and have no next month yet (customer still with us).
export const finishedWithoutNext = cache(async (today: Date = day(0), withinDays = 30): Promise<Running[]> => {
  const pkgs = await db.package.findMany({
    where: { status: 'COMPLETED', updatedAt: { gte: addDays(today, -withinDays) }, lead: { status: { not: 'NOT_INTERESTED' }, customerStatus: { not: 'INACTIVE' } } },
    include: { lead: { include: { region: true } } },
  })
  if (pkgs.length === 0) return []
  const later = await db.package.findMany({ where: { leadId: { in: pkgs.map((p) => p.leadId) } }, select: { leadId: true, number: true } })
  const latest = pkgs.filter((p) => !later.some((l) => l.leadId === p.leadId && l.number > p.number))
  const att = await db.attendance.findMany({ where: { leadId: { in: latest.map((p) => p.leadId) } }, select: { leadId: true, date: true, status: true, boxes: true } })
  const hol = await holidaySet()
  return latest.map((pkg) => ({ pkg, plan: planFor(pkg, att.filter((a) => a.leadId === pkg.leadId), today, hol) }))
})

// Everyone whose month ends in the next 3 days or has ended without a next month, with their renewal answer.
export async function renewalList(today = day(0)): Promise<RenewalRow[]> {
  const [running, finished] = await Promise.all([runningPackages(today), finishedWithoutNext(today)])
  const nextOf = new Set((await db.package.findMany({ where: { status: 'ACTIVE' }, select: { leadId: true, number: true } })).map((p) => `${p.leadId}:${p.number}`))
  const ending = running.filter((r) => r.plan.end && r.plan.end <= addDays(today, 3) && !nextOf.has(`${r.pkg.leadId}:${r.pkg.number + 1}`))
  const rows = [...finished.map((r) => ({ ...r, finished: true })), ...ending.map((r) => ({ ...r, finished: false }))]
  const calls = await db.customerCall.findMany({ where: { packageId: { in: rows.map((r) => r.pkg.id) }, dayNo: 26 } })
  return rows
    .map((r) => {
      const c = calls.find((x) => x.packageId === r.pkg.id)
      return { ...r, decision: (c?.renewal as RenewalRow['decision']) ?? null, reason: c?.reason ?? null, calledAt: c?.createdAt ?? null }
    })
    .sort((a, b) => (a.plan.end?.getTime() ?? 0) - (b.plan.end?.getTime() ?? 0))
}
