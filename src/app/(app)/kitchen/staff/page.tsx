import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { Callout, Drawer, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { DateField } from '@/components/DateField'
import { DayLock } from '@/components/DayLock'
import { saveStaff, saveStaffDay, setStaffActive } from '../../ops-actions'
import type { StaffDay } from '@/generated/prisma/client'
import { StaffTable, type StaffInit } from '@/components/StaffRows'

// Daily check of kitchen staff and delivery persons: ID card, uniform or dress code, in and out time,
// on-time pick-up, and the bike's starting and ending km. Kitchen manager only.
export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['KITCHEN'])
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const [staff, days, month, left] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: [{ kind: 'desc' }, { name: 'asc' }] }),
    db.staffDay.findMany({ where: { date } }),
    db.staffDay.findMany({ where: { date: { gte: monthStart, lte: date }, startKm: { not: null }, endKm: { not: null } }, select: { staffId: true, startKm: true, endKm: true } }),
    sp.team ? db.staff.findMany({ where: { active: false }, orderBy: { name: 'asc' } }) : [],
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
  const init = (list: typeof staff): StaffInit[] => list.map((x) => { const d = of.get(x.id); return { id: x.id, name: x.name, d: d ? { attendance: d.attendance, idCard: d.idCard, uniform: d.uniform, onTimePickup: d.onTimePickup, inTime: d.inTime, outTime: d.outTime, inTime2: d.inTime2, outTime2: d.outTime2, startKm: d.startKm, endKm: d.endKm, remarks: d.remarks } : null } })
  const self = `/kitchen/staff?date=${dayInput(date)}`
  const edit = sp.edit ? staff.find((s) => s.id === sp.edit) : null
  return (
    <>
      <PageHeader title="Staff tracking" sub={`Daily check of kitchen staff and delivery persons · ${fmtWeekday(date)}`}>
        <Link href={`${self}&team=1`} scroll={false} className="btn-secondary btn-sm">Add or remove staff</Link>
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
        <section className="card"><Empty>No staff added yet. Tap &quot;Add or remove staff&quot; to add your kitchen staff and delivery persons.</Empty></section>
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
      {sp.team && (
        <Drawer title="Staff list" sub="The people you check every day" close={self}>
          <form action={saveStaff} className="space-y-3.5">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <input type="hidden" name="back" value={`${self}&team=1`} />
            <div><label className="label" htmlFor="staff-name">{edit ? 'Name' : 'Add a person'} *</label><input id="staff-name" name="name" required className="input" defaultValue={edit?.name} placeholder="Name" /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label" htmlFor="staff-kind">Work</label><select id="staff-kind" name="kind" className="input" defaultValue={edit?.kind ?? 'KITCHEN'}><option value="KITCHEN">Kitchen staff</option><option value="DELIVERY">Delivery person</option></select></div>
              <div><label className="label" htmlFor="staff-phone">Phone *</label><input id="staff-phone" name="phone" required inputMode="tel" className="input" defaultValue={edit?.phone ?? ''} /></div>
            </div>
            <button className="btn w-full">{edit ? 'Save changes' : 'Add to the list'}</button>
          </form>
          <div className="mt-5 space-y-1.5">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-[10px] bg-s2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="font-semibold">{s.name}</span> <span className="text-xs text-muted">· {s.kind === 'DELIVERY' ? 'Delivery' : 'Kitchen'}{s.phone ? ` · ${s.phone}` : ''}</span></span>
                <Link href={`${self}&team=1&edit=${s.id}`} scroll={false} className="text-xs font-semibold text-brand">Edit</Link>
                <form action={setStaffActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={`${self}&team=1`} /><button name="active" value="no" className="text-xs font-semibold text-red">Remove</button></form>
              </div>
            ))}
            {left.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-[10px] border border-dashed border-line px-3 py-2 text-sm text-muted">
                <span className="flex-1">{s.name} · removed</span>
                <form action={setStaffActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={`${self}&team=1`} /><button name="active" value="yes" className="text-xs font-semibold text-brand">Add back</button></form>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Removing a person keeps their old records.</p>
        </Drawer>
      )}
    </>
  )
}
