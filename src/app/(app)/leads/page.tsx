import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { dayInput, day, fmtDay } from '@/lib/dates'
import { LEAD_STATUS, LOCATION_STATUS, SOURCE } from '@/lib/labels'
import { leadInclude, regionsList } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { Drawer, Empty, ErrorNote, PageHeader, StatusChip, Tabs, Who } from '@/components/ui'
import { LeadFields } from '@/components/LeadForm'
import { BulkBar, RowCheck, SelectAll } from '@/components/Bulk'
import { createLead, deleteLeads, updateLead } from '../actions'
import type { Prisma } from '@/generated/prisma/client'
import type { LeadStatus } from '@/generated/prisma/enums'

const FILTERS: [string, string, LeadStatus | null][] = [
  ['all', 'All', null],
  ['follow', 'Follow up', 'FOLLOW_UP'],
  ['trial', 'Trial', 'TRIAL'],
  ['monthly', 'Monthly pack', 'MONTHLY'],
  ['no', 'Not interested', 'NOT_INTERESTED'],
]

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const f = FILTERS.find((x) => x[0] === sp.f) ?? FILTERS[0]
  const q = sp.q?.trim()
  const where: Prisma.LeadWhereInput = {
    ...(f[2] ? { status: f[2] } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}),
  }
  const [leads, counts, regions, selected, st] = await Promise.all([
    db.lead.findMany({ where, include: leadInclude, orderBy: { updatedAt: 'desc' }, take: 300 }),
    db.lead.groupBy({ by: ['status'], _count: true }),
    regionsList(),
    sp.lead ? db.lead.findUnique({ where: { id: sp.lead }, include: leadInclude }) : null,
    appSettings(),
  ])
  const c = Object.fromEntries(counts.map((r) => [r.status, r._count])) as Record<string, number>
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  const list = `/leads?f=${f[0]}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <>
      <PageHeader title="Leads" sub={`${total} leads. Every new lead starts in Follow up with a next call date.`}>
        <Link href={`${list}&new=1`} className="btn" scroll={false}>Add lead</Link>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs items={FILTERS.map(([k, label, status]) => ({ label: `${label} ${status ? (c[status] ?? 0) : total}`, href: `/leads?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`, active: f[0] === k }))} />
        <div className="flex-1" />
        <form action="/leads" className="w-full sm:w-60">
          <input type="hidden" name="f" value={f[0]} />
          <input name="q" defaultValue={q} placeholder="Search name or phone" className="input py-2" />
        </form>
      </div>
      <section className="card overflow-x-auto">
        {leads.length === 0 ? (
          <Empty>No leads here yet.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-10"><SelectAll formId="bulk-leads" /></th>
                <th className="th">Name</th><th className="th">Region</th><th className="th">Source</th><th className="th">Category</th><th className="th">Next call</th><th className="th">Location</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={l.id === selected?.id ? 'bg-brand-soft/60' : ''}>
                  <td className="td"><RowCheck formId="bulk-leads" id={l.id} /></td>
                  <td className="td"><Who name={l.name} sub={l.phone} href={`${list}&lead=${l.id}`} /></td>
                  <td className="td">{l.region?.name ?? '—'}</td>
                  <td className="td">{SOURCE[l.source]}</td>
                  <td className="td">
                    <StatusChip map={LEAD_STATUS} value={l.status} />
                    {l.status === 'NOT_INTERESTED' && l.notInterestedReason && <div className="mt-0.5 text-[11px] text-muted">{l.notInterestedReason}</div>}
                  </td>
                  <td className="td">{l.status === 'FOLLOW_UP' ? fmtDay(l.nextFollowUpAt) : '—'}</td>
                  <td className="td"><StatusChip map={LOCATION_STATUS} value={l.locationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <BulkBar formId="bulk-leads" action={deleteLeads} confirmText="Delete {n} leads with their calls, trials and packages? This cannot be undone." />
      {sp.new && (
        <Drawer title="Add lead" sub="Goes into Follow up with a next call date" close={list}>
          <form action={createLead} className="space-y-3.5">
            <LeadFields regions={regions} slots={st.slots} />
            <div><label className="label">First call date</label><input type="date" name="nextFollowUpAt" className="input" defaultValue={dayInput(day(0))} /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save lead</button></div>
          </form>
        </Drawer>
      )}
      {selected && (
        <Drawer title={selected.name} sub={<><StatusChip map={LEAD_STATUS} value={selected.status} /> <span className="ml-1">{selected.phone}</span></>} close={list}>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <a href={`tel:${selected.phone}`} className="btn-secondary btn-sm">Call</a>
            <Link href={`/calls?log=${selected.id}`} className="btn-secondary btn-sm">Log call</Link>
            <Link href={`/customers/${selected.id}`} className="btn-secondary btn-sm">Profile</Link>
          </div>
          <div className="mb-4">
            <span className="label">Delivery location</span>
            <div className="flex items-center gap-2.5 rounded-lg bg-s2 px-3 py-2.5 text-[13px]">
              <StatusChip map={LOCATION_STATUS} value={selected.locationStatus} />
              <span className="flex-1" />
              {selected.lat != null && <a className="font-semibold text-sky" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}>Open in Maps</a>}
              <Link className="font-semibold text-sky" href={`/leads/${selected.id}/location`}>{selected.locationStatus === 'PIN_SAVED' ? 'New link' : 'Request location'}</Link>
            </div>
          </div>
          <form action={updateLead} className="space-y-3.5">
            <input type="hidden" name="id" value={selected.id} />
            <input type="hidden" name="back" value={`${list}&lead=${selected.id}`} />
            <LeadFields lead={selected} regions={regions} slots={st.slots} />
            {selected.status === 'FOLLOW_UP' && (
              <div><label className="label">Next call date</label><input type="date" name="nextFollowUpAt" className="input" defaultValue={dayInput(selected.nextFollowUpAt)} /></div>
            )}
            <p className="text-xs text-muted">To book a trial, start a monthly pack or mark Not interested, log a call in the call register.</p>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Close</Link><button className="btn">Save</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
