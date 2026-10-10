import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { ATTENDANCE } from '@/lib/labels'
import { daySheet, groupByRegion } from '@/lib/queries'
import { Callout, Chip, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles } from '@/components/ui'

// Print at 3 AM. After delivery, write the attendance on the paper. Sales enters it after 11 AM.
export default async function KitchenSheet({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const sheet = await daySheet(date)
  const rows = sheet.rows.filter((r) => !r.absent)
  const groups = groupByRegion(rows, (r) => r.lead.region?.name)
  const region = groups.find(([n]) => n === sp.region) ?? groups[0]
  const list = region?.[1] ?? []
  const q = `date=${dayInput(date)}`
  return (
    <>
      <PageHeader title={date.getTime() === day(0).getTime() ? "Today's attendance sheet" : `Attendance sheet ${fmtWeekday(date)}`} crumb="Delivery attendance" sub="Print at 3 AM. After delivery, write the attendance on the paper. Sales enters it in the dashboard after 11 AM.">
        <a href={`/print/sheet?${q}`} target="_blank" rel="noreferrer" className="btn">Print all regions</a>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2.5">
        {groups.length > 0 && <Tabs items={groups.map(([n, rs]) => ({ label: `${n} ${rs.length}`, href: `/kitchen/sheet?${q}&region=${encodeURIComponent(n)}`, active: n === region?.[0] }))} />}
        <div className="flex-1" />
        <form action="/kitchen/sheet" className="flex items-center gap-2"><input type="date" name="date" defaultValue={dayInput(date)} className="input py-2" /><button className="btn-secondary btn-sm">Go</button></form>
      </div>
      <Tiles cols={5}>
        <Tile label="Boxes" value={sheet.boxes} sub={fmtWeekday(date)} />
        <Tile label="Need a swap" value={sheet.swapCount} sub={sheet.menu ? "from yesterday's menu" : 'no menu added'} tone="warn" />
        <Tile label="Alternative boxes" value={sheet.altBoxes} sub="blue rows on the sheet" tone="sky" />
        <Tile label="Buttermilk" value={sheet.buttermilk} sub="Mon, Wed, Fri" tone="leaf" />
        <Tile label="Entered by sales" value={`${sheet.entered} of ${sheet.rows.length + sheet.trials.length}`} sub="after 11 AM" tone="brand" />
      </Tiles>
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">{region?.[0] ?? 'No region'} · {list.length} customers</h2>
            <p className="text-[13px] text-muted">Same rows and order as the printed sheet</p>
          </div>
          {region && <a href={`/print/sheet?${q}&region=${encodeURIComponent(region[0])}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Print {region[0]}</a>}
        </div>
        {list.length === 0 ? <Empty>No monthly boxes on this day.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Customer</th><th className="th">Time</th><th className="th">BM</th><th className="th">Alt box no.</th><th className="th">Attendance</th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.pkg.id} className={r.altBox ? 'bg-sky-soft' : ''}>
                  <td className="td">{i + 1}</td>
                  <td className="td">
                    <Link href={`/customers/${r.lead.id}`} className="font-semibold hover:underline">{r.lead.name}</Link>
                    {r.swap?.swapTo && <span className="ml-1.5"><Chip label={`Swap: ${r.swap.swapTo}`} tone="warn" /></span>}
                    {r.isNew && <span className="ml-1.5"><Chip label="New" tone="leaf" /></span>}
                    {r.altBox && <span className="ml-1.5 text-[11px] font-bold text-sky">ALT BOX</span>}
                  </td>
                  <td className="td">{r.lead.deliveryTime ?? r.lead.slot ?? '—'}</td>
                  <td className="td">{r.bm ? <Chip label={`BM ${r.bm}`} tone="leaf" /> : ''}</td>
                  <td className="td">{r.altBox ?? '—'}</td>
                  <td className="td">{r.attendance ? <StatusChip map={ATTENDANCE} value={r.attendance.status} /> : <Chip label="After 11 AM" tone="muted" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Callout tone="sky">Blue = alternative box today. Orange tag = fruit swap from the menu. Trial boxes and customers on leave are printed at the bottom of the sheet.</Callout>
    </>
  )
}
