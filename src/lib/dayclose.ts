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
export async function dayClose(sheetDate: Date) {
  const work = await workDayBefore(sheetDate)
  const holiday = (await holidaySet()).has(keyOf(sheetDate))
  const [stock, noStock, waste, noWaste, staff, staffDays, menu] = await Promise.all([
    db.stockEntry.count({ where: { date: work } }),
    db.dayMark.findUnique({ where: { date_kind: { date: work, kind: 'NO_STOCK' } } }),
    db.wastage.count({ where: { date: work } }),
    db.dayMark.findUnique({ where: { date_kind: { date: work, kind: 'NO_WASTAGE' } } }),
    db.staff.count({ where: { active: true } }),
    db.staffDay.count({ where: { date: work, staff: { active: true } } }),
    db.menu.findUnique({ where: { date: sheetDate } }),
  ])
  const w = keyOf(work)
  const items: CloseItem[] = [
    { key: 'stock', label: 'Stock', who: 'Kitchen', done: stock > 0 || !!noStock, detail: stock ? `${stock} entr${stock > 1 ? 'ies' : 'y'}` : noStock ? 'No stock came in' : 'Not entered', href: '/kitchen/stock' },
    { key: 'wastage', label: 'Wastage', who: 'Kitchen', done: waste > 0 || !!noWaste, detail: waste ? `${waste} fruit${waste > 1 ? 's' : ''}` : noWaste ? 'No wastage' : 'Not entered', href: `/kitchen/wastage?date=${w}` },
    { key: 'staff', label: 'Staff tracking', who: 'Kitchen', done: staffDays >= staff, detail: staff ? `${Math.min(staffDays, staff)} of ${staff} staff` : 'No staff added', href: `/kitchen/staff?date=${w}` },
    ...(holiday ? [] : [{ key: 'menu', label: 'Menu for the sheet day', who: 'Sales' as const, done: !!menu, detail: menu ? menu.fruits : 'Sales has not added it', href: `/menu?date=${keyOf(sheetDate)}` }]),
  ]
  return { work, items, done: items.every((i) => i.done) }
}
