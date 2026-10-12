import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, isSunday, nowHourIST, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion, runningPackages } from '@/lib/queries'
import { Callout, Chip, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { AttendanceList } from '@/components/AttendanceList'
import { DateField } from '@/components/DateField'
import { LeaveDrawer } from '@/components/Leave'

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

// After 9 AM, sales copies the kitchen manager's paper sheet into the dashboard. Compulsory every day.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const [sheet, running] = await Promise.all([daySheet(date), runningPackages(day(0))])
  const rows: Row[] = [
    ...sheet.rows.map((r) => ({
      key: r.pkg.id,
      leadId: r.lead.id,
      name: r.lead.name,
      time: r.lead.deliveryTime ?? r.lead.slot,
      tags: [
        ...(r.isNew ? ([['NEW', 'leaf']] as Row['tags']) : []),
        ...(r.swap?.swapTo ? ([[`Customization: ${r.swap.swapTo}`, 'warn']] as Row['tags']) : []),
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
      tags: [['TRIAL', 'sky'] as Row['tags'][number], ...(t.swap?.swapTo ? ([[`Customization: ${t.swap.swapTo}`, 'warn']] as Row['tags']) : [])],
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
      <PageHeader title="Enter today's attendance" crumb="Delivery attendance" sub={`After 9 AM, copy the kitchen manager's paper sheet into the dashboard. ${fmtWeekday(date)}`}>
        <Link href={`${self}&leave=1`} scroll={false} className="btn-secondary btn-sm">Mark leave</Link>
        <form action="/attendance" className="flex items-center gap-2">
          <DateField name="date" defaultValue={dayInput(date)} compact />
          <button className="btn-secondary btn-sm">Go</button>
        </form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.leave && sp.leave !== '1' && <Callout>{sp.leave}</Callout>}
      {sp.leave === '1' && <LeaveDrawer customers={running.map((r) => ({ id: r.pkg.lead.id, name: r.pkg.lead.name, phone: r.pkg.lead.phone, region: r.pkg.lead.region?.name ?? null }))} date={dayInput(date > day(0) ? date : isSunday(day(1)) ? day(2) : day(1))} close={self} self={`${self}&leave=1`} />}
      {date.getTime() === day(0).getTime() && nowHourIST() < 9 && !sp.saved && (
        <Callout tone="warn">Attendance is entered after 9 AM, once the kitchen manager has written it on the paper sheet.</Callout>
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
        <AttendanceList key={`${dayInput(date)}-${region?.[0]}`} date={dayInput(date)} region={region?.[0] ?? 'No region'} rows={list} />
      )}
    </>
  )
}
