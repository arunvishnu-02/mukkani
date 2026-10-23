import 'server-only'
import { db } from '@/lib/db'
import { addDays, day, keyOf } from '@/lib/dates'
import { daySheet, holidaySet, runningPackages } from '@/lib/queries'
import { renewalList } from '@/lib/renewals'
import { workDayBefore, type CloseItem } from '@/lib/dayclose'

// Sales closes each working day from this one on. Days before it are not checked.
export const SALES_CLOSE_FROM = new Date(Date.UTC(2026, 9, 24))

async function nextWorkDay(d: Date) {
  const hol = await holidaySet()
  let n = addDays(d, 1)
  for (let i = 0; i < 10 && (n.getUTCDay() === 0 || hol.has(keyOf(n))); i++) n = addDays(n, 1)
  return n
}

// Everything sales must finish for a working day: its attendance, the next day's menu, reminders, renewal
// answers, follow-up calls and trial feedback that were due by then.
export async function salesClose(work: Date) {
  const next = await nextWorkDay(work)
  const [sheet, menu, running, ren, calls, trials] = await Promise.all([
    daySheet(work),
    db.menu.findUnique({ where: { date: next } }),
    runningPackages(work),
    renewalList(work),
    db.lead.count({ where: { status: 'FOLLOW_UP', nextFollowUpAt: { lte: work } } }),
    db.trialBox.count({ where: { status: { not: 'DONE' }, deliveryDate: { lte: work } } }),
  ])
  const att = sheet.holiday ? 0 : sheet.rows.filter((r) => !r.attendance && !r.absent).length + sheet.trials.filter((t) => !t.attendance).length
  const remind = running.filter((r) => r.plan.end && r.plan.end >= work && r.plan.end <= addDays(work, 3) && !r.pkg.reminderSentAt).length
  const unanswered = ren.filter((r) => r.finished && !r.decision).length
  const w = keyOf(work)
  const items: CloseItem[] = [
    { key: 'att', label: 'Attendance', who: 'Sales', done: att === 0, detail: att ? `${att} not entered` : 'All entered', href: `/attendance?date=${w}` },
    { key: 'menu', label: 'Next day menu', who: 'Sales', done: !!menu, detail: menu ? menu.fruits : 'Not added', href: `/menu?date=${keyOf(next)}` },
    { key: 'remind', label: 'Reminders', who: 'Sales', done: remind === 0, detail: remind ? `${remind} to send` : 'All sent', href: '/reminders' },
    { key: 'renew', label: 'Renewal answers', who: 'Sales', done: unanswered === 0, detail: unanswered ? `${unanswered} not asked` : 'All answered', href: '/renewals' },
    { key: 'calls', label: 'Follow-up calls', who: 'Sales', done: calls === 0, detail: calls ? `${calls} due` : 'All done', href: '/calls' },
    { key: 'trials', label: 'Trial feedback', who: 'Sales', done: trials === 0, detail: trials ? `${trials} waiting` : 'All done', href: '/trials?tab=waiting' },
  ]
  return { work, next, items, done: items.every((i) => i.done) }
}

// The day sales must have finished before today's attendance opens (null when the rule does not apply yet).
export async function salesDayToFinish(today = day(0)) {
  const prev = await workDayBefore(today)
  return prev >= SALES_CLOSE_FROM ? prev : null
}
