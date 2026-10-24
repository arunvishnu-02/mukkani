import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { Callout, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { DateField } from '@/components/DateField'
import { DayLock } from '@/components/DayLock'
import { saveStaffDay } from '../../ops-actions'
import type { StaffDay } from '@/generated/prisma/client'
import { StaffTable, type StaffInit } from '@/components/StaffRows'

// Daily check of kitchen staff and delivery persons: ID card, uniform or dress code, in and out time,
// on-time pick-up, and the bike's starting and ending km. Kitchen manager only.
export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const [staff, days, month] = await Promise.all([
    db.staff.findMany({ where: { active: true, kind: { in: ['KITCHEN', 'DELIVERY'] } }, orderBy: [{ kind: 'desc' }, { name: 'asc' }] }),
    db.staffDay.findMany({ where: { date } }),
    db.staffDay.findMany({ where: { date: { gte: monthStart, lte: date }, startKm: { not: null }, endKm: { not: null } }, select: { staffId: true, startKm: true, endKm: true } }),
  ])
  const of = new Map<string, StaffDay>(days.map((d) => [d.staffId, d]))
  const kitchen = staff.filter((s) => s.kind === 'KITCHEN')
  const delivery = staff.filter((s) => s.kind === 'DELIVERY')
  const km = (d?: { startKm: number | null; endKm: number | null }) => (d?.startKm != null && d.endKm != null ? d.endKm - d.startKm : null)
  const kmToday = delivery.reduce((a, s) => a + (km(of.get(s.id)) ?? 0), 0)
  const kmMonth = month.reduce((a, d) => a + (d.endKm! - d.startKm!), 0)
  const present = staff.filter((s) => of.get(s.id)?.attendance === 'PRESENT').length
  const absent = staff.filter((s) => of.get(s.id)?.attendance === 'ABSENT').length
  const flags = days.filter((d) => d.attendance !== 'ABSENT' && (d.idCard === 'NO' || d.uniform === 'NO' || d.onTimePickup === false)).length
  const init = (list: typeof staff): StaffInit[] => list.map((x) => { const d = of.get(x.id); return { id: x.id, name: x.name, shift2: x.shift2, d: d ? { attendance: d.attendance, idCard: d.idCard, uniform: d.uniform, onTimePickup: d.onTimePickup, inTime: d.inTime, outTime: d.outTime, inTime2: d.inTime2, outTime2: d.outTime2, startKm: d.startKm, endKm: d.endKm, remarks: d.remarks } : null } })
  const self = `/kitchen/staff?date=${dayInput(date)}`
  return (
    <>
      <PageHeader title="Staff tracking" sub={`Daily check of kitchen staff and delivery persons · ${fmtWeekday(date)}`}>
        {user.role === 'ADMIN' && <Link href="/admin/staff" className="btn-secondary btn-sm">Staff list and month</Link>}
        <form action="/kitchen/staff" className="flex items-center gap-2"><DateField name="date" defaultValue={dayInput(date)} max={dayInput(day(0))} compact /><button className="btn-secondary btn-sm">Go</button></form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <DayLock user={user} date={date} area="Staff tracking" back={self} />
      {sp.saved && <Callout>Saved for {fmtWeekday(date)}.</Callout>}
      <Tiles cols={5}>
        <Tile label="Present" value={`${present} of ${staff.length}`} sub={absent ? `${absent} absent` : 'nobody absent'} tone="leaf" />
        <Tile label="Marked No" value={flags} sub="ID card, uniform or pick-up" tone={flags ? 'red' : 'muted'} />
        <Tile label="Delivery km today" value={`${kmToday} km`} sub="ending minus starting" tone="sky" />
        <Tile label="Delivery km this month" value={`${kmMonth} km`} sub={`1st to ${fmtWeekday(date)}`} tone="brand" />
      </Tiles>
      {staff.length === 0 ? (
        <section className="card"><Empty>No staff on the list yet. Ask admin to add the kitchen staff and delivery persons (Admin › Staff attendance).</Empty></section>
      ) : (
        <form action={saveStaffDay} className="space-y-[18px]">
          <input type="hidden" name="date" value={dayInput(date)} />
          <input type="hidden" name="back" value={self} />
          {kitchen.length > 0 && (
            <section className="card overflow-x-auto">
              <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Kitchen staff · {kitchen.length}</h2><p className="text-[13px] text-muted">Choose Present or Absent for each person. For those present, fill everything: ID card, uniform, and in and out time of both shifts.</p></div>
              <StaffTable kind="KITCHEN" rows={init(kitchen)} />
            </section>
          )}
          {delivery.length > 0 && (
            <section className="card overflow-x-auto">
              <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Delivery persons · {delivery.length}</h2><p className="text-[13px] text-muted">Choose Present or Absent for each person. For those present, fill everything. In time is due by 5:30. The total km shows as soon as both km are entered.</p></div>
              <StaffTable kind="DELIVERY" rows={init(delivery)} />
            </section>
          )}
          <div className="flex justify-end"><button className="btn">Save {fmtWeekday(date)}</button></div>
        </form>
      )}
    </>
  )
}
