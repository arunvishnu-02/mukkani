import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { Callout, Drawer, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { DateField } from '@/components/DateField'
import { saveStaff, saveStaffDay, setStaffActive } from '../../ops-actions'
import type { StaffDay } from '@/generated/prisma/client'

const yn = (v: boolean | null | undefined) => (v == null ? '' : v ? 'yes' : 'no')

function YesNo({ name, value }: { name: string; value: boolean | null | undefined }) {
  return (
    <select name={name} defaultValue={yn(value)} aria-label={name.split('_')[0]} style={{ width: 76, minWidth: 76 }} className={`input px-2 py-1.5 text-[13px] ${value === false ? 'border-red text-red' : ''}`}>
      <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
    </select>
  )
}
const Time = ({ name, value }: { name: string; value: string | null | undefined }) => <input type="time" name={name} defaultValue={value ?? ''} aria-label={name.split('_')[0]} style={{ width: 112, minWidth: 112 }} className="input px-2 py-1.5 text-[13px]" />

// Daily check of kitchen staff and delivery persons: ID card, uniform or dress code, in and out time,
// on-time pick-up, and the bike's starting and ending km. Kitchen manager only.
export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
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
  const present = staff.filter((s) => of.get(s.id)?.inTime).length
  const flags = days.filter((d) => d.idCard === false || d.uniform === false || d.onTimePickup === false).length
  const self = `/kitchen/staff?date=${dayInput(date)}`
  const edit = sp.edit ? staff.find((s) => s.id === sp.edit) : null
  return (
    <>
      <PageHeader title="Staff tracking" sub={`Daily check of kitchen staff and delivery persons · ${fmtWeekday(date)}`}>
        <Link href={`${self}&team=1`} scroll={false} className="btn-secondary btn-sm">Add or remove staff</Link>
        <form action="/kitchen/staff" className="flex items-center gap-2"><DateField name="date" defaultValue={dayInput(date)} max={dayInput(day(0))} compact /><button className="btn-secondary btn-sm">Go</button></form>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.saved && <Callout>Saved for {fmtWeekday(date)}.</Callout>}
      <Tiles cols={4}>
        <Tile label="Came in" value={`${present} of ${staff.length}`} sub="in time entered" tone="leaf" />
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
              <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Kitchen staff · {kitchen.length}</h2><p className="text-[13px] text-muted">ID card, uniform, in time and out time</p></div>
              <table className="w-full">
                <thead><tr><th className="th">Name</th><th className="th">ID card</th><th className="th">Uniform</th><th className="th">In time</th><th className="th">Out time</th><th className="th">Remarks</th></tr></thead>
                <tbody>
                  {kitchen.map((s) => {
                    const d = of.get(s.id)
                    return (
                      <tr key={s.id}>
                        <td className="td font-semibold whitespace-nowrap"><input type="hidden" name="staff" value={s.id} />{s.name}</td>
                        <td className="td"><YesNo name={`idCard_${s.id}`} value={d?.idCard} /></td>
                        <td className="td"><YesNo name={`uniform_${s.id}`} value={d?.uniform} /></td>
                        <td className="td"><Time name={`in_${s.id}`} value={d?.inTime} /></td>
                        <td className="td"><Time name={`out_${s.id}`} value={d?.outTime} /></td>
                        <td className="td"><input name={`remarks_${s.id}`} defaultValue={d?.remarks ?? ''} aria-label="Remarks" className="input min-w-40 px-2 py-1.5 text-[13px]" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}
          {delivery.length > 0 && (
            <section className="card overflow-x-auto">
              <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Delivery persons · {delivery.length}</h2><p className="text-[13px] text-muted">Dress code, on-time pick-up, in and out time, and the bike km. Total km is ending minus starting.</p></div>
              <table className="w-full">
                <thead><tr><th className="th">Name</th><th className="th">ID card</th><th className="th">Dress code</th><th className="th">On-time pick-up</th><th className="th">In time</th><th className="th">Out time</th><th className="th">Starting km</th><th className="th">Ending km</th><th className="th">Total km</th><th className="th">Remarks</th></tr></thead>
                <tbody>
                  {delivery.map((s) => {
                    const d = of.get(s.id)
                    return (
                      <tr key={s.id}>
                        <td className="td font-semibold whitespace-nowrap"><input type="hidden" name="staff" value={s.id} />{s.name}</td>
                        <td className="td"><YesNo name={`idCard_${s.id}`} value={d?.idCard} /></td>
                        <td className="td"><YesNo name={`uniform_${s.id}`} value={d?.uniform} /></td>
                        <td className="td"><YesNo name={`pickup_${s.id}`} value={d?.onTimePickup} /></td>
                        <td className="td"><Time name={`in_${s.id}`} value={d?.inTime} /></td>
                        <td className="td"><Time name={`out_${s.id}`} value={d?.outTime} /></td>
                        <td className="td"><input type="number" min={0} name={`startKm_${s.id}`} defaultValue={d?.startKm ?? ''} aria-label="Starting km" className="input w-[92px] px-2 py-1.5 text-[13px]" /></td>
                        <td className="td"><input type="number" min={0} name={`endKm_${s.id}`} defaultValue={d?.endKm ?? ''} aria-label="Ending km" className="input w-[92px] px-2 py-1.5 text-[13px]" /></td>
                        <td className="td font-semibold whitespace-nowrap">{km(d) != null ? `${km(d)} km` : '—'}</td>
                        <td className="td"><input name={`remarks_${s.id}`} defaultValue={d?.remarks ?? ''} aria-label="Remarks" className="input min-w-32 px-2 py-1.5 text-[13px]" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
