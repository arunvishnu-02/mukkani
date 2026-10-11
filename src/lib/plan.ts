// Day-by-day plan of one monthly package (plan doc section 3).
// 26 delivery days, Monday to Saturday. Sunday is a holiday and never counts.
// Only Absent, Not delivered and Paused days push the end date; a past day with no attendance
// entered yet is counted as a delivery so a late entry never moves the end date.
import type { AttendanceStatus } from '@/generated/prisma/enums'
import { addDays, isSunday, keyOf } from './dates'

export type DayKind = 'delivered' | 'leave' | 'notDelivered' | 'paused' | 'holiday' | 'planned'

export type PlanDay = {
  date: Date
  kind: DayKind
  dayNo: number | null // delivery day number (1..26) for counted days
  carried: boolean // a counted day that falls after the original end date (pushed by leave)
  entered: boolean // attendance has been entered for this day
}

export type PackagePlan = {
  days: PlanDay[]
  end: Date | null // null while paused with no return date
  originalEnd: Date
  delivered: number
  leave: number
  dateOfDay: (n: number) => Date | null
  dayOn: (d: Date) => PlanDay | undefined
  todayNo: number | null // delivery day number today, when today is a counted day
  done: boolean
}

export function planPackage(opts: {
  start: Date
  total?: number
  attendance: { date: Date; status: AttendanceStatus }[]
  pause?: { from: Date; until: Date | null } | null
  stopped?: boolean
  today: Date
}): PackagePlan {
  const total = opts.total ?? 26
  const att = new Map(opts.attendance.map((a) => [keyOf(a.date), a.status]))
  const days: PlanDay[] = []
  let originalEnd = opts.start
  for (let d = opts.start, n = 0; n < total; d = addDays(d, 1)) {
    if (!isSunday(d)) {
      n++
      originalEnd = d
    }
  }
  let count = 0
  let delivered = 0
  let leave = 0
  let end: Date | null = null
  const pausedOn = (d: Date) => !!opts.pause && d >= opts.pause.from && (opts.pause.until == null || d <= opts.pause.until)
  // A package can stretch at most 4 months (long leave); beyond that the end is unknown.
  for (let d = opts.start, i = 0; count < total && i < 120; d = addDays(d, 1), i++) {
    const k = keyOf(d)
    const st = att.get(k)
    const base = { date: d, carried: false, entered: st != null }
    if (isSunday(d)) {
      days.push({ ...base, kind: 'holiday', dayNo: null })
    } else if (st === 'ABSENT' || st === 'NOT_DELIVERED') {
      days.push({ ...base, kind: st === 'ABSENT' ? 'leave' : 'notDelivered', dayNo: null })
      leave++
    } else if (st === 'DELIVERED') {
      count++
      delivered++
      days.push({ ...base, kind: 'delivered', dayNo: count, carried: d > originalEnd })
    } else if (opts.stopped && d >= opts.today) {
      break
    } else if (d >= opts.today && pausedOn(d)) {
      days.push({ ...base, kind: 'paused', dayNo: null })
      if (opts.pause!.until == null) break
    } else {
      count++
      days.push({ ...base, kind: 'planned', dayNo: count, carried: d > originalEnd })
    }
    if (count === total) end = d
  }
  const byKey = new Map(days.map((x) => [keyOf(x.date), x]))
  const todayDay = byKey.get(keyOf(opts.today))
  return {
    days,
    end,
    originalEnd,
    delivered,
    leave,
    dateOfDay: (n) => days.find((x) => x.dayNo === n)?.date ?? null,
    dayOn: (d) => byKey.get(keyOf(d)),
    todayNo: todayDay?.dayNo ?? null,
    done: delivered >= total,
  }
}

// Mon-Sun weeks covering the package, for the 30-day calendar.
export function calendarWeeks(plan: PackagePlan): (PlanDay | { date: Date; kind: 'outside' })[][] {
  if (plan.days.length === 0) return []
  const first = plan.days[0].date
  const last = plan.days[plan.days.length - 1].date
  const monday = addDays(first, -((first.getUTCDay() + 6) % 7))
  const weeks: (PlanDay | { date: Date; kind: 'outside' })[][] = []
  for (let w = monday; w <= last; w = addDays(w, 7)) {
    const row: (PlanDay | { date: Date; kind: 'outside' })[] = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i)
      row.push(plan.dayOn(d) ?? { date: d, kind: 'outside' })
    }
    weeks.push(row)
  }
  return weeks
}

// Kitchen manager call days: first month day 1, 5, 15, 26; later months day 15, 26 (day 26 = renewal).
export const callDays = (packageNumber: number) => (packageNumber === 1 ? [1, 5, 15, 26] : [15, 26])

// Buttermilk goes out Monday, Wednesday and Friday.
export const isButtermilkDay = (d: Date) => [1, 3, 5].includes(d.getUTCDay())
