import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, fmtWeekday, isSunday, longToday } from '@/lib/dates'
import { daySheet, groupByRegion, swapTotals } from '@/lib/queries'
import { dueCalls } from '@/lib/kitchen'
import { appSettings } from '@/lib/settings'
import { stockToday } from '@/lib/stock'
import { Bar, Card, Chip, Empty, PageHeader, Tile, Tiles } from '@/components/ui'

// Kitchen dashboard: big count tiles across the top (Arun, 3 Oct), then today's work.
export default async function KitchenDashboard() {
  await requireUser(['KITCHEN'])
  const today = day(0)
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  const [sheet, calls, altOut, st, menuTomorrow] = await Promise.all([daySheet(today), dueCalls(today), db.altBox.count({ where: { collectedOn: null } }), appSettings(), db.menu.findUnique({ where: { date: tomorrow } })])
  const stock = await stockToday(today, st.fruits, st.lowStockKg)
  const going = sheet.rows.filter((r) => !r.absent)
  const regions = groupByRegion(going, (r) => r.lead.region?.name)
  const trialRegions = groupByRegion(sheet.trials, (t) => t.trial.lead.region?.name)
  const allRegions = [...new Set([...regions.map((r) => r[0]), ...trialRegions.map((r) => r[0])])].sort()
  const swaps = swapTotals([...going.map((r) => r.swap), ...sheet.trials.map((t) => t.swap)])
  const slots = st.slots.map((s) => [s, [...going.map((r) => r.lead.slot), ...sheet.trials.map((t) => t.trial.slot)].filter((x) => x === s).length] as const)
  const low = stock.filter((s) => s.low)
  return (
    <>
      <PageHeader title="Today's kitchen" sub={`${longToday()} · boxes to prepare`}>
        <a href="/print/sheet" target="_blank" rel="noreferrer" className="btn">Print attendance sheet</a>
      </PageHeader>
      <Tiles cols={6}>
        <Tile big label="Boxes today" value={sheet.boxes} sub="production count" />
        <Tile big label="Monthly" value={sheet.monthly} tone="leaf" />
        <Tile big label="Trial" value={sheet.trials.length} tone="sky" />
        <Tile big label="Need a swap" value={sheet.swapCount} sub="from the menu" tone="warn" />
        <Tile big label="Buttermilk" value={sheet.buttermilk} sub="Mon, Wed, Fri" tone="brand" />
        <Tile big label="Calls today" value={calls.length} sub={`${calls.filter((c) => c.renewal).length} renewal`} tone="red" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card overflow-x-auto">
            <div className="px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Boxes by region</h2>
              <p className="text-[13px] text-muted">Monthly and trial boxes for each delivery area</p>
            </div>
            {allRegions.length === 0 ? <Empty>No boxes today.</Empty> : (
              <table className="w-full">
                <thead><tr><th className="th">Region</th><th className="th">Monthly</th><th className="th">Trial</th><th className="th">Swaps</th><th className="th">Buttermilk</th><th className="th">Total</th><th className="th"></th></tr></thead>
                <tbody>
                  {allRegions.map((name) => {
                    const m = regions.find((r) => r[0] === name)?.[1] ?? []
                    const t = trialRegions.find((r) => r[0] === name)?.[1] ?? []
                    return (
                      <tr key={name}>
                        <td className="td font-semibold">{name}</td><td className="td">{m.length}</td><td className="td">{t.length}</td>
                        <td className="td">{m.filter((r) => r.swap?.swapTo).length + t.filter((x) => x.swap?.swapTo).length}</td>
                        <td className="td">{m.reduce((a, r) => a + r.bm, 0)}</td><td className="td font-bold">{m.length + t.length}</td>
                        <td className="td"><a href={`/print/sheet?region=${encodeURIComponent(name)}`} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-sky">Print</a></td>
                      </tr>
                    )
                  })}
                  <tr className="font-bold"><td className="td">All regions</td><td className="td">{sheet.monthly}</td><td className="td">{sheet.trials.length}</td><td className="td">{sheet.swapCount}</td><td className="td">{sheet.buttermilk}</td><td className="td">{sheet.boxes}</td><td className="td" /></tr>
                </tbody>
              </table>
            )}
          </section>
          <Card title="Delivery slots" sub="Boxes per morning slot">
            <div className="space-y-2.5">{slots.map(([s, n]) => <Bar key={s} label={s} value={n} max={Math.max(1, sheet.boxes)} />)}</div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Swap fruit to prepare" sub="Customers who can't have a fruit on today's menu">
            {swaps.length === 0 ? <p className="text-sm text-muted">{sheet.menu ? 'No swaps today.' : 'No menu was added for today.'}</p> : (
              <div className="grid grid-cols-2 gap-2">
                {swaps.map(([f, n]) => <div key={f} className="rounded-lg bg-brand-soft px-3 py-2"><div className="text-xs text-muted">{f}</div><div className="font-display text-xl font-bold text-brand">{n} box{n > 1 ? 'es' : ''}</div></div>)}
              </div>
            )}
          </Card>
          <Card title="Today's work">
            <div className="space-y-2.5 text-sm">
              <Link href="/kitchen/calls" className="flex items-center gap-2 hover:underline"><span className="flex-1">Customer calls due</span><Chip label={String(calls.length)} tone={calls.length ? 'red' : 'muted'} /></Link>
              <Link href="/kitchen/alt-boxes" className="flex items-center gap-2 hover:underline"><span className="flex-1">Alternative boxes out</span><Chip label={String(altOut)} tone={altOut ? 'sky' : 'muted'} /></Link>
              <Link href="/kitchen/stock" className="flex items-center gap-2 hover:underline"><span className="flex-1">Low stock fruits</span><Chip label={String(low.length)} tone={low.length ? 'red' : 'muted'} /></Link>
              <Link href="/kitchen/sheet" className="flex items-center gap-2 hover:underline"><span className="flex-1">Attendance entered by sales</span><Chip label={`${sheet.entered} of ${sheet.rows.length + sheet.trials.length}`} tone="leaf" /></Link>
              <Link href="/menu" className="flex items-center gap-2 hover:underline"><span className="flex-1">Menu for {fmtWeekday(tomorrow)}</span><Chip label={menuTomorrow ? 'Added' : 'Not yet'} tone={menuTomorrow ? 'leaf' : 'warn'} /></Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
