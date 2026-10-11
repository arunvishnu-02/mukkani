import 'server-only'
import { db } from '@/lib/db'
import { addDays } from '@/lib/dates'

export type StockRow = { fruit: string; opening: number; cameIn: number; used: number; wastage: number; left: number; low: boolean }

const r1 = (n: number) => Math.round(n * 10) / 10

// Left = opening + came in - used - wastage (kg). Opening is what was left at the end of the day before.
export async function stockToday(date: Date, fruits: string[], lowKg: number): Promise<StockRow[]> {
  const end = addDays(date, 1)
  const [entries, waste] = await Promise.all([
    db.stockEntry.findMany({ where: { date: { lt: end } }, select: { fruit: true, kind: true, qtyKg: true, date: true } }),
    db.wastage.findMany({ where: { date: { lt: end } }, select: { fruit: true, wasteKg: true, date: true } }),
  ])
  const names = [...new Set([...fruits, ...entries.map((e) => e.fruit)])]
  return names
    .map((fruit) => {
      const before = (d: Date) => d < date
      const es = entries.filter((e) => e.fruit === fruit)
      const ws = waste.filter((w) => w.fruit === fruit)
      const sum = (xs: { qtyKg: number }[]) => xs.reduce((a, x) => a + x.qtyKg, 0)
      const opening = sum(es.filter((e) => e.kind === 'IN' && before(e.date))) - sum(es.filter((e) => e.kind === 'USED' && before(e.date))) - ws.filter((w) => before(w.date)).reduce((a, w) => a + w.wasteKg, 0)
      const cameIn = sum(es.filter((e) => e.kind === 'IN' && !before(e.date)))
      const used = sum(es.filter((e) => e.kind === 'USED' && !before(e.date)))
      const wastage = ws.filter((w) => !before(w.date)).reduce((a, w) => a + w.wasteKg, 0)
      const left = opening + cameIn - used - wastage
      return { fruit, opening: r1(opening), cameIn: r1(cameIn), used: r1(used), wastage: r1(wastage), left: r1(left), low: left < lowKg }
    })
    .filter((r) => fruits.includes(r.fruit) || r.opening || r.cameIn || r.used || r.wastage)
}
