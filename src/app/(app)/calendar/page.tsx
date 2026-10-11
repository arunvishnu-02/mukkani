import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, fmtWeekday, keyOf, parseDay } from '@/lib/dates'
import { ATTENDANCE } from '@/lib/labels'
import { daySheet, runningPackages } from '@/lib/queries'
import { Chip, Drawer, Empty, PageHeader, StatusChip, Who } from '@/components/ui'

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Month view for every role: boxes each day, trials, packages ending, menus added and birthdays.
// Clicking a date opens that day's details: every box (monthly and trial), menu, last days and birthdays.
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
    db.lead.findMany({ where: { dob: { not: null }, status: { not: 'NOT_INTERESTED' } }, select: { id: true, name: true, phone: true, dob: true } }),
  ])
  const selected = sp.d ? parseDay(sp.d) : null
  const sheet = selected && !isNaN(selected.getTime()) ? await daySheet(selected) : null
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
  const birthdaysOn = (d: Date) => dobs.filter((x) => x.dob!.getUTCDate() === d.getUTCDate() && x.dob!.getUTCMonth() === d.getUTCMonth())
  const endsOn = (d: Date) => running.filter((r) => r.plan.end && r.plan.end.getTime() === d.getTime())
  const month = `${y}-${String(m).padStart(2, '0')}`
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
              <div key={keyOf(d)} className={`relative min-h-24 rounded-lg p-2 text-xs hover:ring-2 hover:ring-brand/40 ${sun ? 'bg-[#dcd6e3]' : 'bg-s2'} ${inMonth ? '' : 'opacity-40'} ${isToday || selected?.getTime() === d.getTime() ? 'ring-2 ring-brand' : ''}`}>
                <Link href={`/calendar?m=${month}&d=${keyOf(d)}`} scroll={false} className="absolute inset-0 rounded-lg" aria-label={`Open ${fmtWeekday(d)}`} />
                <div className="mb-1 text-sm font-bold">{d.getUTCDate()}</div>
                {sun ? <div className="text-muted">Holiday</div> : (
                  <div className="space-y-0.5">
                    {c.boxes > 0 && <div className="font-semibold text-leaf">{c.boxes} boxes</div>}
                    {c.trials > 0 && <div className="text-sky">{c.trials} trial{c.trials > 1 ? 's' : ''}</div>}
                    {c.ends > 0 && <div className="text-warn">{c.ends} last day</div>}
                    {c.birthdays > 0 && <div className="text-red">{c.birthdays} birthday{c.birthdays > 1 ? 's' : ''}</div>}
                    {d >= today && user.role !== 'KITCHEN' && (
                      <Link href={`/menu?date=${keyOf(d)}`} className={`relative z-10 ${c.menu ? 'text-brand' : 'text-muted underline'}`}>{c.menu ? 'Menu added' : 'Add menu'}</Link>
                    )}
                    {d < today && c.menu && <div className="text-brand">Menu added</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
      {selected && sheet && (
        <DayDrawer
          date={selected}
          sheet={sheet}
          ends={endsOn(selected)}
          birthdays={birthdaysOn(selected)}
          close={`/calendar?m=${month}`}
          role={user.role}
          future={selected >= today}
        />
      )}
    </>
  )
}

type Sheet = Awaited<ReturnType<typeof daySheet>>

// Everything planned for one date, in the order the kitchen packs it.
function DayDrawer({ date, sheet, ends, birthdays, close, role, future }: {
  date: Date
  sheet: Sheet
  ends: Awaited<ReturnType<typeof runningPackages>>
  birthdays: { id: string; name: string; phone: string }[]
  close: string
  role: string
  future: boolean
}) {
  const key = keyOf(date)
  const sunday = date.getUTCDay() === 0
  const leave = sheet.rows.filter((r) => r.absent)
  const packing = sheet.rows.filter((r) => !r.absent)
  const stat = (label: string, value: number, tone = 'text-ink') => (
    <div className="rounded-lg bg-s2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-display text-xl font-bold ${tone}`}>{value}</div>
    </div>
  )
  return (
    <Drawer title={fmtWeekday(date)} sub={sunday ? 'Sunday holiday. No boxes.' : `${sheet.boxes} boxes: ${sheet.monthly} monthly, ${sheet.trials.length} trial`} close={close} wide>
      <div className="space-y-5 text-[13px]">
        {!sunday && (
          <div className="grid grid-cols-3 gap-2">
            {stat('Total boxes', sheet.boxes, 'text-leaf')}
            {stat('Monthly', sheet.monthly)}
            {stat('Trials', sheet.trials.length, 'text-sky')}
            {stat('On leave', leave.length, 'text-warn')}
            {stat('Buttermilk', sheet.buttermilk, 'text-brand')}
            {stat('Swaps', sheet.swapCount, 'text-red')}
          </div>
        )}

        {!sunday && (
          <section>
            <h3 className="mb-1.5 font-semibold">Menu</h3>
            {sheet.menu ? (
              <div className="rounded-lg bg-s2 px-3 py-2">
                <div>{sheet.menu.fruits}</div>
                {sheet.menu.salad && <div className="text-muted">Salad: {sheet.menu.salad}</div>}
                {sheet.menu.swapFruits && <div className="text-muted">Swap fruits: {sheet.menu.swapFruits}</div>}
              </div>
            ) : (
              <div className="text-muted">
                No menu yet.{' '}
                {future && role !== 'KITCHEN' && <Link href={`/menu?date=${key}`} className="text-brand underline">Add menu</Link>}
              </div>
            )}
          </section>
        )}

        {!sunday && (
          <section>
            <h3 className="mb-1.5 font-semibold">Monthly boxes ({packing.length})</h3>
            {packing.length === 0 ? <Empty>No monthly boxes this day.</Empty> : (
              <ul className="divide-y divide-line">
                {packing.map((r) => (
                  <li key={r.pkg.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <Who name={r.lead.name} sub={[r.lead.region?.name, r.lead.deliveryTime].filter(Boolean).join(' · ')} href={`/customers/${r.lead.id}`} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {r.dayNo && <Chip label={`Day ${r.dayNo} of 26`} tone="muted" />}
                      {r.isNew && <Chip label="New" tone="brand" />}
                      {r.bm > 0 && <Chip label={`Buttermilk ${r.bm}`} tone="brand" />}
                      {r.altBox && <Chip label={`Alt box ${r.altBox}`} tone="sky" />}
                      {r.swap?.swapTo && <Chip label={`Swap to ${r.swap.swapTo}`} tone="red" />}
                      {r.attendance && <StatusChip map={ATTENDANCE} value={r.attendance.status} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {sheet.trials.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">Trial boxes ({sheet.trials.length})</h3>
            <ul className="divide-y divide-line">
              {sheet.trials.map(({ trial, swap, attendance }) => (
                <li key={trial.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Who name={trial.lead.name} sub={[trial.lead.region?.name, trial.slot ?? trial.lead.deliveryTime].filter(Boolean).join(' · ')} href={`/customers/${trial.leadId}`} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Chip label="Trial" tone="sky" />
                    {swap?.swapTo && <Chip label={`Swap to ${swap.swapTo}`} tone="red" />}
                    {attendance && <StatusChip map={ATTENDANCE} value={attendance.status} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {leave.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">On leave, not packed ({leave.length})</h3>
            <ul className="divide-y divide-line">
              {leave.map((r) => (
                <li key={r.pkg.id} className="py-2"><Who name={r.lead.name} sub={r.lead.region?.name} href={`/customers/${r.lead.id}`} /></li>
              ))}
            </ul>
          </section>
        )}

        {ends.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">Last day of package ({ends.length})</h3>
            <ul className="divide-y divide-line">
              {ends.map((r) => (
                <li key={r.pkg.id} className="py-2"><Who name={r.pkg.lead.name} sub={`Month ${r.pkg.number} ends`} href={`/customers/${r.pkg.leadId}`} /></li>
              ))}
            </ul>
          </section>
        )}

        {birthdays.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">Birthdays ({birthdays.length})</h3>
            <ul className="divide-y divide-line">
              {birthdays.map((b) => (
                <li key={b.id} className="py-2"><Who name={b.name} sub={b.phone} href={`/customers/${b.id}`} /></li>
              ))}
            </ul>
          </section>
        )}

        {!sunday && (role === 'KITCHEN' || role === 'ADMIN') && (
          <Link href={`/kitchen/sheet?date=${key}`} className="btn-secondary btn-sm inline-block">Open attendance sheet</Link>
        )}
      </div>
    </Drawer>
  )
}
