import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { WASTE_REASONS } from '@/lib/labels'
import { appSettings } from '@/lib/settings'
import { Bar, Callout, Card, PageHeader, Pills, Tile, Tiles } from '@/components/ui'
import { saveWastageAction } from '../actions'

const r1 = (n: number) => Math.round(n * 10) / 10

// After cutting fruit each day, write the waste for each fruit and the reason.
export default async function WastagePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const monday = addDays(date, -((date.getUTCDay() + 6) % 7))
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const st = await appSettings()
  const [rows, week, month, used] = await Promise.all([
    db.wastage.findMany({ where: { date } }),
    db.wastage.findMany({ where: { date: { gte: monday, lt: addDays(monday, 7) } } }),
    db.wastage.aggregate({ where: { date: { gte: monthStart, lte: date } }, _sum: { wasteKg: true } }),
    db.stockEntry.findMany({ where: { date, kind: 'USED' } }),
  ])
  const by = new Map(rows.map((r) => [r.fruit, r]))
  const total = rows.reduce((a, r) => a + r.wasteKg, 0)
  const cut = rows.reduce((a, r) => a + r.cutKg, 0)
  const sumReason = (re: string) => rows.filter((r) => r.reason === re).reduce((a, r) => a + r.wasteKg, 0)
  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i))
  const perDay = days.map((d) => [d, week.filter((w) => w.date.getTime() === d.getTime()).reduce((a, w) => a + w.wasteKg, 0)] as const)
  const maxDay = Math.max(1, ...perDay.map((p) => p[1]))
  const cutDefault = (f: string) => by.get(f)?.cutKg ?? used.filter((u) => u.fruit === f).reduce((a, u) => a + u.qtyKg, 0)
  return (
    <>
      <PageHeader title="Daily wastage" crumb="Wastage" sub="After cutting fruit each day, write the waste for each fruit and the reason.">
        <form action="/kitchen/wastage" className="flex items-center gap-2"><input type="date" name="date" defaultValue={dayInput(date)} className="input py-2" /><button className="btn-secondary btn-sm">Go</button></form>
      </PageHeader>
      <Tiles cols={4}>
        <Tile label={date.getTime() === day(0).getTime() ? 'Wastage today' : `Wastage ${fmtWeekday(date)}`} value={`${r1(total)} kg`} sub={cut ? `${Math.round((total / cut) * 100)}% of fruit cut` : undefined} tone="red" />
        <Tile label="Cutting waste" value={`${r1(sumReason('Cutting waste'))} kg`} sub="peel, seeds, ends" />
        <Tile label="Spoiled" value={`${r1(sumReason('Spoiled'))} kg`} sub="over-ripe or damaged" tone="warn" />
        <Tile label="This month" value={`${r1(month._sum.wasteKg ?? 0)} kg`} sub={`week: ${r1(week.reduce((a, w) => a + w.wasteKg, 0))} kg`} />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <form action={saveWastageAction} className="card overflow-x-auto">
          <input type="hidden" name="date" value={dayInput(date)} />
          <input type="hidden" name="back" value={`/kitchen/wastage?date=${dayInput(date)}`} />
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Wastage · {fmtWeekday(date)}</h2>
              <p className="text-[13px] text-muted">Weigh the waste after cutting and pick a reason. Leave a fruit blank if it was not cut.</p>
            </div>
            <button className="btn">Save wastage</button>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Fruit</th><th className="th">Cut today (kg)</th><th className="th">Waste (kg)</th><th className="th">Waste %</th><th className="th">Reason</th></tr></thead>
            <tbody>
              {st.fruits.map((f) => {
                const w = by.get(f)
                const c = cutDefault(f)
                return (
                  <tr key={f}>
                    <td className="td font-semibold">{f}<input type="hidden" name="fruit" value={f} /></td>
                    <td className="td"><input name={`cut_${f}`} type="number" step="0.1" min="0" defaultValue={c || ''} className="input w-20 px-2 py-1.5" aria-label={`${f} cut`} /></td>
                    <td className="td"><input name={`waste_${f}`} type="number" step="0.1" min="0" defaultValue={w?.wasteKg ?? ''} className="input w-20 px-2 py-1.5" aria-label={`${f} waste`} /></td>
                    <td className="td">{w && w.cutKg ? `${Math.round((w.wasteKg / w.cutKg) * 100)}%` : '–'}</td>
                    <td className="td"><Pills name={`reason_${f}`} value={w?.reason ?? 'Cutting waste'} options={WASTE_REASONS.map((r) => [r, r])} tones={{ Spoiled: 'warn', Other: 'muted' }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </form>
        <div className="space-y-4">
          <Card title="This week" sub="Wastage per day (kg)">
            <div className="space-y-2.5">{perDay.map(([d, n]) => <Bar key={d.toISOString()} label={fmtWeekday(d)} value={r1(n)} max={maxDay} tone="warn" />)}</div>
          </Card>
          <Callout tone="brand">Admin sees wastage in Reports, next to purchase cost.</Callout>
        </div>
      </div>
    </>
  )
}
