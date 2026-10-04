import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { dayInput, day, fmtDay } from '@/lib/dates'
import { LEAD_STATUS, LOCATION_STATUS, PACKAGE_TYPES, SLOTS } from '@/lib/labels'
import { leadInclude, regionsList } from '@/lib/queries'
import { Empty, PageHeader, StatusChip, Tabs, Who } from '@/components/ui'
import { StatusFields } from '@/components/StatusFields'
import { createLead, updateLead } from '../actions'
import type { Prisma } from '@/generated/prisma/client'
import type { LeadStatus } from '@/generated/prisma/enums'

const FILTERS: [string, string, LeadStatus[] | null][] = [
  ['all', 'All', null],
  ['new', 'New', ['NEW']],
  ['contacted', 'Contacted', ['CONTACTED']],
  ['follow', 'Follow-up', ['FOLLOW_UP']],
  ['trial', 'Trial', ['TRIAL_REQUESTED', 'TRIAL_ACTIVE']],
  ['converted', 'Converted', ['CONVERTED']],
  ['lost', 'Lost', ['LOST', 'NOT_INTERESTED']],
]

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const f = FILTERS.find((x) => x[0] === sp.f) ?? FILTERS[0]
  const q = sp.q?.trim()
  const where: Prisma.LeadWhereInput = {
    ...(f[2] ? { status: { in: f[2] } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
  }
  const [leads, counts, regions, selected] = await Promise.all([
    db.lead.findMany({ where, include: leadInclude, orderBy: { updatedAt: 'desc' }, take: 200 }),
    db.lead.groupBy({ by: ['status'], _count: true }),
    regionsList(),
    sp.lead ? db.lead.findUnique({ where: { id: sp.lead }, include: leadInclude }) : null,
  ])
  const c = Object.fromEntries(counts.map((r) => [r.status, r._count])) as Record<string, number>
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  const qs = (k: string) => `/leads?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const panel = sp.new ? 'new' : selected ? 'edit' : null
  return (
    <>
      <PageHeader title="Leads" sub={`${total} leads`}>
        <Link href="/leads?new=1" className="btn">Add lead</Link>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs items={FILTERS.map(([k, label, st]) => ({ label: `${label} ${st ? st.reduce((a, s) => a + (c[s] ?? 0), 0) : total}`, href: qs(k), active: f[0] === k }))} />
        <div className="flex-1" />
        <form action="/leads" className="w-full sm:w-60">
          <input type="hidden" name="f" value={f[0]} />
          <input name="q" defaultValue={q} placeholder="Search name or phone" className="input py-2" />
        </form>
      </div>
      <div className={`grid items-start gap-4 ${panel ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        <section className="card overflow-x-auto">
          {leads.length === 0 ? (
            <Empty>No leads here yet.</Empty>
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Location</th><th className="th">Health issues</th><th className="th">Status</th><th className="th">Next call</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className={l.id === selected?.id ? 'bg-brand-soft/60' : ''}>
                    <td className="td"><Who name={l.name} sub={l.phone} href={`${qs(f[0])}&lead=${l.id}`} /></td>
                    <td className="td">{l.region?.name ?? '—'}</td>
                    <td className="td">{l.foodNotes ?? '—'}</td>
                    <td className="td"><StatusChip map={LEAD_STATUS} value={l.status} /></td>
                    <td className="td">{fmtDay(l.nextFollowUpAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {panel === 'new' && (
          <form action={createLead} className="card space-y-3.5 border-brand p-5.5 lg:sticky lg:top-4">
            <h2 className="font-display text-lg font-semibold">Add lead</h2>
            <div><label className="label">Name</label><input name="name" className="input" required /></div>
            <div><label className="label">Phone number</label><input name="phone" className="input" inputMode="tel" required /></div>
            <div>
              <label className="label">Location</label>
              <select name="regionId" className="input"><option value="">Area not set</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <input name="address" className="input mt-2" placeholder="Address, or send a location link after saving" />
            </div>
            <div><label className="label">Health issues</label><input name="foodNotes" className="input" placeholder="Diabetes, BP, allergy, food to avoid" /></div>
            <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href="/leads" className="btn-secondary">Cancel</Link><button className="btn">Save lead</button></div>
          </form>
        )}
        {panel === 'edit' && selected && (
          <form key={selected.id} action={updateLead} className="card space-y-3.5 border-brand p-5.5 lg:sticky lg:top-4">
            <input type="hidden" name="id" value={selected.id} />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold">Update lead</h2>
                <p className="text-[13px] text-muted">{selected.name} · {selected.phone}</p>
              </div>
              <a href={`tel:${selected.phone}`} className="btn-secondary btn-sm">Call</a>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label">Name</label><input name="name" className="input" defaultValue={selected.name} required /></div>
              <div><label className="label">Phone number</label><input name="phone" className="input" inputMode="tel" defaultValue={selected.phone} required /></div>
            </div>
            <StatusFields
              options={Object.entries(LEAD_STATUS).map(([v, [l]]) => [v, l])}
              value={selected.status}
              start={dayInput(day(1))}
              end={dayInput(day(7))}
              packageTypes={PACKAGE_TYPES}
              slots={SLOTS}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="label">Location</label>
                <select name="regionId" className="input" defaultValue={selected.regionId ?? ''}><option value="">Not set</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              </div>
              <div><label className="label">Next follow-up</label><input type="date" name="nextFollowUpAt" className="input" defaultValue={dayInput(selected.nextFollowUpAt)} /></div>
            </div>
            <div>
              <span className="label">Delivery location</span>
              <div className="flex items-center gap-2.5 rounded-lg bg-s2 px-3 py-2.5 text-[13px]">
                <StatusChip map={LOCATION_STATUS} value={selected.locationStatus} />
                <span className="flex-1" />
                {selected.lat != null && <a className="font-semibold text-sky" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}>Open in Maps</a>}
                <Link className="font-semibold text-sky" href={`/leads/${selected.id}/location`}>{selected.locationStatus === 'PIN_SAVED' ? 'New link' : 'Request location'}</Link>
              </div>
            </div>
            <div><label className="label">Address</label><input name="address" className="input" defaultValue={selected.address ?? ''} /></div>
            <div><label className="label">Health issues</label><input name="foodNotes" className="input" defaultValue={selected.foodNotes ?? ''} /></div>
            <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" defaultValue={selected.notes ?? ''} /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={qs(f[0])} className="btn-secondary">Close</Link><button className="btn">Save</button></div>
            {selected.packages[0] ? (
              <Link href={`/customers/${selected.id}`} className="block text-center text-[13px] font-semibold text-sky">Open customer profile</Link>
            ) : null}
          </form>
        )}
      </div>
    </>
  )
}
