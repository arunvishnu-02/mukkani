import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, isSunday, parseDay } from '@/lib/dates'
import { ATTENDANCE } from '@/lib/labels'
import { daySheet, groupByRegion, runningPackages } from '@/lib/queries'
import { Callout, Chip, Empty, ErrorNote, PageHeader, StatusChip, Tabs, Tile, Tiles } from '@/components/ui'
import { CancelLeave, LeaveDrawer } from '@/components/Leave'
import { lateAdds } from '@/lib/kitchen'
import { saveSheetOrder } from '../../ops-actions'
import { DateField } from '@/components/DateField'

// Print at 3 AM. After delivery, write the attendance on the paper. Sales enters it after 9 AM.
export default async function KitchenSheet({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const [sheet, running, late] = await Promise.all([daySheet(date), runningPackages(day(0)), lateAdds()])
  const rows = sheet.rows.filter((r) => !r.absent)
  const onLeave = sheet.rows.filter((r) => r.absent)
  const groups = groupByRegion(rows, (r) => r.lead.region?.name)
  const region = groups.find(([n]) => n === sp.region) ?? groups[0]
  const list = region?.[1] ?? []
  const q = `date=${dayInput(date)}`
  const self = `/kitchen/sheet?${q}${region ? `&region=${encodeURIComponent(region[0])}` : ''}`
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  return (
    <>
      <PageHeader title={date.getTime() === day(0).getTime() ? "Today's attendance sheet" : `Attendance sheet ${fmtWeekday(date)}`} crumb="Delivery attendance" sub="Print at 3 AM. After delivery, write the attendance on the paper. Sales enters it in the dashboard after 9 AM.">
        <Link href={`${self}&leave=1`} scroll={false} className="btn-secondary">Mark leave</Link>
        <a href={`/print/sheet?${q}`} target="_blank" rel="noreferrer" className="btn">Print all regions</a>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.leave && sp.leave !== '1' && <Callout>{sp.leave}</Callout>}
      {sp.ordered && <Callout>Order saved for {region?.[0]}. The printed sheet follows it.</Callout>}
      {late.length > 0 && (
        <section className="rounded-[10px] border border-tur bg-tur-soft px-4 py-3">
          <div className="text-sm font-bold text-warn">Added after 2 PM today · {late.length}</div>
          <p className="text-xs text-muted">These came in after the day&apos;s planning. Check tomorrow&apos;s count and sheet.</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {late.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-2">
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-warn">{l.kind}</span>
                <Link href={`/customers/${l.leadId}`} className="font-semibold hover:underline">{l.name}</Link>
                <span className="text-muted">{l.region ?? 'No region'} · {l.kind === 'Trial box' ? 'delivery' : 'starts'} {fmtWeekday(l.date)} · added {new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(l.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        {groups.length > 0 && <Tabs items={groups.map(([n, rs]) => ({ label: `${n} ${rs.length}`, href: `/kitchen/sheet?${q}&region=${encodeURIComponent(n)}`, active: n === region?.[0] }))} />}
        <div className="flex-1" />
        <form action="/kitchen/sheet" className="flex items-center gap-2"><DateField name="date" defaultValue={dayInput(date)} compact /><button className="btn-secondary btn-sm">Go</button></form>
      </div>
      <Tiles cols={5}>
        <Tile label="Boxes" value={sheet.boxes} sub={fmtWeekday(date)} />
        <Tile label="Need customization" value={sheet.swapCount} sub={sheet.menu ? "from yesterday's menu" : 'no menu added'} tone="warn" />
        <Tile label="Alternative boxes" value={sheet.altBoxes} sub="blue rows on the sheet" tone="sky" />
        <Tile label="Add-on drink" value={sheet.buttermilk} sub="Mon, Wed, Fri" tone="leaf" />
        <Tile label="Entered by sales" value={`${sheet.entered} of ${sheet.rows.length + sheet.trials.length}`} sub="after 9 AM" tone="brand" />
      </Tiles>
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">{region?.[0] ?? 'No region'} · {list.length} customers</h2>
            <p className="text-[13px] text-muted">Same rows and order as the printed sheet</p>
          </div>
          {region && list.length > 1 && !sp.arrange && <Link href={`${self}&arrange=1`} scroll={false} className="btn-secondary btn-sm">Arrange order</Link>}
          {region && <a href={`/print/sheet?${q}&region=${encodeURIComponent(region[0])}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Print {region[0]}</a>}
        </div>
        {sp.arrange && list.length > 0 ? (
          <form action={saveSheetOrder} className="border-t border-line">
            <input type="hidden" name="back" value={self} />
            <p className="bg-brand-soft px-5 py-3 text-[13px]">Type the position of each customer in the order the boxes are delivered (1 = first stop), then save. The order stays for every day until you change it. New customers go to the end.</p>
            <table className="w-full">
              <thead><tr><th className="th w-28">Position</th><th className="th">Customer</th><th className="th">Address</th><th className="th">Time</th></tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.pkg.id}>
                    <td className="td"><input type="hidden" name="lead" value={r.lead.id} /><input type="number" min={1} max={999} name={`pos_${r.lead.id}`} defaultValue={i + 1} aria-label={`Position of ${r.lead.name}`} className="input w-20 px-2 py-1.5 text-center font-semibold" /></td>
                    <td className="td font-semibold">{r.lead.name}</td>
                    <td className="td max-w-80 truncate text-muted">{r.lead.address ?? '—'}</td>
                    <td className="td">{r.lead.deliveryTime ?? r.lead.slot ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2.5 px-5 py-4"><Link href={self} scroll={false} className="btn-secondary">Cancel</Link><button className="btn">Save order</button></div>
          </form>
        ) : list.length === 0 ? <Empty>No monthly boxes on this day.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Customer</th><th className="th">Time</th><th className="th">Drink</th><th className="th">Alt box no.</th><th className="th">Attendance</th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.pkg.id} className={r.altBox ? 'bg-sky-soft' : ''}>
                  <td className="td">{i + 1}</td>
                  <td className="td">
                    <Link href={`/customers/${r.lead.id}`} className="font-semibold hover:underline">{r.lead.name}</Link>
                    {r.swap?.swapTo && <span className="ml-1.5"><Chip label={`Customization: ${r.swap.swapTo}`} tone="warn" /></span>}
                    {r.isNew && <span className="ml-1.5"><Chip label="New" tone="leaf" /></span>}
                    {r.altBox && <span className="ml-1.5 text-[11px] font-bold text-sky">ALT BOX</span>}
                  </td>
                  <td className="td">{r.lead.deliveryTime ?? r.lead.slot ?? '—'}</td>
                  <td className="td">{r.bm ? <Chip label={`Drink ${r.bm}`} tone="leaf" /> : ''}</td>
                  <td className="td">{r.altBox ?? '—'}</td>
                  <td className="td">{r.attendance ? <StatusChip map={ATTENDANCE} value={r.attendance.status} /> : <Chip label="After 9 AM" tone="muted" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(onLeave.length > 0 || sheet.paused.length > 0) && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-4">
            <h2 className="font-display text-lg font-semibold">On leave · not packed · {onLeave.length + sheet.paused.length}</h2>
            <p className="text-[13px] text-muted">Not on the sheet for {fmtWeekday(date)}. The day is added to the end of their pack.</p>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Leave</th><th className="th"></th></tr></thead>
            <tbody>
              {onLeave.map((r) => (
                <tr key={r.pkg.id}>
                  <td className="td"><Link href={`/customers/${r.lead.id}`} className="font-semibold hover:underline">{r.lead.name}</Link></td>
                  <td className="td">{r.lead.region?.name ?? '—'}</td>
                  <td className="td"><Chip label="Absent this day" tone="warn" /></td>
                  <td className="td"><div className="flex justify-end">{date >= day(0) && <CancelLeave leadId={r.lead.id} date={dayInput(date)} back={self} />}</div></td>
                </tr>
              ))}
              {sheet.paused.map((l) => (
                <tr key={l.id}>
                  <td className="td"><Link href={`/customers/${l.id}`} className="font-semibold hover:underline">{l.name}</Link></td>
                  <td className="td">{l.region?.name ?? '—'}</td>
                  <td className="td"><Chip label={l.pausedUntil ? `Paused till ${fmtWeekday(l.pausedUntil)}` : 'Paused'} tone="muted" /></td>
                  <td className="td"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Callout tone="sky">Blue = alternative box today. Orange tag = fruit customization from the menu. Trial boxes and customers on leave are printed at the bottom of the sheet.</Callout>
      {sp.leave === '1' && <LeaveDrawer customers={running.map((r) => ({ id: r.pkg.lead.id, name: r.pkg.lead.name, phone: r.pkg.lead.phone, region: r.pkg.lead.region?.name ?? null }))} date={dayInput(date > day(0) ? date : tomorrow)} close={self} self={`${self}&leave=1`} />}
    </>
  )
}
