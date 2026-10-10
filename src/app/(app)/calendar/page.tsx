import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, keyOf } from '@/lib/dates'
import { runningPackages } from '@/lib/queries'
import { PageHeader } from '@/components/ui'

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
  const [running, trials, menus, dobs] = await Promise.all([
    runningPackages(today),
    db.trialBox.findMany({ where: { deliveryDate: { gte: first, lte: last } }, select: { deliveryDate: true } }),
    db.menu.findMany({ where: { date: { gte: first, lte: last } }, select: { date: true } }),
    db.lead.findMany({ where: { dob: { not: null }, status: { not: 'NOT_INTERESTED' } }, select: { dob: true } }),
  ])
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
      <PageHeader title={MONTH.format(first)} crumb="Calendar" sub="Boxes planned each day (monthly and trial), trials, last days of packages and birthdays. Sunday is a holiday.">
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
            const sun = d.getUTCDay() === 0
            const c = count(d)
            const isToday = d.getTime() === today.getTime()
            return (
              <div key={keyOf(d)} className={`min-h-24 rounded-lg p-2 text-xs ${sun ? 'bg-[#dcd6e3]' : 'bg-s2'} ${inMonth ? '' : 'opacity-40'} ${isToday ? 'ring-2 ring-brand' : ''}`}>
                <div className="mb-1 text-sm font-bold">{d.getUTCDate()}</div>
                {sun ? <div className="text-muted">Holiday</div> : (
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
    </>
  )
}
