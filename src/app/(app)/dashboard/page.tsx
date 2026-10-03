import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, fmtTime, longToday } from '@/lib/dates'
import { LEAD_STATUS } from '@/lib/labels'
import { Bar, Callout, Card, Empty, PageHeader, StatusChip, Tile, Tiles, Who, Chip } from '@/components/ui'
import type { LeadStatus } from '@/generated/prisma/enums'

export default async function SalesDashboard() {
  const user = await requireUser(['SALES'])
  const today = day(0)
  const weekAgo = day(-7)
  const [total, newWeek, newLeads, pending, overdue, trials, endingSoon, monthly, converted, closedTrials, byStatus, due, alerts] = await Promise.all([
    db.lead.count(),
    db.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    db.lead.count({ where: { status: 'NEW' } }),
    db.lead.count({ where: { nextFollowUpAt: { lte: today }, status: { notIn: ['LOST', 'NOT_INTERESTED', 'CONVERTED'] } } }),
    db.lead.count({ where: { nextFollowUpAt: { lt: today }, status: { notIn: ['LOST', 'NOT_INTERESTED', 'CONVERTED'] } } }),
    db.trialBox.count({ where: { status: { not: 'COMPLETED' } } }),
    db.trialBox.count({ where: { status: { not: 'COMPLETED' }, endDate: { lte: day(7) } } }),
    db.package.count({ where: { status: 'ACTIVE' } }),
    db.trialBox.count({ where: { result: 'CONVERTED' } }),
    db.trialBox.count({ where: { result: { not: null } } }),
    db.lead.groupBy({ by: ['status'], _count: true }),
    db.lead.findMany({
      where: { nextFollowUpAt: { lte: today }, status: { notIn: ['LOST', 'NOT_INTERESTED', 'CONVERTED'] } },
      include: { region: true },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 6,
    }),
    db.activity.findMany({ where: { kind: { in: ['alert', 'location', 'trial'] } }, include: { lead: true }, orderBy: { createdAt: 'desc' }, take: 4 }),
  ])
  const rate = closedTrials ? Math.round((converted / closedTrials) * 100) : 0
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count])) as Record<string, number>
  const max = Math.max(1, ...Object.values(counts))
  return (
    <>
      <PageHeader title={`Good morning, ${user.name.split(' ')[0]}`} sub={`${longToday()} · leads and follow-ups for today`}>
        <Link href="/leads?new=1" className="btn">Add lead</Link>
      </PageHeader>
      <Tiles cols={6}>
        <Tile label="Total leads" value={total} sub={`+${newWeek} this week`} />
        <Tile label="New leads" value={newLeads} sub="not contacted yet" tone="sky" />
        <Tile label="Follow-ups pending" value={pending} sub={`${overdue} overdue`} tone="warn" />
        <Tile label="Trial boxes" value={trials} sub={`${endingSoon} ending this week`} tone="warn" />
        <Tile label="Conversion rate" value={`${rate}%`} sub="trial to monthly" tone="leaf" />
        <Tile label="Monthly customers" value={monthly} sub="active packages" tone="leaf" />
      </Tiles>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <section className="card overflow-hidden">
          <div className="flex items-center px-5 py-4">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">Today&apos;s follow-ups</h2>
              <p className="text-[13px] text-muted">Call these customers today</p>
            </div>
            <Link href="/follow-ups" className="btn-secondary btn-sm">View all</Link>
          </div>
          {due.length === 0 ? (
            <Empty>No calls due today.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Status</th><th className="th">Due</th></tr></thead>
                <tbody>
                  {due.map((l) => (
                    <tr key={l.id}>
                      <td className="td"><Who name={l.name} sub={l.phone} href={`/leads?lead=${l.id}`} /></td>
                      <td className="td">{l.region?.name ?? '—'}</td>
                      <td className="td"><StatusChip map={LEAD_STATUS} value={l.status} /></td>
                      <td className="td">{l.nextFollowUpAt! < today ? <Chip label="Overdue" tone="red" /> : <Chip label="Today" tone="warn" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="space-y-4">
          <Card title="Lead pipeline" sub={`Where your ${total} leads are`}>
            <div className="space-y-2.5">
              {(Object.keys(LEAD_STATUS) as LeadStatus[]).map((k) => (
                <Bar key={k} label={LEAD_STATUS[k][0]} value={counts[k] ?? 0} max={max} tone={LEAD_STATUS[k][1]} />
              ))}
            </div>
          </Card>
          <Card title="Alerts">
            <div className="space-y-2">
              {alerts.length === 0 && <p className="text-sm text-muted">Nothing new.</p>}
              {alerts.map((a) => (
                <Callout key={a.id} tone={a.kind === 'alert' ? 'warn' : a.kind === 'location' ? 'leaf' : 'sky'}>
                  {a.lead.name}: {a.text}
                  {a.detail ? `. ${a.detail}` : ''} <span className="text-muted">· {fmtTime(a.createdAt)}</span>
                </Callout>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
