import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, nowHourIST, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion } from '@/lib/queries'
import { Callout, Chip, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { saveAttendanceAction } from '../actions'

type Row = {
  key: string
  leadId: string
  name: string
  time: string | null
  tags: [string, 'warn' | 'leaf' | 'sky' | 'brand'][]
  bm: number
  altBox: number | null
  status: string | null
  boxBack: boolean | null
  remarks: string | null
  buttermilk: boolean
  region: string | null
}

// After 11 AM, sales copies the kitchen manager's paper sheet into the dashboard. Compulsory every day.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const sheet = await daySheet(date)
  const rows: Row[] = [
    ...sheet.rows.map((r) => ({
      key: r.pkg.id,
      leadId: r.lead.id,
      name: r.lead.name,
      time: r.lead.deliveryTime ?? r.lead.slot,
      tags: [
        ...(r.isNew ? ([['NEW', 'leaf']] as Row['tags']) : []),
        ...(r.swap?.swapTo ? ([[`Swap: ${r.swap.swapTo}`, 'warn']] as Row['tags']) : []),
        [`Day ${r.dayNo ?? '-'}`, 'brand'],
      ] as Row['tags'],
      bm: r.bm,
      altBox: r.altBox,
      status: r.attendance?.status ?? (r.absent ? 'ABSENT' : null),
      boxBack: r.attendance?.boxBack ?? null,
      remarks: r.attendance?.remarks ?? null,
      buttermilk: r.attendance ? r.attendance.buttermilk : r.bm > 0,
      region: r.lead.region?.name ?? null,
    })),
    ...sheet.trials.map((t) => ({
      key: t.trial.id,
      leadId: t.trial.leadId,
      name: t.trial.lead.name,
      time: t.trial.lead.deliveryTime ?? t.trial.slot,
      tags: [['TRIAL', 'sky'] as Row['tags'][number], ...(t.swap?.swapTo ? ([[`Swap: ${t.swap.swapTo}`, 'warn']] as Row['tags']) : [])],
      bm: 0,
      altBox: null,
      status: t.attendance?.status ?? null,
      boxBack: t.attendance?.boxBack ?? null,
      remarks: t.attendance?.remarks ?? null,
      buttermilk: false,
      region: t.trial.lead.region?.name ?? null,
    })),
  ]
  const groups = groupByRegion(rows, (r) => r.region)
  const region = groups.find(([name]) => name === sp.region) ?? groups[0]
  const list = region?.[1] ?? []
  const entered = list.filter((r) => r.status).length
  const self = `/attendance?date=${dayInput(date)}${region ? `&region=${encodeURIComponent(region[0])}` : ''}`
  const delivered = list.filter((r) => r.status === 'DELIVERED').length
  const off = list.filter((r) => r.status === 'ABSENT').length
  const notDel = list.filter((r) => r.status === 'NOT_DELIVERED').length
  return (
    <>
      <PageHeader title="Enter today's attendance" crumb="Delivery attendance" sub={`After 11 AM, copy the kitchen manager's paper sheet into the dashboard. ${fmtWeekday(date)}`}>
        <form action="/attendance" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={dayInput(date)} className="input py-2" />
          <button className="btn-secondary btn-sm">Go</button>
        </form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.saved && <Callout>Saved {sp.saved} rows. End dates and the kitchen screens are updated.</Callout>}
      {date.getTime() === day(0).getTime() && nowHourIST() < 11 && !sp.saved && (
        <Callout tone="warn">Attendance is entered after 11 AM, once the kitchen manager has written it on the paper sheet.</Callout>
      )}
      {groups.length > 1 && <Tabs items={groups.map(([name, rs]) => ({ label: `${name} ${rs.length}`, href: `/attendance?date=${dayInput(date)}&region=${encodeURIComponent(name)}`, active: name === region?.[0] }))} />}
      <Tiles cols={5}>
        <Tile label="Customers" value={list.length} sub={`${region?.[0] ?? 'No'} region`} />
        <Tile label="Entered" value={`${entered} of ${list.length}`} sub={entered < list.length ? 'keep going' : 'all done'} tone="brand" />
        <Tile label="Delivered" value={delivered} tone="leaf" />
        <Tile label="Absent / Not delivered" value={`${off} / ${notDel}`} sub="pushes the end date" tone="warn" />
        <Tile label="Alternative boxes" value={list.filter((r) => r.altBox).length} sub="blue rows" tone="sky" />
      </Tiles>
      <Callout tone="sky">Blue rows got an alternative box. Write its number and whether the empty box came back. Attendance must be entered every day.</Callout>
      {list.length === 0 ? (
        <section className="card"><Empty>No deliveries on this day.</Empty></section>
      ) : (
        <form action={saveAttendanceAction} className="card overflow-x-auto">
          <input type="hidden" name="date" value={dayInput(date)} />
          <input type="hidden" name="back" value={self} />
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">{region?.[0]} · {list.length} customers</h2>
              <p className="text-[13px] text-muted">Tap one option per row. Rows left blank are not saved.</p>
            </div>
            <button className="btn">Save attendance</button>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Customer</th><th className="th">Time</th><th className="th">Attendance</th><th className="th">BM</th><th className="th">Alt box no.</th><th className="th">Empty box back</th><th className="th">Remarks</th><th className="th"></th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.key} className={r.altBox ? 'bg-sky-soft' : ''}>
                  <td className="td">{i + 1}<input type="hidden" name="lead" value={r.leadId} /></td>
                  <td className="td">
                    <Link href={`/customers/${r.leadId}`} className="font-semibold hover:underline">{r.name}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">{r.tags.map(([t, tone]) => <Chip key={t} label={t} tone={tone} />)}</div>
                  </td>
                  <td className="td">{r.time ?? '—'}</td>
                  <td className="td"><Pills name={`st_${r.leadId}`} value={r.status} options={[['DELIVERED', 'Delivered'], ['ABSENT', 'Absent'], ['NOT_DELIVERED', 'Not delivered']]} tones={{ DELIVERED: 'leaf', ABSENT: 'warn', NOT_DELIVERED: 'red' }} /></td>
                  <td className="td">{r.bm > 0 ? <label className="flex items-center gap-1.5 text-[13px] font-semibold"><input type="checkbox" name={`bm_${r.leadId}`} defaultChecked={r.buttermilk} className="size-4 accent-leaf" />{r.bm}</label> : ''}</td>
                  <td className="td"><input name={`alt_${r.leadId}`} type="number" min={1} max={100} defaultValue={r.altBox ?? ''} className="input w-16 px-2 py-1.5 text-center" aria-label="Alternative box number" /></td>
                  <td className="td"><Pills name={`back_${r.leadId}`} value={r.boxBack == null ? null : r.boxBack ? 'yes' : 'no'} options={[['yes', 'Yes'], ['no', 'No']]} tones={{ yes: 'leaf', no: 'red' }} /></td>
                  <td className="td"><input name={`rm_${r.leadId}`} defaultValue={r.remarks ?? ''} className="input min-w-32 px-2 py-1.5" aria-label="Remarks" /></td>
                  <td className="td">{r.status ? <Chip label="Entered" tone="leaf" /> : <Chip label="To enter" tone="warn" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end px-5 py-4"><button className="btn">Save attendance</button></div>
        </form>
      )}
    </>
  )
}
