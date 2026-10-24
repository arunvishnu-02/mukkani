import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { WASTE_REASONS } from '@/lib/labels'
import { appSettings } from '@/lib/settings'
import { splitList } from '@/lib/menu'
import { Bar, Callout, Card, PageHeader, Pills, Tile, Tiles } from '@/components/ui'
import { dayMarkAction, saveWastageAction } from '../actions'
import { DateField } from '@/components/DateField'
import { DayLock } from '@/components/DayLock'
import { Reveal } from '@/components/Reveal'

const r1 = (n: number) => Math.round(n * 10) / 10

// After cutting fruit each day, write the waste for each fruit and the reason.
export default async function WastagePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const monday = addDays(date, -((date.getUTCDay() + 6) % 7))
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const st = await appSettings()
  const [menu, rows, week, month, used, noWaste] = await Promise.all([
    db.menu.findUnique({ where: { date } }),
    db.wastage.findMany({ where: { date } }),
    db.wastage.findMany({ where: { date: { gte: monday, lt: addDays(monday, 7) } } }),
    db.wastage.aggregate({ where: { date: { gte: monthStart, lte: date } }, _sum: { wasteKg: true } }),
    db.stockEntry.findMany({ where: { date, kind: 'USED' } }),
    db.dayMark.findUnique({ where: { date_kind: { date, kind: 'NO_WASTAGE' } } }),
  ])
  const by = new Map(rows.map((r) => [r.fruit, r]))
  // The menu fruits of the day come first and are marked, so it is clear which fruits were cut.
  const onMenu = new Set(splitList(menu?.fruits))
  const swapOnly = new Set(splitList(menu?.swapFruits))
  // Only the fruits of the day: menu fruits, the fruit given instead, and any fruit that already has wastage saved.
  // Without a menu, or with ?all=1, every fruit is listed.
  const showAll = !menu || sp.all === '1'
  const shown = (f: string) => showAll || onMenu.has(f) || swapOnly.has(f) || by.has(f)
  const fruitList = [...st.fruits].filter(shown).sort((a, b) => Number(onMenu.has(b)) - Number(onMenu.has(a)) || Number(swapOnly.has(b)) - Number(swapOnly.has(a)))
  const hidden = st.fruits.length - fruitList.length
  const total = rows.reduce((a, r) => a + r.wasteKg, 0)
  const cut = rows.reduce((a, r) => a + r.cutKg, 0)
  const sumReason = (re: string) => rows.filter((r) => r.reason === re || r.reason.startsWith(`${re}:`)).reduce((a, r) => a + r.wasteKg, 0)
  const days = [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i))
  const perDay = days.map((d) => [d, week.filter((w) => w.date.getTime() === d.getTime()).reduce((a, w) => a + w.wasteKg, 0)] as const)
  const maxDay = Math.max(1, ...perDay.map((p) => p[1]))
  const cutDefault = (f: string) => by.get(f)?.cutKg ?? used.filter((u) => u.fruit === f).reduce((a, u) => a + u.qtyKg, 0)
  return (
    <>
      <PageHeader title="Daily wastage" crumb="Wastage" sub="After cutting fruit each day, write the waste for each fruit and the reason.">
        <form action="/kitchen/wastage" className="flex items-center gap-2"><DateField name="date" defaultValue={dayInput(date)} compact /><button className="btn-secondary btn-sm">Go</button></form>
      </PageHeader>
      {sp.error && <div className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[13px] font-medium text-red">{sp.error}</div>}
      <DayLock user={user} date={date} area="Wastage" back={`/kitchen/wastage?date=${dayInput(date)}`} />
      {rows.length === 0 && (
        <form action={dayMarkAction} className={`flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3 text-[13px] font-medium ${noWaste ? 'bg-leaf-soft text-leaf' : 'bg-tur-soft'}`}>
          <input type="hidden" name="kind" value="NO_WASTAGE" /><input type="hidden" name="date" value={dayInput(date)} /><input type="hidden" name="back" value={`/kitchen/wastage?date=${dayInput(date)}`} />
          {noWaste ? <><input type="hidden" name="undo" value="1" /><span className="flex-1">Marked: no wastage on {fmtWeekday(date)}.</span><button className="text-xs font-semibold text-muted underline">Undo</button></>
            : <><span className="flex-1">Wastage for {fmtWeekday(date)} is not entered. Fill the table, or if nothing was wasted, tap the button.</span><button className="btn btn-sm">No wastage today</button></>}
        </form>
      )}
      <div className="rounded-[10px] bg-leaf-soft px-4 py-3 text-[13px]">
        <div className="mb-1 text-xs font-bold tracking-wide text-leaf uppercase">Menu · {fmtWeekday(date)}</div>
        {menu ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span><b>Fruits:</b> {menu.fruits}</span>
            <span><b>Salad:</b> {menu.salad || '—'}</span>
            {menu.swapFruits && <span><b>Given instead:</b> {menu.swapFruits}</span>}
          </div>
        ) : <span className="font-semibold text-red">Menu not added for this day yet. Ask sales.</span>}
      </div>
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
              <p className="text-[13px] text-muted">Only the fruits of the day's menu are listed. Weigh the waste after cutting and pick a reason. Leave a fruit blank if it was not cut.</p>
            </div>
            <button className="btn">Save wastage</button>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Fruit</th><th className="th">Cut today (kg)</th><th className="th">Waste (kg)</th><th className="th">Waste %</th><th className="th">Reason</th></tr></thead>
            <tbody>
              {fruitList.map((f) => {
                const w = by.get(f)
                const c = cutDefault(f)
                return (
                  <tr key={f} className={onMenu.has(f) ? "bg-leaf-soft/40" : ""}>
                    <td className="td font-semibold">{f}{onMenu.has(f) ? <span className="ml-2 rounded-full bg-leaf-soft px-2 py-0.5 text-[11px] font-semibold text-leaf">On menu</span> : swapOnly.has(f) ? <span className="ml-2 rounded-full bg-tur-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Given instead</span> : null}<input type="hidden" name="fruit" value={f} /></td>
                    <td className="td"><input name={`cut_${f}`} type="number" step="0.1" min="0" defaultValue={c || ''} className="input w-20 px-2 py-1.5" aria-label={`${f} cut`} /></td>
                    <td className="td"><input name={`waste_${f}`} type="number" step="0.1" min="0" defaultValue={w?.wasteKg ?? ''} className="input w-20 px-2 py-1.5" aria-label={`${f} waste`} /></td>
                    <td className="td">{w && w.cutKg ? `${Math.round((w.wasteKg / w.cutKg) * 100)}%` : '–'}</td>
                    <td className="td">
                      <Pills name={`reason_${f}`} value={w?.reason.startsWith('Other') ? 'Other' : (w?.reason ?? 'Cutting waste')} options={WASTE_REASONS.map((r) => [r, r])} tones={{ Spoiled: 'warn', Other: 'muted' }} />
                      <Reveal name={`reason_${f}`} values={['Other']} initial={w?.reason.startsWith('Other') ? 'Other' : null}><input name={`reasonNote_${f}`} defaultValue={w?.reason.startsWith('Other: ') ? w.reason.slice(7) : ''} placeholder="Type the reason" aria-label={`Other reason for ${f}`} className="input mt-1.5 px-2 py-1.5 text-[13px]" /></Reveal>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {menu && (
            <div className="border-t border-line px-5 py-3 text-[13px] text-muted">
              {showAll ? <a className="font-semibold text-sky" href={`/kitchen/wastage?date=${dayInput(date)}`}>Show only the menu fruits</a>
                : hidden > 0 && <>Showing only the menu fruits. <a className="font-semibold text-sky" href={`/kitchen/wastage?date=${dayInput(date)}&all=1`}>Show all {st.fruits.length} fruits</a></>}
            </div>
          )}
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
