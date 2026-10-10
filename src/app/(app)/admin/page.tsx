import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, longToday, nowHourIST } from '@/lib/dates'
import { LEAD_STATUS, rupees, SOURCE } from '@/lib/labels'
import { dueCalls, waitingPayment } from '@/lib/kitchen'
import { daySheet, runningPackages } from '@/lib/queries'
import { figures, pct, period, teamFigures } from '@/lib/report'
import { appSettings } from '@/lib/settings'
import { stockToday } from '@/lib/stock'
import { Bar, Card, PageHeader, Tile, Tiles, Who } from '@/components/ui'

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

export default async function AdminOverview() {
  await requireUser(['ADMIN'])
  const today = day(0)
  const month = period('month', today)
  const st = await appSettings()
  const [leadCounts, f, team, sheet, running, trialsWeek, calls, unpaid, stock, altOut, unpaidPkgs] = await Promise.all([
    db.lead.groupBy({ by: ['status'], _count: true }),
    figures(month),
    teamFigures(month),
    daySheet(today),
    runningPackages(today),
    db.trialBox.count({ where: { deliveryDate: { gte: period('week', today).from, lt: period('week', today).to } } }),
    dueCalls(today),
    waitingPayment(),
    stockToday(today, st.fruits, st.lowStockKg),
    db.altBox.count({ where: { collectedOn: null, givenOn: { lt: addDays(today, -1) } } }),
    db.package.count({ where: { status: 'ACTIVE', paid: false } }),
  ])
  const count = (s: string) => leadCounts.find((c) => c.status === s)?._count ?? 0
  const allLeads = leadCounts.reduce((a, c) => a + c._count, 0)
  const boxesToday = sheet.rows.filter((r) => !r.absent).length + sheet.trials.length
  const attendanceDue = nowHourIST() >= 11 ? Math.max(0, sheet.rows.length + sheet.trials.length - sheet.entered) : 0
  const lowStock = stock.filter((s) => s.low).length
  const maxReason = Math.max(1, ...f.notInterested.map((r) => r[1]))
  return (
    <>
      <PageHeader title="Business overview" sub={`${longToday()} · all regions`}>
        <a href="/api/export/leads" download className="btn-secondary">Download Excel</a>
        <Link href="/admin/reports" className="btn">Reports</Link>
      </PageHeader>
      <Tiles cols={5}>
        <Tile label="All leads" value={allLeads} sub={`+${f.leads} this month`} />
        <Tile label="Active monthly" value={running.length} sub={`${f.newMonthly} new · ${f.renewals} renewed`} tone="leaf" />
        <Tile label="Trials this week" value={trialsWeek} sub={`${f.trialsWon} of ${f.trialsDone} took monthly`} tone="sky" />
        <Tile label="Boxes today" value={boxesToday} sub={`${sheet.rows.length - sheet.rows.filter((r) => r.absent).length} monthly · ${sheet.trials.length} trial`} tone="brand" />
        <Tile label="Income this month" value={rupees(f.income)} sub={`profit ${rupees(f.profit)}`} tone="leaf" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card title="Customers by category" sub="All leads today">
          <div className="space-y-3">
            {Object.entries(LEAD_STATUS).map(([k, [l, t]]) => <Bar key={k} label={l} value={count(k)} max={Math.max(1, allLeads)} tone={t} />)}
          </div>
          <p className="mt-4 text-[13px] text-muted">Trial to monthly this month: <b className="text-ink">{pct(f.trialsWon, f.trialsDone)}</b></p>
        </Card>
        <Card title="Income and spend" sub={month.label}>
          <dl className="space-y-2 text-sm">
            {[
              ['Monthly packs', f.monthlyIncome],
              ['Buttermilk', f.buttermilkIncome],
              ['Trial boxes', f.trialIncome],
            ].map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className="font-semibold">{rupees(v as number)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Income</dt><dd className="font-bold text-leaf">{rupees(f.income)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Purchases</dt><dd className="font-semibold">- {rupees(f.purchases)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Expenses</dt><dd className="font-semibold">- {rupees(f.expenses)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Profit</dt><dd className={`font-bold ${f.profit < 0 ? 'text-red' : 'text-leaf'}`}>{rupees(f.profit)}</dd></div>
          </dl>
        </Card>
        <Card title="Needs attention" sub="Tap to open">
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
            <thead><tr><th className="th">Name</th><th className="th">Leads added</th><th className="th">Calls</th><th className="th">Trials</th><th className="th">Monthly packs</th><th className="th">Trial to monthly</th></tr></thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.user.id}><td className="td"><Who name={t.user.name} /></td><td className="td">{t.leads}</td><td className="td">{t.calls}</td><td className="td">{t.trials}</td><td className="td font-semibold">{t.monthly}</td><td className="td">{t.rate}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="space-y-4">
          <Card title="Why not interested" sub="This month">
            {f.notInterested.length === 0 ? <p className="text-sm text-muted">None this month.</p> : (
              <div className="space-y-3">{f.notInterested.map(([r, n]) => <Bar key={r} label={r} value={n} max={maxReason} tone="muted" />)}</div>
            )}
          </Card>
          <Card title="Where leads came from" sub="This month">
            {f.sources.length === 0 ? <p className="text-sm text-muted">No new leads this month.</p> : (
              <div className="space-y-3">{f.sources.map(([s, n]) => <Bar key={s} label={SOURCE[s as keyof typeof SOURCE] ?? s} value={n} max={Math.max(1, f.leads)} tone="sky" />)}</div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
