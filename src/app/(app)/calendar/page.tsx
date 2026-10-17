import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, fmtWeekday, keyOf } from '@/lib/dates'
import { runningPackages } from '@/lib/queries'
import { Card, PageHeader } from '@/components/ui'
import { DateField } from '@/components/DateField'
import { addHoliday, removeHoliday } from '../ops-actions'

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Month view for every role: boxes each day, trials, packages ending, menus added and birthdays.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const today = day(0)
  const [y, m] = (sp.m ?? keyOf(today).slice(0, 7)).split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const last = new Date(Date.UTC(y, m, 0))
  const gridStart = addDays(first, -((first.getUTCDay() + 6) % 7))
  const canSet = user.role !== 'KITCHEN'
  const [running, trials, menus, dobs, holidays] = await Promise.all([
    runningPackages(today),
    db.trialBox.findMany({ where: { deliveryDate: { gte: first, lte: last } }, select: { deliveryDate: true } }),
    db.menu.findMany({ where: { date: { gte: first, lte: last } }, select: { date: true } }),
    db.lead.findMany({ where: { dob: { not: null }, status: { not: 'NOT_INTERESTED' } }, select: { dob: true } }),
    db.holiday.findMany({ where: { date: { gte: addDays(first, -7) } }, orderBy: { date: 'asc' } }),
  ])
  const holidayOn = (d: Date) => holidays.find((h) => h.date.getTime() === d.getTime())
  const self = `/calendar${sp.m ? `?m=${sp.m}` : ''}`
  const cells: Date[] = []
  for (let d = gridStart; d <= last || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d)
  const count = (d: Date) => {
    let boxes = 0
    let ends = 0
    for (const r of running) {
      const x = r.plan.dayOn(d)
      if (x && (x.kind === 'planned' || x.kind === 'delivered')) boxes++
      if (r.plan.end && r.plan.end.getTime() === d.getTime()) ends++
    }
    const t = trials.filter((x) => x.deliveryDate.getTime() === d.getTime()).length
    const b = dobs.filter((x) => x.dob!.getUTCDate() === d.getUTCDate() && x.dob!.getUTCMonth() === d.getUTCMonth()).length
    return { boxes: boxes + t, trials: t, ends, birthdays: b, menu: menus.some((x) => x.date.getTime() === d.getTime()) }
  }
  const prev = keyOf(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7)
  const next = keyOf(new Date(Date.UTC(y, m, 1))).slice(0, 7)
  return (
    <>
      <PageHeader title={MONTH.format(first)} crumb="Calendar" sub="Boxes planned each day (monthly and trial), trials, last days of packages and birthdays. Sunday and office holidays have no delivery.">
        <div className="flex gap-2">
          <Link href={`/calendar?m=${prev}`} className="btn-secondary btn-sm">Previous</Link>
          <Link href="/calendar" className="btn-secondary btn-sm">Today</Link>
          <Link href={`/calendar?m=${next}`} className="btn-secondary btn-sm">Next</Link>
        </div>
      </PageHeader>
      <section className="card overflow-x-auto p-4">
        <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className={`px-1 text-xs font-semibold ${d === 'Sun' ? 'text-red' : 'text-muted'}`}>{d}</div>)}
          {cells.map((d) => {
            const inMonth = d.getUTCMonth() === m - 1
            const hol = holidayOn(d)
            const sun = d.getUTCDay() === 0
            const c = count(d)
            const isToday = d.getTime() === today.getTime()
            return (
              <div key={keyOf(d)} className={`min-h-24 rounded-lg p-2 text-xs ${hol ? 'bg-red-soft' : sun ? 'bg-[#dcd6e3]' : 'bg-s2'} ${inMonth ? '' : 'opacity-40'} ${isToday ? 'ring-2 ring-brand' : ''}`}>
                <div className="mb-1 text-sm font-bold">{d.getUTCDate()}</div>
                {hol ? (
                  <div className="space-y-1">
                    <div className="font-semibold text-red">Office holiday</div>
                    <div className="text-red">{hol.name}</div>
                    {canSet && d >= today && <form action={removeHoliday}><input type="hidden" name="id" value={hol.id} /><input type="hidden" name="back" value={self} /><button className="text-muted underline hover:text-red">Remove</button></form>}
                  </div>
                ) : sun ? <div className="text-muted">Holiday</div> : (
                  <div className="space-y-0.5">
                    {c.boxes > 0 && <div className="font-semibold text-leaf">{c.boxes} boxes</div>}
                    {c.trials > 0 && <div className="text-sky">{c.trials} trial{c.trials > 1 ? 's' : ''}</div>}
                    {c.ends > 0 && <div className="text-warn">{c.ends} last day</div>}
                    {c.birthdays > 0 && <div className="text-red">{c.birthdays} birthday{c.birthdays > 1 ? 's' : ''}</div>}
                    {d >= today && user.role !== 'KITCHEN' && (
                      <Link href={`/menu?date=${keyOf(d)}`} className={c.menu ? 'text-brand' : 'text-muted underline'}>{c.menu ? 'Menu added' : 'Add menu'}</Link>
                    )}
                    {d < today && c.menu && <div className="text-brand">Menu added</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
      <Card title="Office holidays" sub="No boxes go out that day for any customer. It does not count in the 26, so every customer's end date moves one day later.">
        {canSet && (
          <form action={addHoliday} className="mb-4 flex flex-wrap items-end gap-2.5">
            <input type="hidden" name="back" value={self} />
            <div className="w-48"><label className="label">Date *</label><DateField name="date" required min={keyOf(today)} /></div>
            <div className="min-w-48 flex-1"><label className="label">Reason</label><input name="name" className="input" placeholder="For example: Diwali, office leave" /></div>
            <button className="btn">Add holiday</button>
          </form>
        )}
        {holidays.filter((h) => h.date >= today).length === 0 ? <p className="text-sm text-muted">No office holidays coming up.</p> : (
          <ul className="divide-y divide-line">
            {holidays.filter((h) => h.date >= today).map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-36 font-semibold">{fmtWeekday(h.date)}</span>
                <span className="flex-1">{h.name}</span>
                {canSet && <form action={removeHoliday}><input type="hidden" name="id" value={h.id} /><input type="hidden" name="back" value={self} /><button className="text-xs font-semibold text-muted hover:text-red">Remove</button></form>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
