import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, dayInput, fmtWeekday, isSunday, nowHourIST, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion, runningPackages } from '@/lib/queries'
import { Callout, Chip, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { AttendanceList } from '@/components/AttendanceList'
import { DayLock } from '@/components/DayLock'
import { dayOpen } from '@/lib/lock'
import { DateField } from '@/components/DateField'
import { LeaveDrawer } from '@/components/Leave'
import { SheetOrder } from '@/components/SheetOrder'

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
  boxes: number | null
}

// After 9 AM, sales copies the kitchen manager's paper sheet into the dashboard. Compulsory every day.
export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['SALES'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const open = await dayOpen(user, date)
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
        [r.pkg.boxesPerDay > 1 ? `${r.pkg.boxesPerDay} boxes a day · box ${r.dayNo ?? '-'} of 26` : `Day ${r.dayNo ?? '-'}`, 'brand'],
      ] as Row['tags'],
      bm: r.bm,
      altBox: r.altBox,
      status: r.attendance?.status ?? (r.absent ? 'ABSENT' : null),
      boxBack: r.attendance?.boxBack ?? null,
      remarks: r.attendance?.remarks ?? null,
      boxes: r.attendance?.boxes ?? r.pkg.boxesPerDay,
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
      boxes: null,
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
  // The whole day across every region, so the overall picture is at the top.
  const count = (rs: Row[]) => ({
    total: rs.length,
    entered: rs.filter((r) => r.status).length,
    delivered: rs.filter((r) => r.status === 'DELIVERED').length,
    absent: rs.filter((r) => r.status === 'ABSENT').length,
    notDel: rs.filter((r) => r.status === 'NOT_DELIVERED').length,
    boxes: rs.filter((r) => r.status === 'DELIVERED').reduce((n, r) => n + (r.boxes ?? 1), 0),
  })
  const overall = count(rows)
  const byRegion = groups.map(([name, rs]) => ({ name, ...count(rs) }))
  return (
    <>
      <PageHeader title="Enter today's attendance" crumb="Delivery attendance" sub={`After 9 AM, copy the kitchen manager's paper sheet into the dashboard. ${fmtWeekday(date)}`}>
        <Link href={`${self}&leave=1`} scroll={false} className="btn-secondary btn-sm">Mark leave</Link>
        <a href={`/print/sheet?date=${dayInput(date)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Print sheet</a>
        <a href={`/print/sheet?date=${dayInput(date)}&filled=1`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Print entered attendance</a>
        <form action="/attendance" className="flex items-center gap-2">
          <DateField name="date" defaultValue={dayInput(date)} compact />
          <button className="btn-secondary btn-sm">Go</button>
        </form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <DayLock user={user} date={date} area="Delivery attendance" back={self} />
      {sheet.holiday && <Callout tone="warn">Office holiday: {sheet.holiday.name}. No monthly boxes go out today.</Callout>}
      {sp.leave && sp.leave !== '1' && <Callout>{sp.leave}</Callout>}
      {sp.leave === '1' && <LeaveDrawer customers={running.map((r) => ({ id: r.pkg.lead.id, name: r.pkg.lead.name, phone: r.pkg.lead.phone, region: r.pkg.lead.region?.name ?? null }))} date={dayInput(date > day(0) ? date : isSunday(day(1)) ? day(2) : day(1))} close={self} self={`${self}&leave=1`} />}
      {date > day(0) && <Callout tone="warn">{fmtWeekday(date)} is a later day. Enter only a customer's last box ahead (day 26), so their monthly report is ready today. Everyone else is entered on the day.</Callout>}
      {date.getTime() === day(0).getTime() && nowHourIST() < 9 && !sp.saved && (
        <Callout tone="warn">Attendance is entered after 9 AM, once the kitchen manager has written it on the paper sheet.</Callout>
      )}
      {rows.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="flex flex-wrap items-baseline gap-x-3 px-5 pt-4 pb-2">
            <h2 className="font-display text-lg font-semibold">{date.getTime() === day(0).getTime() ? 'Today' : fmtWeekday(date)} · all regions</h2>
            <span className="text-[13px] text-muted">{overall.entered === overall.total ? 'All entered' : `${overall.total - overall.entered} still to enter`}</span>
          </div>
          <table className="w-full" data-no-tools>
            <thead><tr><th className="th">Region</th><th className="th text-right">Customers</th><th className="th text-right">Entered</th><th className="th text-right">Delivered</th><th className="th text-right">Boxes out</th><th className="th text-right">Absent</th><th className="th text-right">Not delivered</th></tr></thead>
            <tbody>
              {byRegion.map((g) => (
                <tr key={g.name} className={g.name === region?.[0] ? 'bg-brand-soft/60' : ''}>
                  <td className="td"><Link href={`/attendance?date=${dayInput(date)}&region=${encodeURIComponent(g.name)}`} className="font-semibold hover:underline">{g.name}</Link></td>
                  <td className="td text-right">{g.total}</td>
                  <td className={`td text-right font-semibold ${g.entered < g.total ? 'text-warn' : 'text-leaf'}`}>{g.entered} of {g.total}</td>
                  <td className="td text-right text-leaf">{g.delivered}</td>
                  <td className="td text-right">{g.boxes}</td>
                  <td className="td text-right text-warn">{g.absent}</td>
                  <td className="td text-right text-red">{g.notDel}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line font-bold">
                <td className="td">Total</td>
                <td className="td text-right">{overall.total}</td>
                <td className={`td text-right ${overall.entered < overall.total ? 'text-warn' : 'text-leaf'}`}>{overall.entered} of {overall.total}</td>
                <td className="td text-right text-leaf">{overall.delivered}</td>
                <td className="td text-right">{overall.boxes}</td>
                <td className="td text-right text-warn">{overall.absent}</td>
                <td className="td text-right text-red">{overall.notDel}</td>
              </tr>
            </tbody>
          </table>
        </section>
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
      {sp.ordered && <Callout>Order saved for {region?.[0]}. The attendance list, the kitchen sheet and the printed sheet follow it from now on.</Callout>}
      {region && sheet.rows.some((r) => !r.absent && (r.lead.region?.name ?? 'No region') === region[0]) && (
        sp.arrange ? (
          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <h2 className="flex-1 font-display text-lg font-semibold">Arrange order · {region[0]}</h2>
              <Link href={self} scroll={false} className="btn-secondary btn-sm">Cancel</Link>
            </div>
            <SheetOrder rows={sheet.rows.filter((r) => !r.absent && (r.lead.region?.name ?? 'No region') === region[0]).map((r) => ({ id: r.lead.id, name: r.lead.name, address: r.lead.address, time: r.lead.deliveryTime ?? r.lead.slot }))} back={self} region={region[0]} />
          </section>
        ) : (
          <div className="flex justify-end"><Link href={`${self}&arrange=1`} scroll={false} className="btn-secondary btn-sm">Arrange order of {region[0]}</Link></div>
        )
      )}
      {sp.arrange ? null : list.length === 0 ? (
        <section className="card"><Empty>No deliveries on this day.</Empty></section>
      ) : (
        !open ? <section className="card"><Empty>This past day is locked, so its attendance cannot be changed here. You can still see it in All reports &rsaquo; Delivery attendance.</Empty></section> : <AttendanceList key={`${dayInput(date)}-${region?.[0]}`} date={dayInput(date)} region={region?.[0] ?? 'No region'} rows={list} future={date > day(0)} />
      )}
    </>
  )
}
