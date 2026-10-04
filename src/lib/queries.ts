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

// A customer is a converted lead: someone with a monthly package. Everyone else stays under Leads.
export const customerWhere: Prisma.LeadWhereInput = { packages: { some: {} } }

// Calls due today. A lead with no date set is also due today when it is marked Follow-Up Required
// or has a trial box running, so it is never missed.
export const dueToday = (today: Date): Prisma.LeadWhereInput => ({
  OR: [
    { nextFollowUpAt: today },
    { nextFollowUpAt: null, OR: [{ status: 'FOLLOW_UP' }, { trialBoxes: { some: { result: null } } }] },
  ],
})

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
