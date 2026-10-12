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

// One line of a report card: what it is, a short note on how it is counted, and the figure.
function Line({ label, hint, value, total, tone }: { label: string; hint?: string; value: React.ReactNode; total?: boolean; tone?: 'leaf' | 'red' }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${total ? 'mt-1 border-t border-line pt-2.5' : ''}`}>
      <dt className="min-w-0">
        <div className={total ? 'text-sm font-semibold' : 'text-sm'}>{label}</div>
        {hint && <div className="text-[11px] leading-4 text-muted">{hint}</div>}
      </dt>
      <dd className={`shrink-0 text-sm ${total ? 'font-bold' : 'font-semibold'} ${tone === 'leaf' ? 'text-leaf' : tone === 'red' ? 'text-red' : ''}`}>{value}</dd>
    </div>
  )
}

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const p = period(sp.period)
  const [f, team] = await Promise.all([figures(p), teamFigures(p)])
  const last = addDays(p.to, -1)
  const sub = p.kind === 'day' ? fmtWeekday(p.from) : `${fmtWeekday(p.from)} to ${fmtWeekday(last)}`
  const notInterested = f.notInterested.reduce((a, r) => a + r[1], 0)
  const tab = (k: string, l: string) => ({ label: l, href: `/admin/reports?period=${k}`, active: p.kind === k })
  return (
    <>
      <PageHeader title="Reports" crumb="Business" sub={`${p.label} · ${sub}`}>
        <Tabs items={[tab('day', 'Daily'), tab('week', 'Weekly'), tab('month', 'Monthly')]} />
      </PageHeader>
      <Tiles cols={5}>
        <Tile label="Money received" value={rupees(f.income)} sub="packs, add-on drinks and trials paid" tone="leaf" />
        <Tile label="Money spent" value={rupees(f.spent)} sub="purchases + expenses entered" tone="red" />
        <Tile label={f.profit < 0 ? 'Loss' : 'Profit'} value={rupees(Math.abs(f.profit))} sub="received minus spent" tone={f.profit < 0 ? 'red' : 'leaf'} />
        <Tile label="Boxes delivered" value={f.boxesDelivered} sub="marked Delivered in attendance" tone="brand" />
        <Tile label="New leads" value={f.leads} sub={`${f.trials} trials booked`} tone="sky" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card title="Sales" sub={`What the sales team did · ${p.label}`}>
          <dl>
            <Line label="New leads" hint="People added to Leads" value={f.leads} />
            <Line label="Trials booked" hint="Trial boxes booked" value={f.trials} />
            <Line label="Trial results given" hint="Feedback calls finished" value={f.trialsDone} />
            <Line label="Trials that became monthly" hint={f.trialsDone ? `${f.trialsWon} of ${f.trialsDone} results` : 'No trial results yet'} value={pct(f.trialsWon, f.trialsDone)} />
            <Line label="New monthly packs" hint="First pack, with or without a trial" value={f.newMonthly} />
            <Line label="Renewals" hint="Second pack or later" value={f.renewals} />
            <Line label="Not interested" hint="Leads closed as not interested" value={notInterested} />
          </dl>
        </Card>
        <Card title="Money" sub={`Received and spent · ${p.label}`}>
          <dl>
            <Line label="Monthly packs" hint="Packs marked paid" value={rupees(f.monthlyIncome)} />
            <Line label="Add-on drink" hint="Paid with the pack" value={rupees(f.buttermilkIncome)} />
            <Line label="Trial boxes" hint="Trials marked paid" value={rupees(f.trialIncome)} />
            <Line label="Money received" value={rupees(f.income)} total tone="leaf" />
            {f.byCategory.length === 0 ? <Line label="Nothing spent" hint="No purchase or expense entered" value={rupees(0)} /> : f.byCategory.map(([c, v]) => <Line key={c} label={c} hint="Purchase + expenses" value={`- ${rupees(v)}`} />)}
            <Line label="Money spent" value={`- ${rupees(f.spent)}`} total tone="red" />
            <Line label={f.profit < 0 ? 'Loss' : 'Profit'} hint="Received minus spent" value={rupees(Math.abs(f.profit))} total tone={f.profit < 0 ? 'red' : 'leaf'} />
          </dl>
        </Card>
        <Card title="Kitchen" sub={`Boxes and fruit · ${p.label}`}>
          <dl>
            <Line label="Boxes delivered" hint="Marked Delivered in attendance" value={f.boxesDelivered} />
            <Line label="Fruit cut" hint="From the Wastage screen" value={`${f.cutKg} kg`} />
            <Line label="Wastage" hint="Fruit thrown away" value={`${f.wasteKg} kg`} />
            <Line label="Waste share" hint="Wastage out of fruit cut" value={pct(f.wasteKg, f.cutKg)} />
          </dl>
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Sales team</h2><p className="text-[13px] text-muted">Each sales person&apos;s own leads · {p.label}</p></div>
          {team.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No sales users yet. Add them in Team + regions.</p> : (
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Leads added</th><th className="th">Calls made</th><th className="th">Trials booked</th><th className="th">Trials that became monthly</th><th className="th">New monthly packs</th></tr></thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.user.id}>
                    <td className="td"><Who name={t.user.name} /></td>
                    <td className="td">{t.leads}</td>
                    <td className="td">{t.calls}</td>
                    <td className="td">{t.trials}</td>
                    <td className="td">{t.trialResults ? <><span className="font-semibold">{t.rate}</span> <span className="text-muted">· {t.trialsWon} of {t.trialResults} results</span></> : <span className="text-muted">no results yet</span>}</td>
                    <td className="td font-semibold">{t.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-line px-5 py-3 text-xs leading-[18px] text-muted">
            <b>Trials that became monthly</b> counts only trials whose feedback call is finished, so it is never more than 100%.
            <b> New monthly packs</b> also includes customers who started a pack without a trial.
          </p>
        </section>
        <div className="space-y-4">
          <Card title="Download for Excel" sub={`CSV files for ${p.label}`}>
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
