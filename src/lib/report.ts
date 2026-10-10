import 'server-only'
import { db } from '@/lib/db'
import { addDays, day } from '@/lib/dates'

// Business figures for a period [from, to). Used by the admin overview, Reports and the CSV downloads.
export type Period = { from: Date; to: Date; label: string }

export function period(kind: string | undefined, today = day(0)): Period & { kind: 'day' | 'week' | 'month' } {
  if (kind === 'day') return { kind: 'day', from: today, to: addDays(today, 1), label: 'Today' }
  if (kind === 'week') {
    const back = (today.getUTCDay() + 6) % 7 // Monday is the first day
    return { kind: 'week', from: addDays(today, -back), to: addDays(today, 7 - back), label: 'This week' }
  }
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
  return { kind: 'month', from, to, label: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(from) }
}

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')

// Money received: a monthly pack counts on the day it was marked paid, a trial on its delivery date.
export async function figures({ from, to }: { from: Date; to: Date }) {
  const range = { gte: from, lt: to }
  const [leads, trials, trialsDone, packages, paidPkgs, paidTrials, money, delivered, notInterested, waste] = await Promise.all([
    db.lead.findMany({ where: { createdAt: range }, select: { source: true, ownerId: true } }),
    db.trialBox.findMany({ where: { createdAt: range }, select: { lead: { select: { ownerId: true } } } }),
    db.trialBox.findMany({ where: { status: 'DONE', updatedAt: range }, select: { result: true } }),
    db.package.findMany({ where: { createdAt: range }, select: { number: true, lead: { select: { ownerId: true } } } }),
    db.package.findMany({ where: { paid: true, paidAt: range }, select: { price: true, buttermilkQty: true, buttermilkPrice: true } }),
    db.trialBox.findMany({ where: { paid: true, deliveryDate: range }, select: { price: true } }),
    db.moneyEntry.findMany({ where: { date: range }, select: { type: true, amount: true, category: true } }),
    db.attendance.count({ where: { date: range, status: 'DELIVERED' } }),
    db.lead.findMany({ where: { status: 'NOT_INTERESTED', updatedAt: range }, select: { notInterestedReason: true } }),
    db.wastage.findMany({ where: { date: range }, select: { wasteKg: true, cutKg: true } }),
  ])
  const monthlyIncome = paidPkgs.reduce((a, p) => a + p.price, 0)
  const buttermilkIncome = paidPkgs.reduce((a, p) => a + p.buttermilkQty * p.buttermilkPrice, 0)
  const trialIncome = paidTrials.reduce((a, t) => a + t.price, 0)
  const purchases = money.filter((m) => m.type === 'PURCHASE').reduce((a, m) => a + m.amount, 0)
  const expenses = money.filter((m) => m.type === 'EXPENSE').reduce((a, m) => a + m.amount, 0)
  const income = monthlyIncome + buttermilkIncome + trialIncome
  const reasons = new Map<string, number>()
  for (const l of notInterested) reasons.set(l.notInterestedReason ?? 'No reason given', (reasons.get(l.notInterestedReason ?? 'No reason given') ?? 0) + 1)
  const sources = new Map<string, number>()
  for (const l of leads) sources.set(l.source, (sources.get(l.source) ?? 0) + 1)
  const byCategory = new Map<string, number>()
  for (const m of money) byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + m.amount)
  return {
    leads: leads.length,
    sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
    trials: trials.length,
    trialsDone: trialsDone.length,
    trialsWon: trialsDone.filter((t) => t.result === 'MONTHLY').length,
    newMonthly: packages.filter((p) => p.number === 1).length,
    renewals: packages.filter((p) => p.number > 1).length,
    monthlyIncome,
    buttermilkIncome,
    trialIncome,
    income,
    purchases,
    expenses,
    spent: purchases + expenses,
    profit: income - purchases - expenses,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    boxesDelivered: delivered,
    notInterested: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
    wasteKg: Math.round(waste.reduce((a, w) => a + w.wasteKg, 0) * 10) / 10,
    cutKg: Math.round(waste.reduce((a, w) => a + w.cutKg, 0) * 10) / 10,
    ownerOf: { leads, trials, packages },
  }
}

// Per salesperson: leads added, calls made, trials booked, monthly packs started in the period.
export async function teamFigures({ from, to }: { from: Date; to: Date }) {
  const range = { gte: from, lt: to }
  const [users, calls, f] = await Promise.all([
    db.user.findMany({ where: { role: 'SALES' }, orderBy: { name: 'asc' } }),
    db.followUp.groupBy({ by: ['byId'], where: { createdAt: range }, _count: true }),
    figures({ from, to }),
  ])
  return users.map((u) => {
    const trials = f.ownerOf.trials.filter((t) => t.lead.ownerId === u.id).length
    const monthly = f.ownerOf.packages.filter((p) => p.number === 1 && p.lead.ownerId === u.id).length
    return {
      user: u,
      leads: f.ownerOf.leads.filter((l) => l.ownerId === u.id).length,
      calls: calls.find((c) => c.byId === u.id)?._count ?? 0,
      trials,
      monthly,
      rate: pct(monthly, trials),
    }
  })
}
