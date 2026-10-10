import { requireUser } from '@/lib/auth'
import { addDays, fmtWeekday } from '@/lib/dates'
import { rupees, SOURCE } from '@/lib/labels'
import { figures, pct, period, teamFigures } from '@/lib/report'
import { Bar, Card, PageHeader, Tabs, Tile, Tiles, Who } from '@/components/ui'

const DOWNLOADS: [string, string][] = [
  ['leads', 'All leads and customers'],
  ['packages', 'Monthly packs'],
  ['trials', 'Trial boxes'],
  ['attendance', 'Delivery attendance'],
  ['money', 'Purchase + expenses'],
  ['wastage', 'Wastage'],
]

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const p = period(sp.period)
  const [f, team] = await Promise.all([figures(p), teamFigures(p)])
  const last = addDays(p.to, -1)
  const sub = p.kind === 'day' ? fmtWeekday(p.from) : `${fmtWeekday(p.from)} to ${fmtWeekday(last)}`
  const tab = (k: string, l: string) => ({ label: l, href: `/admin/reports?period=${k}`, active: p.kind === k })
  return (
    <>
      <PageHeader title="Reports" crumb="Business" sub={`${p.label} · ${sub}`}>
        <Tabs items={[tab('day', 'Daily'), tab('week', 'Weekly'), tab('month', 'Monthly')]} />
      </PageHeader>
      <Tiles cols={5}>
        <Tile label="Income" value={rupees(f.income)} tone="leaf" />
        <Tile label="Spent" value={rupees(f.spent)} sub="purchases + expenses" tone="red" />
        <Tile label="Profit" value={rupees(f.profit)} tone={f.profit < 0 ? 'red' : 'leaf'} />
        <Tile label="Boxes delivered" value={f.boxesDelivered} sub="monthly customers" tone="brand" />
        <Tile label="New leads" value={f.leads} sub={`${f.trials} trials booked`} tone="sky" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card title="Sales" sub={p.label}>
          <dl className="space-y-2 text-sm">
            {[
              ['New leads', f.leads],
              ['Trials booked', f.trials],
              ['Trial results given', f.trialsDone],
              ['Trial to monthly', `${f.trialsWon} (${pct(f.trialsWon, f.trialsDone)})`],
              ['New monthly packs', f.newMonthly],
              ['Renewals', f.renewals],
              ['Not interested', f.notInterested.reduce((a, r) => a + r[1], 0)],
            ].map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
        </Card>
        <Card title="Money" sub={p.label}>
          <dl className="space-y-2 text-sm">
            {[
              ['Monthly packs', f.monthlyIncome],
              ['Buttermilk', f.buttermilkIncome],
              ['Trial boxes', f.trialIncome],
            ].map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className="font-semibold">{rupees(v as number)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Income</dt><dd className="font-bold text-leaf">{rupees(f.income)}</dd></div>
            {f.byCategory.map(([c, v]) => <div key={c} className="flex justify-between"><dt className="text-muted">{c}</dt><dd className="font-semibold">- {rupees(v)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Profit</dt><dd className={`font-bold ${f.profit < 0 ? 'text-red' : 'text-leaf'}`}>{rupees(f.profit)}</dd></div>
          </dl>
        </Card>
        <Card title="Kitchen" sub={p.label}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Boxes delivered</dt><dd className="font-semibold">{f.boxesDelivered}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Fruit cut</dt><dd className="font-semibold">{f.cutKg} kg</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Wastage</dt><dd className="font-semibold">{f.wasteKg} kg</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Waste share</dt><dd className="font-semibold">{pct(f.wasteKg, f.cutKg)}</dd></div>
          </dl>
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Sales team</h2><p className="text-[13px] text-muted">{p.label}</p></div>
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
          <Card title="Download for Excel" sub={`CSV files for ${p.label.toLowerCase()}`}>
            <div className="space-y-2">
              {DOWNLOADS.map(([k, l]) => (
                <a key={k} href={`/api/export/${k}?period=${p.kind}`} className="flex items-center justify-between rounded-[10px] bg-s2 px-3 py-2.5 text-sm font-semibold hover:opacity-80">
                  {l}<span className="text-brand">Download</span>
                </a>
              ))}
            </div>
          </Card>
          <Card title="Where leads came from">
            {f.sources.length === 0 ? <p className="text-sm text-muted">No new leads.</p> : (
              <div className="space-y-3">{f.sources.map(([s, n]) => <Bar key={s} label={SOURCE[s as keyof typeof SOURCE] ?? s} value={n} max={Math.max(1, f.leads)} tone="sky" />)}</div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
