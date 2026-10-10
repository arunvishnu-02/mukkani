import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, fmtDay } from '@/lib/dates'
import { PACKAGE_STATUS } from '@/lib/labels'
import { packagePlan, planFor, runningPackages } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { Drawer, Empty, PageHeader, Progress, StatusChip, Tabs, Tile, Tiles, WaLink, Who } from '@/components/ui'
import { saveReportNoteAction } from '../actions'

// Monthly report for each customer: created after the 26th delivery, can be edited, then printed or sent.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES', 'KITCHEN'])
  const sp = await searchParams
  const tab = sp.tab === 'progress' ? 'progress' : 'ready'
  const today = day(0)
  const [done, running, st, selected] = await Promise.all([
    db.package.findMany({ where: { status: 'COMPLETED' }, include: { lead: { include: { region: true } } }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    runningPackages(today),
    getSettings(),
    sp.pkg ? packagePlan(sp.pkg) : null,
  ])
  const att = await db.attendance.findMany({ where: { leadId: { in: done.map((p) => p.leadId) } }, select: { leadId: true, date: true, status: true } })
  const endOf = new Map(done.map((p) => [p.id, planFor(p, att.filter((a) => a.leadId === p.leadId), today).end]))
  const list = `/reports?tab=${tab}`
  const sendText = (name: string, from: Date, to: Date | null) => fill(st.msgReport, { name: firstName(name), from: fmtDay(from), to: fmtDay(to) })
  return (
    <>
      <PageHeader title="Monthly reports" sub="Made after the 26th delivery. Edit the note if needed, then print or send it on WhatsApp.">
        <Tabs items={[{ label: `Ready ${done.length}`, href: '/reports', active: tab === 'ready' }, { label: `In progress ${running.length}`, href: '/reports?tab=progress', active: tab === 'progress' }]} />
      </PageHeader>
      <Tiles cols={3}>
        <Tile label="Reports ready" value={done.length} sub="26 of 26 delivered" tone="leaf" />
        <Tile label="Ending this week" value={running.filter((r) => r.plan.end && r.plan.end <= day(6)).length} sub="reports come next" tone="warn" />
        <Tile label="In progress" value={running.length} sub="packages running" tone="brand" />
      </Tiles>
      <section className="card overflow-x-auto">
        {(tab === 'ready' ? done.length : running.length) === 0 ? <Empty>No reports here yet.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Dates</th><th className="th">Status</th><th className="th">Report</th></tr></thead>
            <tbody>
              {tab === 'ready'
                ? done.map((p) => (
                    <tr key={p.id}>
                      <td className="td"><Who name={p.lead.name} sub={p.lead.phone} href={`/customers/${p.leadId}`} /></td>
                      <td className="td">{p.lead.region?.name ?? '—'}</td>
                      <td className="td">Month {p.number}</td>
                      <td className="td whitespace-nowrap">{fmtDay(p.startDate)} to {fmtDay(endOf.get(p.id))}</td>
                      <td className="td"><StatusChip map={PACKAGE_STATUS} value={p.status} /></td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1.5">
                          <Link href={`${list}&pkg=${p.id}`} scroll={false} className="btn-secondary btn-sm">Edit</Link>
                          <a href={`/print/report/${p.id}`} target="_blank" rel="noreferrer" className="btn btn-sm">Print</a>
                          <WaLink small href={waLink(p.lead.phone, sendText(p.lead.name, p.startDate, endOf.get(p.id) ?? null))}>Send</WaLink>
                        </div>
                      </td>
                    </tr>
                  ))
                : running.map(({ pkg, plan }) => (
                    <tr key={pkg.id}>
                      <td className="td"><Who name={pkg.lead.name} sub={pkg.lead.phone} href={`/customers/${pkg.leadId}`} /></td>
                      <td className="td">{pkg.lead.region?.name ?? '—'}</td>
                      <td className="td"><div className="flex w-36 items-center gap-2"><Progress value={plan.delivered} max={26} /><span className="text-xs font-semibold">{plan.delivered}/26</span></div></td>
                      <td className="td">{fmtDay(pkg.startDate)}</td>
                      <td className="td">Ends {fmtDay(plan.end)}</td>
                      <td className="td"><a href={`/print/report/${pkg.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Preview</a></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </section>
      {selected && (
        <Drawer title="Edit monthly report" sub={`${selected.pkg.lead.name} · month ${selected.pkg.number} · ${fmtDay(selected.pkg.startDate)} to ${fmtDay(selected.plan.end)}`} close={list}>
          <form action={saveReportNoteAction} className="space-y-3.5">
            <input type="hidden" name="packageId" value={selected.pkg.id} />
            <input type="hidden" name="back" value={list} />
            <div>
              <label className="label">Note printed on the report</label>
              <textarea name="reportNote" rows={4} className="input" defaultValue={selected.pkg.reportNote ?? ''} placeholder="Optional. For example: Thank you for the lovely feedback!" />
            </div>
            <p className="text-xs text-muted">Delivered {selected.plan.delivered} of 26, {selected.plan.leave} days skipped. To correct a day, change the attendance for that date.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <a href={`/print/report/${selected.pkg.id}`} target="_blank" rel="noreferrer" className="btn-secondary">Preview</a>
              <button className="btn">Save</button>
            </div>
            <WaLink href={waLink(selected.pkg.lead.phone, sendText(selected.pkg.lead.name, selected.pkg.startDate, selected.plan.end))}>Send on WhatsApp</WaLink>
            <p className="text-xs text-muted">To send the report itself, open Print, choose Save as PDF and attach the PDF in WhatsApp.</p>
          </form>
        </Drawer>
      )}
    </>
  )
}
