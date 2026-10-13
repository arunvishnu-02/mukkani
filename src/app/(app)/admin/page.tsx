import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday, isDay, longToday, nowHourIST, parseDay } from '@/lib/dates'
import { LEAD_STATUS, rupees, SOURCE } from '@/lib/labels'
import { dueCalls, waitingPayment } from '@/lib/kitchen'
import { daySheet, runningPackages } from '@/lib/queries'
import { figures, pct, period, teamFigures } from '@/lib/report'
import { appSettings } from '@/lib/settings'
import { stockToday } from '@/lib/stock'
import { Bar, Card, PageHeader, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { DateField } from '@/components/DateField'

function Alert({ n, text, href, tone = 'warn' }: { n: number; text: string; href: string; tone?: 'warn' | 'red' }) {
  if (!n) return null
  return (
    <Link href={href} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 hover:opacity-80">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${tone === 'red' ? 'bg-red' : 'bg-warn'}`}>{n}</span>
      <span className="flex-1 text-sm">{text}</span>
      <span className="text-muted">›</span>
    </Link>
  )
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const today = day(0)
  // The figures follow the period picked at the top: today, this week, this month, or one chosen day.
  const picked = isDay(sp.date) ? parseDay(sp.date) : null
  const base = picked ? period('day', picked) : period(sp.period === 'day' || sp.period === 'week' ? sp.period : 'month', today)
  const month = { ...base, label: picked ? fmtWeekday(picked) : base.label }
  const here = picked ? `date=${dayInput(picked)}` : `period=${base.kind}`
  const SORTS = ['leads', 'calls', 'trials', 'monthly'] as const
  const sort = SORTS.find((k) => k === sp.sort) ?? null
  const [leadCounts, f, team, sheet, running, trialsWeek, calls, unpaid, stock, altOut, unpaidPkgs, st, duesSoon, dayRequests] = await Promise.all([
    db.lead.groupBy({ by: ['status'], _count: true }),
    figures(month),
    teamFigures(month),
    daySheet(today),
    runningPackages(today),
    db.trialBox.count({ where: { deliveryDate: { gte: period('week', today).from, lt: period('week', today).to } } }),
    dueCalls(today),
    waitingPayment(),
    appSettings().then((st) => stockToday(today, st.fruits, st.lowStockKg)),
    db.altBox.count({ where: { collectedOn: null, givenOn: { lt: addDays(today, -1) } } }),
    db.package.count({ where: { status: 'ACTIVE', paid: false } }),
    appSettings(),
    db.due.findMany({ where: { paidAt: null, dueDate: { lte: day(1) } }, select: { amount: true } }),
    db.dayRequest.count({ where: { status: 'PENDING' } }),
  ])
  const rows = sort ? [...team].sort((a, b) => b[sort] - a[sort]) : team
  const callsMade = team.reduce((a, t) => a + t.calls, 0)
  const count = (s: string) => leadCounts.find((c) => c.status === s)?._count ?? 0
  const allLeads = leadCounts.reduce((a, c) => a + c._count, 0)
  const boxesToday = sheet.rows.filter((r) => !r.absent).length + sheet.trials.length
  const attendanceDue = nowHourIST() >= 9 ? Math.max(0, sheet.rows.length + sheet.trials.length - sheet.entered) : 0
  const lowStock = stock.filter((s) => s.low).length
  const maxReason = Math.max(1, ...f.notInterested.map((r) => r[1]))
  return (
    <>
      <PageHeader title="Business overview" sub={`${longToday()} · showing ${month.label}`}>
        <a href="/api/export/leads" download className="btn-secondary">Download Excel</a>
        <Link href="/admin/reports" className="btn">Reports</Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs items={[['day', 'Today'], ['week', 'This week'], ['month', 'This month']].map(([k, l]) => ({ label: l, href: `/admin?period=${k}`, active: !picked && base.kind === k }))} />
        <div className="flex-1" />
        <form action="/admin" className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-muted">Check one day</span>
          <DateField name="date" defaultValue={picked ? dayInput(picked) : ''} max={dayInput(today)} compact />
          <button className="btn-secondary btn-sm">Go</button>
        </form>
      </div>
      <section>
        <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-muted uppercase">KPIs · {month.label}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {([
            ['New leads', f.leads, 'text-sky', '/report/leads'],
            ['Calls made', callsMade, 'text-warn', '/report/calls'],
            ['Trials booked', f.trials, 'text-brand', '/report/trials'],
            ['New monthly packs', f.newMonthly + f.renewals, 'text-leaf', '/report/packs'],
            ['Boxes delivered', f.boxesDelivered, 'text-leaf', '/report/attendance'],
            ['Money received', rupees(f.income), 'text-leaf', '/admin/reports'],
            ['Money spent', rupees(f.spent), 'text-red', '/report/money'],
          ] as const).map(([l, v, c, href]) => (
            <Link key={l} href={href} className="card px-3.5 py-3 hover:border-brand">
              <div className="text-xs font-semibold text-muted">{l}</div>
              <div className={`mt-1 font-display text-2xl font-bold leading-none ${c}`}>{v}</div>
            </Link>
          ))}
        </div>
      </section>
      <Tiles cols={5}>
        <Tile label="All leads" value={allLeads} sub={`+${f.leads} in ${month.label}`} />
        <Tile label="Active monthly" value={running.length} sub={`${f.newMonthly} new · ${f.renewals} renewed`} tone="leaf" />
        <Tile label="Trials this week" value={trialsWeek} sub={`${f.trialsWon} of ${f.trialsDone} took monthly`} tone="sky" />
        <Tile label="Boxes today" value={boxesToday} sub={`${sheet.rows.length - sheet.rows.filter((r) => r.absent).length} monthly · ${sheet.trials.length} trial`} tone="brand" />
        <Tile label="Income" value={rupees(f.income)} sub={`${month.label} · ${f.profit < 0 ? 'loss' : 'profit'} ${rupees(Math.abs(f.profit))}`} tone="leaf" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card title="Customers by category" sub="All leads today">
          <div className="space-y-3">
            {Object.entries(LEAD_STATUS).map(([k, [l, t]]) => <Bar key={k} label={l} value={count(k)} max={Math.max(1, allLeads)} tone={t} />)}
          </div>
          <p className="mt-4 text-[13px] text-muted">Trials that became monthly in {month.label}: <b className="text-ink">{pct(f.trialsWon, f.trialsDone)}</b></p>
        </Card>
        <Card title="Income and spend" sub={month.label}>
          <dl className="space-y-2 text-sm">
            {[
              ['Monthly packs', f.monthlyIncome],
              ['Add-on drink', f.buttermilkIncome],
              ['Trial boxes', f.trialIncome],
            ].map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className="font-semibold">{rupees(v as number)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Income</dt><dd className="font-bold text-leaf">{rupees(f.income)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Purchases</dt><dd className="font-semibold">- {rupees(f.purchases)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Expenses</dt><dd className="font-semibold">- {rupees(f.expenses)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Profit</dt><dd className={`font-bold ${f.profit < 0 ? 'text-red' : 'text-leaf'}`}>{rupees(f.profit)}</dd></div>
          </dl>
        </Card>
        <Card title="Needs attention" sub="Tap to open">
          <Alert n={dayRequests} text="requests to change a past day" href="/admin/requests" tone="red" />
          <Alert n={duesSoon.length} text={`dues to pay by tomorrow (${rupees(duesSoon.reduce((a, d) => a + d.amount, 0))})`} href="/admin/dues" tone="red" />
          <Alert n={attendanceDue} text="attendance rows not entered today" href="/attendance" tone="red" />
          <Alert n={calls.length} text="customer calls due (kitchen)" href="/kitchen/calls" />
          <Alert n={unpaid.length} text="renewals waiting for payment" href="/kitchen/calls" />
          <Alert n={unpaidPkgs} text="running packs not marked paid" href="/customers?tab=monthly" />
          <Alert n={lowStock} text={`fruits under ${st.lowStockKg} kg`} href="/kitchen/stock" tone="red" />
          <Alert n={altOut} text="alternative boxes not collected" href="/kitchen/alt-boxes" />
          {attendanceDue + calls.length + unpaid.length + unpaidPkgs + lowStock + altOut === 0 && <p className="text-sm text-muted">All clear.</p>}
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between px-5 py-4">
            <div><h2 className="font-display text-lg font-semibold">Sales team</h2><p className="text-[13px] text-muted">{month.label}</p></div>
            <Link href="/admin/users" className="btn-secondary btn-sm">Team</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                {([['leads', 'Leads added'], ['calls', 'Calls'], ['trials', 'Trials'], ['monthly', 'Monthly packs']] as const).map(([k, l]) => (
                  <th key={k} className="th"><Link href={`/admin?${here}${sort === k ? '' : `&sort=${k}`}`} scroll={false} title="Sort, highest first" className={`inline-flex items-center gap-1 uppercase hover:text-brand ${sort === k ? 'text-brand' : ''}`}>{l}<span aria-hidden className="text-[9px]">{sort === k ? '▼' : '↕'}</span></Link></th>
                ))}
                <th className="th">Trials that became monthly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.user.id}><td className="td"><Who name={t.user.name} /></td><td className="td">{t.leads}</td><td className="td">{t.calls}</td><td className="td">{t.trials}</td><td className="td font-semibold">{t.monthly}</td><td className="td">{t.trialResults ? `${t.rate} · ${t.trialsWon} of ${t.trialResults}` : <span className="text-muted">no results yet</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="space-y-4">
          <Card title="Why not interested" sub={month.label}>
            {f.notInterested.length === 0 ? <p className="text-sm text-muted">None in this period.</p> : (
              <div className="space-y-3">{f.notInterested.map(([r, n]) => <Bar key={r} label={r} value={n} max={maxReason} tone="muted" />)}</div>
            )}
          </Card>
          <Card title="Where leads came from" sub={month.label}>
            {f.sources.length === 0 ? <p className="text-sm text-muted">No new leads in this period.</p> : (
              <div className="space-y-3">{f.sources.map(([s, n]) => <Bar key={s} label={SOURCE[s as keyof typeof SOURCE] ?? s} value={n} max={Math.max(1, f.leads)} tone="sky" />)}</div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
