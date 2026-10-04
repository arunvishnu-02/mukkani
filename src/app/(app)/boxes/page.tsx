import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtDay, fmtRange } from '@/lib/dates'
import { LOCATION_STATUS, PACKAGE_STATUS, PACKAGES, SLOTS, rupees, TRIAL_FLOW, TRIAL_STATUS } from '@/lib/labels'
import { regionsList } from '@/lib/queries'
import { Callout, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { moveTrialAction, recordResultAction, setPackageStatusAction } from '../actions'

export default async function BoxesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'regular' ? 'regular' : 'trial'
  const [trials, packages, regions, resultFor] = await Promise.all([
    db.trialBox.findMany({
      where: { OR: [{ status: { not: 'COMPLETED' } }, { result: null }] },
      include: { lead: { include: { region: true } }, assignedTo: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    }),
    db.package.findMany({
      where: { status: { in: ['ACTIVE', 'PAUSED'] } },
      include: { lead: { include: { region: true } } },
      orderBy: { lead: { name: 'asc' } },
    }),
    regionsList(),
    sp.result ? db.trialBox.findUnique({ where: { id: sp.result }, include: { lead: true } }) : null,
  ])
  const count = (s: string) => trials.filter((t) => t.status === s).length
  return (
    <>
      <PageHeader title="Trial / Regular boxes" sub="One place for every box, from trial request to monthly package">
        <Link href="/leads" className="btn">New trial box</Link>
      </PageHeader>
      <Tabs
        items={[
          { label: `Trial boxes ${trials.length}`, href: '/boxes', active: tab === 'trial' },
          { label: `Regular boxes ${packages.length}`, href: '/boxes?tab=regular', active: tab === 'regular' },
        ]}
      />
      {tab === 'trial' ? (
        <>
          <Tiles cols={5}>
            <Tile label="Pending" value={count('PENDING') + count('ASSIGNED')} sub="waiting for kitchen" tone="warn" />
            <Tile label="Preparing" value={count('PREPARING')} tone="sky" />
            <Tile label="Delivered" value={count('DELIVERED')} tone="leaf" />
            <Tile label="Trial active" value={count('TRIAL_ACTIVE')} tone="leaf" />
            <Tile label="Completed" value={count('COMPLETED')} sub="record the result" tone="muted" />
          </Tiles>
          <section className="card overflow-x-auto">
            {trials.length === 0 ? (
              <Empty>No trial boxes. Set a lead to Trial Box Requested to create one.</Empty>
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Trial dates</th><th className="th">Status</th><th className="th">Location</th><th className="th">Action</th></tr></thead>
                <tbody>
                  {trials.map((t) => (
                    <tr key={t.id}>
                      <td className="td"><Who name={t.lead.name} sub={t.lead.phone} href={`/customers/${t.leadId}`} /></td>
                      <td className="td">{t.lead.region?.name ?? '—'}</td>
                      <td className="td">{fmtRange(t.startDate, t.endDate)}</td>
                      <td className="td"><StatusChip map={TRIAL_STATUS} value={t.status} /></td>
                      <td className="td"><StatusChip map={LOCATION_STATUS} value={t.lead.locationStatus} /></td>
                      <td className="td">
                        {t.status === 'COMPLETED' ? (
                          <Link href={`/boxes?result=${t.id}`} className="btn btn-sm">Record result</Link>
                        ) : (
                          <form action={moveTrialAction} className="flex gap-1.5">
                            <input type="hidden" name="id" value={t.id} />
                            <select name="status" defaultValue={TRIAL_FLOW[TRIAL_FLOW.indexOf(t.status) + 1]} className="input w-32 py-1.5 text-[13px]">
                              {TRIAL_FLOW.map((s) => <option key={s} value={s}>{TRIAL_STATUS[s][0]}</option>)}
                            </select>
                            <button className="btn-secondary btn-sm">Move</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <>
          <Callout tone="sky">Regular boxes are monthly package customers. Pause a box and the kitchen stops counting it from the next day.</Callout>
          <section className="card overflow-x-auto">
            {packages.length === 0 ? (
              <Empty>No regular boxes yet. Record a converted trial to add one.</Empty>
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Price</th><th className="th">Slot</th><th className="th">Since</th><th className="th">Status</th><th className="th">Change</th></tr></thead>
                <tbody>
                  {packages.map((p) => (
                    <tr key={p.id}>
                      <td className="td"><Who name={p.lead.name} sub={p.lead.phone} href={`/customers/${p.leadId}`} /></td>
                      <td className="td">{p.lead.region?.name ?? '—'}</td>
                      <td className="td">{p.packageType}</td>
                      <td className="td">{rupees(p.price)}/month</td>
                      <td className="td">{p.lead.slot ?? '—'}</td>
                      <td className="td">{fmtDay(p.startDate)}</td>
                      <td className="td"><StatusChip map={PACKAGE_STATUS} value={p.status} /></td>
                      <td className="td">
                        <form action={setPackageStatusAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <select name="status" defaultValue={p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'} className="input w-32 py-1.5 text-[13px]">
                            {Object.entries(PACKAGE_STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="btn-secondary btn-sm">Save</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      {resultFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
          <form action={recordResultAction} className="card w-full max-w-[560px] space-y-4 p-7">
            <input type="hidden" name="id" value={resultFor.id} />
            <div>
              <h2 className="font-display text-lg font-semibold">Record trial result</h2>
              <p className="text-[13px] text-muted">{resultFor.lead.name} · trial {fmtRange(resultFor.startDate, resultFor.endDate)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['CONVERTED', 'Converted', 'Becomes a monthly package customer'],
                ['NOT_CONVERTED', 'Not converted', 'Lost lead or back to follow-up'],
              ].map(([v, t, d], i) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="result" value={v} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="block rounded-[10px] border border-line p-3.5 peer-checked:border-2 peer-checked:border-brand peer-checked:bg-brand-soft">
                    <span className="block text-[15px] font-bold">{t}</span>
                    <span className="block text-xs text-muted">{d}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="text-xs font-bold tracking-wide text-muted uppercase">If converted: monthly package</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Package type</label><select name="packageType" className="input">{PACKAGES.map((p) => <option key={p.name} value={p.name}>{p.name} · {rupees(p.price)}/month</option>)}</select></div>
              <div><label className="label">Start date</label><input type="date" name="startDate" className="input" defaultValue={dayInput(day(1))} /></div>
              <div><label className="label">Delivery preference</label><select name="slot" className="input">{SLOTS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><label className="label">Region</label><select name="regionId" className="input" defaultValue={resultFor.lead.regionId ?? ''}><option value="">Keep current</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            </div>
            <div className="text-xs font-bold tracking-wide text-muted uppercase">If not converted</div>
            <select name="next" className="input"><option value="FOLLOW_UP">Back to follow-up</option><option value="LOST">Mark as Lost Lead</option></select>
            <Callout>Saving updates kitchen counts and region reports automatically.</Callout>
            <div className="flex justify-end gap-2.5"><Link href="/boxes" className="btn-secondary">Cancel</Link><button className="btn">Save result</button></div>
          </form>
        </div>
      )}
    </>
  )
}
