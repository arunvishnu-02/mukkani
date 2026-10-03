import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { kitchenToday } from '@/lib/queries'
import { Bar, Card, PageHeader, Tile, Tiles, Who } from '@/components/ui'

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export default async function AdminOverview() {
  await requireUser(['ADMIN'])
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [leads, packages, trials, regions, sales, k, newLeads, contacted] = await Promise.all([
    db.lead.count(),
    db.package.findMany({ select: { startDate: true, status: true, updatedAt: true } }),
    db.trialBox.findMany({ select: { status: true, result: true, createdAt: true, updatedAt: true, lead: { select: { regionId: true, ownerId: true } } } }),
    db.region.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { leads: true } } } }),
    db.user.findMany({ where: { role: 'SALES' }, include: { _count: { select: { leads: true } } }, orderBy: { name: 'asc' } }),
    kitchenToday(),
    db.lead.count({ where: { createdAt: { gte: monthStart } } }),
    db.lead.count({ where: { createdAt: { gte: monthStart }, status: { not: 'NEW' } } }),
  ])
  const closed = trials.filter((t) => t.result)
  const won = closed.filter((t) => t.result === 'CONVERTED')
  const active = packages.filter((p) => p.status === 'ACTIVE').length
  const months = Array.from({ length: 6 }, (_, i) => {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4 + i, 0, 23, 59))
    const label = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1)))
    const v = packages.filter((p) => p.startDate <= end && (p.status === 'ACTIVE' || p.status === 'PAUSED' || p.updatedAt > end)).length
    return [label, v] as const
  })
  const maxM = Math.max(1, ...months.map((m) => m[1]))
  const thisMonth = trials.filter((t) => t.createdAt >= monthStart)
  const funnel: [string, number, 'sky' | 'warn' | 'leaf'][] = [
    ['Leads', newLeads, 'sky'],
    ['Contacted', contacted, 'sky'],
    ['Trial requested', thisMonth.length, 'warn'],
    ['Trial completed', closed.filter((t) => t.updatedAt >= monthStart).length, 'warn'],
    ['Converted', won.filter((t) => t.updatedAt >= monthStart).length, 'leaf'],
  ]
  return (
    <>
      <PageHeader title="Business overview" sub="All regions · all sales executives" />
      <Tiles cols={5}>
        <Tile label="Total leads" value={leads} sub={`+${newLeads} this month`} />
        <Tile label="Conversion rate" value={pct(won.length, closed.length)} sub="trial to monthly" tone="leaf" />
        <Tile label="Monthly customers" value={active} sub="active packages" tone="leaf" />
        <Tile label="Active trials" value={trials.filter((t) => t.status !== 'COMPLETED').length} tone="warn" />
        <Tile label="Boxes today" value={k.total} sub={`${k.packages.length} regular · ${k.trials.length} trial`} />
      </Tiles>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monthly customer growth" sub="Regular box customers at month end">
          <div className="flex h-48 items-end justify-between gap-3">
            {months.map(([l, v], i) => (
              <div key={l} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-semibold">{v}</span>
                <span className={`w-full max-w-11 rounded-t-md ${i === 5 ? 'bg-leaf' : 'bg-leaf-soft'}`} style={{ height: `${Math.max(4, (v / maxM) * 140)}px` }} />
                <span className="text-xs text-muted">{l}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Lead conversion" sub="This month">
          <div className="space-y-3">{funnel.map(([l, v, t]) => <Bar key={l} label={l} value={v} max={Math.max(1, funnel[0][1])} tone={t} />)}</div>
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="px-5 py-4 font-display text-lg font-semibold">Region-wise sales</h2>
          <table className="w-full">
            <thead><tr><th className="th">Region</th><th className="th">Leads</th><th className="th">Trials</th><th className="th">Converted</th><th className="th">Rate</th></tr></thead>
            <tbody>
              {regions.map((r) => {
                const rt = trials.filter((t) => t.lead.regionId === r.id)
                const rc = rt.filter((t) => t.result)
                const rw = rc.filter((t) => t.result === 'CONVERTED')
                return <tr key={r.id}><td className="td">{r.name}</td><td className="td">{r._count.leads}</td><td className="td">{rt.length}</td><td className="td">{rw.length}</td><td className="td">{pct(rw.length, rc.length)}</td></tr>
              })}
            </tbody>
          </table>
        </section>
        <section className="card overflow-x-auto">
          <h2 className="px-5 py-4 font-display text-lg font-semibold">Sales executive performance</h2>
          <table className="w-full">
            <thead><tr><th className="th">Executive</th><th className="th">Leads</th><th className="th">Trials</th><th className="th">Converted</th><th className="th">Rate</th></tr></thead>
            <tbody>
              {sales.map((u) => {
                const ut = trials.filter((t) => t.lead.ownerId === u.id)
                const uc = ut.filter((t) => t.result)
                const uw = uc.filter((t) => t.result === 'CONVERTED')
                return <tr key={u.id}><td className="td"><Who name={u.name} /></td><td className="td">{u._count.leads}</td><td className="td">{ut.length}</td><td className="td">{uw.length}</td><td className="td">{pct(uw.length, uc.length)}</td></tr>
              })}
            </tbody>
          </table>
        </section>
      </div>
    </>
  )
}
