import Link from 'next/link'
import { db } from '@/lib/db'
import { day, dayInput, fmtDay, fmtWeekday } from '@/lib/dates'
import { CUSTOMER_STATUS, LEAD_STATUS } from '@/lib/labels'
import { customerWhere, leadInclude, runningPackages } from '@/lib/queries'
import { Drawer, Empty, PageHeader, Pills, Progress, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { BulkBar, RowCheck, SelectAll } from '@/components/Bulk'
import { deleteLeads } from '@/app/(app)/actions'
import { setCustomerStatusAction } from '@/app/(app)/kitchen/actions'
import type { Prisma } from '@/generated/prisma/client'

const TABS: [string, string, Prisma.LeadWhereInput][] = [
  ['monthly', 'Monthly pack', { status: 'MONTHLY' }],
  ['trial', 'Trial', { status: 'TRIAL' }],
  ['stopped', 'Paused / inactive', { customerStatus: { in: ['PAUSED', 'INACTIVE'] } }],
  ['all', 'All', {}],
]

// Customer list shared by sales (view, delete) and the kitchen manager (sets Active, Absent, Paused, Inactive).
export async function CustomersView({ base, sp, kitchen }: { base: string; sp: Record<string, string | undefined>; kitchen: boolean }) {
  const tab = TABS.find((t) => t[0] === sp.tab) ?? TABS[0]
  const q = sp.q?.trim()
  const today = day(0)
  const where: Prisma.LeadWhereInput = { AND: [customerWhere, tab[2], q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}] }
  const [leads, running, absentToday, counts, selected] = await Promise.all([
    db.lead.findMany({ where, include: leadInclude, orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }], take: 500 }),
    runningPackages(today),
    db.attendance.findMany({ where: { date: today, status: 'ABSENT' }, select: { leadId: true } }),
    Promise.all(TABS.map((t) => db.lead.count({ where: { AND: [customerWhere, t[2]] } }))),
    sp.status ? db.lead.findUnique({ where: { id: sp.status } }) : null,
  ])
  const plans = new Map(running.map((r) => [r.pkg.leadId, r]))
  const absent = new Set(absentToday.map((a) => a.leadId))
  const status = (l: { id: string; customerStatus: string; pausedUntil: Date | null }) =>
    l.customerStatus === 'INACTIVE' ? 'INACTIVE' : l.customerStatus === 'PAUSED' && (!l.pausedUntil || l.pausedUntil >= today) ? 'PAUSED' : absent.has(l.id) ? 'ABSENT' : 'ACTIVE'
  const list = `${base}?tab=${tab[0]}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const active = running.filter((r) => r.pkg.lead.customerStatus === 'ACTIVE').length
  return (
    <>
      <PageHeader title="Customers" sub={kitchen ? 'Set each customer Active, Absent, Paused or Inactive. Absent and Paused push the end date.' : 'Everyone with a trial or a monthly pack'} />
      <Tiles cols={4}>
        <Tile label="Monthly customers" value={running.length} sub={`${active} active`} tone="leaf" />
        <Tile label="Absent today" value={absent.size} sub="end date moves forward" tone="warn" />
        <Tile label="Paused" value={running.filter((r) => r.pkg.lead.customerStatus === 'PAUSED').length} sub="stopped for some days" tone="sky" />
        <Tile label="Ending this week" value={running.filter((r) => r.plan.end && r.plan.end <= day(6)).length} sub="renewal call on day 26" tone="brand" />
      </Tiles>
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs items={TABS.map(([k, l], i) => ({ label: `${l} ${counts[i]}`, href: `${base}?tab=${k}`, active: tab[0] === k }))} />
        <div className="flex-1" />
        <form action={base} className="w-full sm:w-60">
          <input type="hidden" name="tab" value={tab[0]} />
          <input name="q" defaultValue={q} placeholder="Search name or phone" className="input py-2" />
        </form>
      </div>
      <section className="card overflow-x-auto">
        {leads.length === 0 ? (
          <Empty>No customers here.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {!kitchen && <th className="th w-10"><SelectAll formId="bulk-customers" /></th>}
                <th className="th">Customer</th><th className="th">Region</th><th className="th">Time</th><th className="th">Package</th><th className="th">Last day</th><th className="th">Foods to avoid</th><th className="th">Status</th>
                {kitchen && <th className="th">Change</th>}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const r = plans.get(l.id)
                const trial = l.trialBoxes[0]
                return (
                  <tr key={l.id}>
                    {!kitchen && <td className="td"><RowCheck formId="bulk-customers" id={l.id} /></td>}
                    <td className="td"><Who name={l.name} sub={l.phone} href={`/customers/${l.id}`} /></td>
                    <td className="td">{l.region?.name ?? '—'}</td>
                    <td className="td whitespace-nowrap">{l.deliveryTime ?? l.slot ?? '—'}</td>
                    <td className="td">
                      {r ? (
                        <div className="w-36">
                          <div className="mb-1 text-xs font-semibold">Month {r.pkg.number} · {r.plan.delivered}/26{r.pkg.buttermilkQty ? ' · BM' : ''}</div>
                          <Progress value={r.plan.delivered} max={26} />
                        </div>
                      ) : trial && l.status === 'TRIAL' ? (
                        <span className="text-[13px]">Trial {fmtWeekday(trial.deliveryDate)}</span>
                      ) : (
                        <StatusChip map={LEAD_STATUS} value={l.status} />
                      )}
                    </td>
                    <td className="td whitespace-nowrap">{r ? (r.plan.end ? fmtWeekday(r.plan.end) : 'Paused') : '—'}</td>
                    <td className="td max-w-48 text-muted">{[l.avoidFoods, l.healthNotes].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="td"><StatusChip map={CUSTOMER_STATUS} value={status(l)} /></td>
                    {kitchen && <td className="td"><Link href={`${list}&status=${l.id}`} scroll={false} className="btn-secondary btn-sm">Set status</Link></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      {!kitchen && <BulkBar formId="bulk-customers" action={deleteLeads} confirmText="Delete {n} customers with all their packages, attendance and calls? This cannot be undone." />}
      {kitchen && selected && (
        <Drawer title={selected.name} sub={`${selected.phone} · now ${CUSTOMER_STATUS[status(selected)][0]}`} close={list}>
          <form action={setCustomerStatusAction} className="space-y-4">
            <input type="hidden" name="leadId" value={selected.id} />
            <input type="hidden" name="back" value={list} />
            <div>
              <span className="label">Status *</span>
              <Pills name="status" required value={selected.customerStatus} options={[['ACTIVE', 'Active'], ['ABSENT', 'Absent (one day)'], ['PAUSED', 'Paused'], ['INACTIVE', 'Inactive']]} tones={{ ACTIVE: 'leaf', ABSENT: 'warn', PAUSED: 'sky', INACTIVE: 'red' }} />
            </div>
            <div><label className="label">Date (Absent: the day off · Paused: back on)</label><input type="date" name="date" className="input" defaultValue={dayInput(selected.pausedUntil ?? day(1))} /></div>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
              <li>Absent: off for that one day. The end date moves one delivery day forward.</li>
              <li>Paused: off until the date. Leave the date empty to pause until further notice.</li>
              <li>Inactive: stopped for good. The package stops.</li>
            </ul>
            <div className="rounded-lg bg-s2 px-3 py-2.5 text-[13px]">
              <div><span className="font-semibold">Foods to avoid:</span> {selected.avoidFoods ?? '—'}</div>
              <div><span className="font-semibold">Health:</span> {selected.healthNotes ?? '—'}</div>
              <div><span className="font-semibold">Address:</span> {selected.address ?? '—'}</div>
              <div><span className="font-semibold">Since:</span> {fmtDay(selected.createdAt)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save</button></div>
            <Link href={`/customers/${selected.id}`} className="block text-center text-[13px] font-semibold text-sky">Open full profile</Link>
          </form>
        </Drawer>
      )}
    </>
  )
}
