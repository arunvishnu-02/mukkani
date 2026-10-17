import 'server-only'
import { db } from '@/lib/db'
import { day, isSunday, nowHourIST } from '@/lib/dates'
import { dueCalls, lateAdds } from '@/lib/kitchen'
import { daySheet, runningPackages } from '@/lib/queries'
import { renewalList } from '@/lib/renewals'

// Work waiting on each sidebar page, shown as a small count next to the menu item.
export type Badge = { n: number; tip: string }
export type Badges = Record<string, Badge>

export async function navBadges(role: string): Promise<Badges> {
  const today = day(0)
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  const sales = role === 'SALES' || role === 'ADMIN'
  const kitchen = role === 'KITCHEN' || role === 'ADMIN'
  const admin = role === 'ADMIN'
  const none = Promise.resolve(0)
  const [newLeads, calls, trials, menu, issues, running, sheet, kCalls, late, dues, requests, notices, renewals] = await Promise.all([
    sales ? db.lead.count({ where: { createdAt: { gte: new Date(today.getTime() - 5.5 * 3_600_000) } } }) : none,
    sales ? db.lead.count({ where: { status: 'FOLLOW_UP', nextFollowUpAt: { lte: today } } }) : none,
    sales ? db.trialBox.count({ where: { status: { not: 'DONE' }, deliveryDate: { lte: today } } }) : none,
    db.menu.count({ where: { date: tomorrow } }),
    db.issue.count({ where: { status: { not: 'DONE' } } }),
    sales ? runningPackages(today) : Promise.resolve([]),
    sales && !isSunday(today) && nowHourIST() >= 9 ? daySheet(today) : Promise.resolve(null),
    kitchen ? dueCalls(today).then((x) => x.length) : none,
    kitchen ? lateAdds().then((x) => x.length) : none,
    admin ? db.due.count({ where: { paidAt: null, dueDate: { lte: day(1) } } }) : none,
    admin ? db.dayRequest.count({ where: { status: 'PENDING' } }) : none,
    admin ? db.adminNotice.count({ where: { seenAt: null } }) : none,
    sales || kitchen ? renewalList(today).then((x) => x.filter((r) => r.finished && (r.decision == null || r.decision === 'UNDECIDED' || r.decision === 'YES')).length) : none,
  ])
  const reminders = running.filter((r) => r.plan.end && r.plan.end >= today && r.plan.end <= day(3) && !r.pkg.reminderSentAt).length
  const toEnter = sheet ? sheet.rows.length + sheet.trials.length - sheet.entered : 0
  const b: Badges = {
    '/leads': { n: newLeads, tip: 'New leads today' },
    '/calls': { n: calls, tip: 'Follow-up calls due today or overdue' },
    '/trials': { n: trials, tip: 'Trial feedback to take' },
    '/menu': { n: menu ? 0 : 1, tip: 'Tomorrow’s menu is not added yet' },
    '/attendance': { n: toEnter, tip: 'Customers whose attendance is not entered today' },
    '/reminders': { n: reminders, tip: 'End-date and payment reminders to send today' },
    '/renewals': { n: renewals, tip: 'Month over: ask if they continue, or start next month' },
    '/issues': { n: issues, tip: 'Open daily issues' },
    '/kitchen/calls': { n: kCalls, tip: 'Customer calls due' },
    '/kitchen/boxes': { n: late, tip: 'New trials or packs added after 2 PM' },
    '/admin/dues': { n: dues, tip: 'Dues due by tomorrow or overdue' },
    '/admin/requests': { n: requests, tip: 'Past-day requests waiting for you' },
    '/admin/notices': { n: notices, tip: 'Deleted by sales or the kitchen, not seen yet' },
  }
  return Object.fromEntries(Object.entries(b).filter(([, x]) => x.n > 0))
}
