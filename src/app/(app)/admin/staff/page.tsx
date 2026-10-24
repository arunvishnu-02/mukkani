import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, keyOf } from '@/lib/dates'
import { holidaySet } from '@/lib/queries'
import { KITCHEN_FIRST_FROM } from '@/lib/dayclose'
import { Callout, Card, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { saveOfficeAttendance, saveStaff, setStaffActive } from '../../ops-actions'
import { OfficeTable, type OfficeInit } from '@/components/OfficeRows'
import { DateField } from '@/components/DateField'
import { parseDay, fmtWeekday } from '@/lib/dates'

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Admin's own staff attendance: who is on the list (add and remove), and a month of present / absent for each person.
// The kitchen manager fills the day; only admin changes the list.
export default async function AdminStaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const today = day(0)
  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : keyOf(today).slice(0, 7)).split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const entryDay = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? '') ? parseDay(sp.d!) : today
  const [staff, removed, days, hol] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: [{ kind: 'desc' }, { name: 'asc' }] }),
    db.staff.findMany({ where: { active: false }, orderBy: { name: 'asc' } }),
    db.staffDay.findMany({ where: { date: { gte: first, lte: last } } }),
    holidaySet(),
  ])
  const office = staff.filter((s) => s.kind === 'OFFICE')
  const officeInit: OfficeInit[] = office.map((s) => { const r = days.find((d) => d.staffId === s.id && keyOf(d.date) === keyOf(entryDay)); return { id: s.id, name: s.name, d: r ? { attendance: r.attendance, inTime: r.inTime, outTime: r.outTime, remarks: r.remarks } : null } })
  const dates: Date[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) dates.push(d)
  const of = new Map(days.map((d) => [`${d.staffId}|${keyOf(d.date)}`, d]))
  const off = (d: Date) => d.getUTCDay() === 0 || hol.has(keyOf(d))
  // Daily staff entry is compulsory from 24 Oct; earlier days are not counted as missing.
  const worked = dates.filter((d) => !off(d) && d <= today && d >= KITCHEN_FIRST_FROM)
  const prev = keyOf(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7)
  const next = keyOf(new Date(Date.UTC(y, m, 1))).slice(0, 7)
  const self = `/admin/staff?m=${keyOf(first).slice(0, 7)}`
  const edit = sp.edit ? staff.find((s) => s.id === sp.edit) : null
  const km = (id: string) => days.filter((d) => d.staffId === id && d.startKm != null && d.endKm != null).reduce((a, d) => a + (d.endKm! - d.startKm!), 0)
  const rows = staff.map((s) => {
    const mine = days.filter((d) => d.staffId === s.id)
    return { s, present: mine.filter((d) => d.attendance !== 'ABSENT').length, absent: mine.filter((d) => d.attendance === 'ABSENT').length, missing: worked.filter((d) => !of.has(`${s.id}|${keyOf(d)}`)).length, no: mine.filter((d) => d.attendance !== 'ABSENT' && (d.idCard === 'NO' || d.uniform === 'NO' || d.onTimePickup === false)).length }
  })
  const totals = rows.reduce((a, r) => ({ present: a.present + r.present, absent: a.absent + r.absent, missing: a.missing + r.missing }), { present: 0, absent: 0, missing: 0 })
  return (
    <>
      <PageHeader title="Staff attendance" crumb="Business" sub={`${MONTH.format(first)} · who came, who was absent, and the people on the list`}>
        <div className="flex gap-2">
          <Link href={`/admin/staff?m=${prev}`} className="btn-secondary btn-sm">Previous</Link>
          <Link href="/admin/staff" className="btn-secondary btn-sm">This month</Link>
          <Link href={`/admin/staff?m=${next}`} className="btn-secondary btn-sm">Next</Link>
        </div>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="People on the list" value={staff.length} sub={`${staff.filter((s) => s.kind === 'KITCHEN').length} kitchen · ${staff.filter((s) => s.kind === 'DELIVERY').length} delivery · ${office.length} office`} />
        <Tile label="Present days" value={totals.present} sub="this month" tone="leaf" />
        <Tile label="Absent days" value={totals.absent} sub="this month" tone="warn" />
        <Tile label="Not entered" value={totals.missing} sub="working days with no entry" tone={totals.missing ? 'red' : 'muted'} />
      </Tiles>
      <section id="office" className="card overflow-x-auto scroll-mt-4">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Office staff · {fmtWeekday(entryDay)}</h2>
            <p className="text-[13px] text-muted">Your own team. You enter their attendance here; the kitchen manager does not see them. Choose Present or Absent for each person; for those present fill the in and out time.</p>
          </div>
          <form action="/admin/staff" className="flex items-center gap-2"><input type="hidden" name="m" value={keyOf(first).slice(0, 7)} /><DateField name="d" defaultValue={dayInput(entryDay)} max={dayInput(today)} compact /><button className="btn-secondary btn-sm">Go</button></form>
        </div>
        {sp.saved && <div className="mx-5 mb-3 rounded-[10px] bg-leaf-soft px-4 py-2.5 text-[13px] font-medium text-leaf">Saved for {fmtWeekday(entryDay)}.</div>}
        {office.length === 0 ? <Empty>No office staff yet. Add a person below and choose &quot;Office staff&quot; in Work.</Empty> : (
          <form action={saveOfficeAttendance}>
            <input type="hidden" name="date" value={dayInput(entryDay)} /><input type="hidden" name="back" value={`${self}&d=${dayInput(entryDay)}`} />
            <OfficeTable rows={officeInit} />
            <div className="flex justify-end px-5 py-4"><button className="btn">Save {fmtWeekday(entryDay)}</button></div>
          </form>
        )}
      </section>
      <section className="card overflow-x-auto">
        <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">{MONTH.format(first)}</h2><p className="text-[13px] text-muted"><b className="text-leaf">P</b> present · <b className="text-warn">A</b> absent · <b className="text-red">·</b> not entered · grey = Sunday or holiday. Tap a day to open it.</p></div>
        {staff.length === 0 ? <Empty>No staff on the list. Add people below.</Empty> : (
          <table className="w-full text-center text-[12px]" data-no-tools>
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                {dates.map((d) => <th key={keyOf(d)} className={`px-1 py-2 text-[11px] font-semibold ${off(d) ? 'bg-s2 text-muted' : ''}`}>{d.getUTCDate()}</th>)}
                <th className="th">Present</th><th className="th">Absent</th><th className="th">Not entered</th><th className="th">Km</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, present, absent, missing }) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="td text-left font-semibold whitespace-nowrap">{s.name}<div className="text-[11px] font-normal text-muted">{s.kind === 'DELIVERY' ? 'Delivery' : s.kind === 'OFFICE' ? 'Office' : 'Kitchen'}</div></td>
                  {dates.map((d) => {
                    const r = of.get(`${s.id}|${keyOf(d)}`)
                    const a = r?.attendance
                    const label = off(d) && !r ? '' : a === 'ABSENT' ? 'A' : r ? 'P' : d <= today && d >= KITCHEN_FIRST_FROM ? '·' : ''
                    const cls = a === 'ABSENT' ? 'bg-tur-soft font-bold text-warn' : r ? 'bg-leaf-soft font-bold text-leaf' : off(d) ? 'bg-s2' : d <= today && d >= KITCHEN_FIRST_FROM ? 'font-bold text-red' : ''
                    return <td key={keyOf(d)} className={`p-0 ${cls}`}><Link href={s.kind === 'OFFICE' ? `/admin/staff?m=${keyOf(first).slice(0, 7)}&d=${keyOf(d)}` : `/kitchen/staff?date=${keyOf(d)}`} className="block px-1 py-2" title={keyOf(d)}>{label}</Link></td>
                  })}
                  <td className="td font-semibold text-leaf">{present}</td><td className="td font-semibold text-warn">{absent || '–'}</td><td className={`td font-semibold ${missing ? 'text-red' : 'text-muted'}`}>{missing || '–'}</td><td className="td">{s.kind === 'DELIVERY' ? `${km(s.id)} km` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[360px_1fr]">
        <Card title={edit ? `Edit ${edit.name}` : 'Add a person'} sub="Only admin adds or removes people for staff attendance">
          <form action={saveStaff} className="space-y-3.5">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <input type="hidden" name="back" value={self} />
            <div><label className="label" htmlFor="staff-name">Name *</label><input id="staff-name" name="name" required className="input" defaultValue={edit?.name} placeholder="Name" /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label" htmlFor="staff-kind">Work</label><select id="staff-kind" name="kind" className="input" defaultValue={edit?.kind ?? 'KITCHEN'}><option value="KITCHEN">Kitchen staff</option><option value="DELIVERY">Delivery person</option><option value="OFFICE">Office staff (admin's team)</option></select></div>
              <div><label className="label" htmlFor="staff-phone">Phone *</label><input id="staff-phone" name="phone" required inputMode="tel" className="input" defaultValue={edit?.phone ?? ''} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="shift2" defaultChecked={edit?.shift2} className="size-4 accent-brand" /> Works the second shift too (11 AM to 2 PM). Kitchen staff only.</label>
            <div className="grid grid-cols-2 gap-2.5">
              {edit ? <Link href={self} className="btn-secondary">Cancel</Link> : <span />}
              <button className="btn">{edit ? 'Save changes' : 'Add to the list'}</button>
            </div>
          </form>
        </Card>
        <Card title="The list" sub="Removing a person keeps their old records">
          <div className="space-y-1.5">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-[10px] bg-s2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="font-semibold">{s.name}</span> <span className="text-xs text-muted">· {s.kind === 'DELIVERY' ? 'Delivery' : s.kind === 'OFFICE' ? 'Office' : 'Kitchen'}{s.shift2 ? ' · shift 2' : ''}{s.phone ? ` · ${s.phone}` : ''}</span></span>
                <Link href={`${self}&edit=${s.id}`} scroll={false} className="text-xs font-semibold text-brand">Edit</Link>
                <form action={setStaffActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={self} /><button name="active" value="no" className="text-xs font-semibold text-red">Remove</button></form>
              </div>
            ))}
            {removed.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-[10px] border border-dashed border-line px-3 py-2 text-sm text-muted">
                <span className="flex-1">{s.name} · removed</span>
                <form action={setStaffActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={self} /><button name="active" value="yes" className="text-xs font-semibold text-brand">Add back</button></form>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Callout tone="sky">The kitchen manager fills each day in Staff tracking and cannot add or remove people. Remove someone who left; their old days stay in the table above.</Callout>
    </>
  )
}
