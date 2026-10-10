import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, isSunday, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion } from '@/lib/queries'
import { Chip, Empty, PageHeader, Tabs, Tile, Tiles } from '@/components/ui'

// Today's boxes, region by region, with what goes in each (swap, buttermilk, alternative box).
export default async function KitchenBoxes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  const date = sp.date ? parseDay(sp.date) : day(0)
  const sheet = await daySheet(date)
  const going = sheet.rows.filter((r) => !r.absent)
  const regions = groupByRegion(going, (r) => r.lead.region?.name)
  return (
    <>
      <PageHeader title={date.getTime() === day(0).getTime() ? "Today's boxes" : `Boxes for ${fmtWeekday(date)}`} sub="Every box going out, by region and delivery time">
        <Tabs items={[{ label: 'Today', href: '/kitchen/boxes', active: date.getTime() === day(0).getTime() }, { label: fmtWeekday(tomorrow), href: `/kitchen/boxes?date=${dayInput(tomorrow)}`, active: date.getTime() === tomorrow.getTime() }]} />
      </PageHeader>
      <Tiles cols={5}>
        <Tile big label="Boxes" value={sheet.boxes} />
        <Tile big label="Monthly" value={sheet.monthly} tone="leaf" />
        <Tile big label="Trial" value={sheet.trials.length} tone="sky" />
        <Tile big label="Swaps" value={sheet.swapCount} tone="warn" />
        <Tile big label="Absent" value={sheet.rows.length - going.length} sub="not packed" tone="muted" />
      </Tiles>
      {sheet.trials.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Trial boxes · {sheet.trials.length}</h2></div>
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Slot</th><th className="th">Swap</th><th className="th">Notes</th></tr></thead>
            <tbody>
              {sheet.trials.map(({ trial, swap }) => (
                <tr key={trial.id}>
                  <td className="td font-semibold"><Link href={`/customers/${trial.leadId}`} className="hover:underline">{trial.lead.name}</Link></td>
                  <td className="td">{trial.lead.region?.name ?? '—'}</td>
                  <td className="td">{trial.slot ?? '—'}</td>
                  <td className="td">{swap?.swapTo ? <Chip label={`${swap.avoids.join(', ')} → ${swap.swapTo}`} tone="warn" /> : '—'}</td>
                  <td className="td text-muted">{[trial.lead.avoidFoods, trial.lead.healthNotes].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {regions.length === 0 && <section className="card"><Empty>No monthly boxes on this day.</Empty></section>}
      {regions.map(([name, rows]) => (
        <section key={name} className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">{name} · {rows.length}</h2></div>
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Customer</th><th className="th">Time</th><th className="th">Day</th><th className="th">Swap</th><th className="th">BM</th><th className="th">Alt box</th><th className="th">Address</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.pkg.id} className={r.altBox ? 'bg-sky-soft' : ''}>
                  <td className="td">{i + 1}</td>
                  <td className="td font-semibold"><Link href={`/customers/${r.lead.id}`} className="hover:underline">{r.lead.name}</Link>{r.isNew && <span className="ml-1.5"><Chip label="New" tone="leaf" /></span>}</td>
                  <td className="td">{r.lead.deliveryTime ?? r.lead.slot ?? '—'}</td>
                  <td className="td">{r.dayNo}/26</td>
                  <td className="td">{r.swap?.swapTo ? <Chip label={`${r.swap.avoids.join(', ')} → ${r.swap.swapTo}`} tone="warn" /> : '—'}</td>
                  <td className="td">{r.bm || '—'}</td>
                  <td className="td">{r.altBox ?? '—'}</td>
                  <td className="td max-w-64 truncate text-muted">{r.lead.address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}
