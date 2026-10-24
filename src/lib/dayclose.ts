import 'server-only'
import { db } from '@/lib/db'
import { addDays, isSunday, keyOf } from '@/lib/dates'
import { holidaySet } from '@/lib/queries'

export type CloseItem = { key: string; label: string; who: 'Kitchen' | 'Sales'; done: boolean; detail: string; href: string }

// The working day before the sheet's day (skips Sundays and office holidays): the day whose work must be closed.
export async function workDayBefore(sheetDate: Date) {
  const hol = await holidaySet()
  let d = addDays(sheetDate, -1)
  for (let i = 0; i < 10 && (isSunday(d) || hol.has(keyOf(d))); i++) d = addDays(d, -1)
  return d
}

// Before the kitchen takes the next day's sheet: stock, wastage and staff of the work day are filled,
// and sales has added the menu for the sheet's day.
// The kitchen manager's compulsory daily work starts on this day. Earlier days are not checked.
export const KITCHEN_FIRST_FROM = new Date(Date.UTC(2026, 9, 24))

export async function dayClose(sheetDate: Date) {
  const work = await workDayBefore(sheetDate)
  const holiday = (await holidaySet()).has(keyOf(sheetDate))
  const [stock, noStock, waste, noWaste, staff, staffDays, menu] = await Promise.all([
    db.stockEntry.count({ where: { date: work } }),
    db.dayMark.findUnique({ where: { date_kind: { date: work, kind: 'NO_STOCK' } } }),
    db.wastage.count({ where: { date: work } }),
    db.dayMark.findUnique({ where: { date_kind: { date: work, kind: 'NO_WASTAGE' } } }),
    db.staff.count({ where: { active: true, kind: { in: ['KITCHEN', 'DELIVERY'] } } }),
    db.staffDay.count({ where: { date: work, staff: { active: true, kind: { in: ['KITCHEN', 'DELIVERY'] } } } }),
    db.menu.findUnique({ where: { date: sheetDate } }),
  ])
  const w = keyOf(work)
  const items: CloseItem[] = [
    { key: 'stock', label: 'Stock', who: 'Kitchen', done: stock > 0 || !!noStock, detail: stock ? `${stock} entr${stock > 1 ? 'ies' : 'y'}` : noStock ? 'No stock came in' : 'Not entered', href: '/kitchen/stock' },
    { key: 'wastage', label: 'Wastage', who: 'Kitchen', done: waste > 0 || !!noWaste, detail: waste ? `${waste} fruit${waste > 1 ? 's' : ''}` : noWaste ? 'No wastage' : 'Not entered', href: `/kitchen/wastage?date=${w}` },
    { key: 'staff', label: 'Staff tracking', who: 'Kitchen', done: staffDays >= staff, detail: staff ? `${Math.min(staffDays, staff)} of ${staff} staff` : 'No staff added', href: `/kitchen/staff?date=${w}` },
    ...(holiday ? [] : [{ key: 'menu', label: 'Menu for the sheet day', who: 'Sales' as const, done: !!menu, detail: menu ? menu.fruits : 'Sales has not added it', href: `/menu?date=${keyOf(sheetDate)}` }]),
  ]
  return { work, items, done: items.every((i) => i.done), applies: work >= KITCHEN_FIRST_FROM }
}

// From 24 Oct the kitchen fills stock, wastage and staff for the day (by 11:30 AM); only then can sales add
// the next day's menu. Returns the kitchen items still missing for the menu of sheetDate (empty = menu can be added).
export const KITCHEN_BY = '11:30 AM'
export async function kitchenBeforeMenu(sheetDate: Date, today: Date) {
  const close = await dayClose(sheetDate)
  // Only the menu for the next working day waits for today's kitchen data; menus further ahead can be added any time.
  if (close.work.getTime() !== today.getTime() || close.work < KITCHEN_FIRST_FROM) return { work: close.work, missing: [] as CloseItem[], items: [] as CloseItem[] }
  const items = close.items.filter((i) => i.who === 'Kitchen')
  return { work: close.work, missing: items.filter((i) => !i.done), items }
}

// After 11:30 AM India time: is today's kitchen data still missing? Admin gets one notice a day.
export async function kitchenLate(today: Date) {
  const ist = new Date(Date.now() + 5.5 * 3_600_000)
  const past = ist.getUTCHours() * 60 + ist.getUTCMinutes() >= 11 * 60 + 30
  if (!past || today < KITCHEN_FIRST_FROM || today.getUTCDay() === 0 || (await holidaySet()).has(keyOf(today))) return []
  let next = addDays(today, 1)
  const hol = await holidaySet()
  for (let i = 0; i < 10 && (next.getUTCDay() === 0 || hol.has(keyOf(next))); i++) next = addDays(next, 1)
  const missing = (await dayClose(next)).items.filter((i) => i.who === 'Kitchen' && !i.done)
  if (missing.length) {
    const text = `Kitchen data late on ${keyOf(today)}`
    if (!(await db.adminNotice.findFirst({ where: { text } })))
      await db.adminNotice.create({ data: { text, detail: `Not entered by ${KITCHEN_BY}: ${missing.map((i) => i.label).join(', ')}. Sales cannot add the next day menu until it is entered.`, byName: 'App', byRole: 'KITCHEN' } })
  }
  return missing
}
