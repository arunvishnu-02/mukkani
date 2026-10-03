import 'server-only'
import { db } from '@/lib/db'
import { day } from '@/lib/dates'
import type { Prisma } from '@/generated/prisma/client'

export const OPEN_TRIAL = ['PENDING', 'ASSIGNED', 'PREPARING', 'DELIVERED', 'TRIAL_ACTIVE'] as const

export const leadInclude = {
  region: true,
  owner: { select: { name: true } },
  trialBoxes: { orderBy: { createdAt: 'desc' }, take: 1 },
  packages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.LeadInclude

export type LeadRow = Prisma.LeadGetPayload<{ include: typeof leadInclude }>

// A customer is anyone with a trial box or a package. Regular box wins over trial box.
export function boxType(l: LeadRow): 'Regular box' | 'Trial box' | null {
  const p = l.packages[0]
  if (p && (p.status === 'ACTIVE' || p.status === 'PAUSED')) return 'Regular box'
  const t = l.trialBoxes[0]
  if (t && t.status !== 'COMPLETED') return 'Trial box'
  if (t || p) return p ? 'Regular box' : 'Trial box'
  return null
}

export const customerWhere: Prisma.LeadWhereInput = { OR: [{ trialBoxes: { some: {} } }, { packages: { some: {} } }] }

// Boxes the kitchen prepares today: active packages that have started, and open trials whose dates cover today.
export async function kitchenToday() {
  const today = day(0)
  const [packages, trials, paused] = await Promise.all([
    db.package.findMany({
      where: { status: 'ACTIVE', startDate: { lte: today } },
      include: { lead: { include: { region: true } } },
      orderBy: { lead: { name: 'asc' } },
    }),
    db.trialBox.findMany({
      where: { status: { in: [...OPEN_TRIAL] }, startDate: { lte: today }, endDate: { gte: today } },
      include: { lead: { include: { region: true } } },
      orderBy: { lead: { name: 'asc' } },
    }),
    db.package.count({ where: { status: 'PAUSED' } }),
  ])
  const newTrials = trials.filter((t) => t.startDate.getTime() === today.getTime()).length
  const endingTrials = trials.filter((t) => t.endDate.getTime() === today.getTime()).length
  return { packages, trials, paused, newTrials, endingTrials, total: packages.length + trials.length }
}

export async function regionsList() {
  return db.region.findMany({ orderBy: { name: 'asc' } })
}
