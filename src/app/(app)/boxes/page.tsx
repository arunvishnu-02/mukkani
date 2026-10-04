import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtDay, fmtRange } from '@/lib/dates'
import { LOCATION_STATUS, PACKAGE_STATUS, PACKAGE_TYPES, SLOTS } from '@/lib/labels'
import { regionsList } from '@/lib/queries'
import { Callout, Chip, Empty, PageHeader, StatusChip, Tabs, Who } from '@/components/ui'
import { ConfirmButton } from '@/components/ConfirmButton'
import { recordResultAction, setPackageStatusAction } from '../actions'

export default async function BoxesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'regular' || sp.tab === 'paused' ? sp.tab : 'trial'
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
  const today = day(0)
  const regular = packages.filter((p) => p.status === 'ACTIVE')
  const paused = packages.filter((p) => p.status === 'PAUSED')
  const rows = tab === 'paused' ? paused : regular
  return (
    <>
      <PageHeader title="Trial / Regular boxes" sub="One place for every box, from trial request to monthly package">
        <Link href="/leads" className="btn">New trial box</Link>
      </PageHeader>
      <Tabs
        items={[
          { label: `Trial boxes ${trials.length}`, href: '/boxes', active: tab === 'trial' },
          { label: `Regular boxes ${regular.length}`, href: '/boxes?tab=regular', active: tab === 'regular' },
          { label: `Paused ${paused.length}`, href: '/boxes?tab=paused', active: tab === 'paused' },
        ]}
      />
      {tab === 'trial' ? (
        <>
          <Callout tone="warn">Call every trial customer during the trial and log the call. After the trial, choose Convert to regular to start the monthly package, or No need if the customer does not want it.</Callout>
          <section className="card overflow-x-auto">
            {trials.length === 0 ? (
              <Empty>No trial boxes. Set a lead to Trial Box Requested to create one.</Empty>
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Trial dates</th><th className="th">Follow-up</th><th className="th">Location</th><th className="th">Action</th></tr></thead>
                <tbody>
                  {trials.map((t) => (
                    <tr key={t.id}>
                      <td className="td"><Who name={t.lead.name} sub={t.lead.phone} href={`/customers/${t.leadId}`} /></td>
                      <td className="td">{t.lead.region?.name ?? '—'}</td>
                      <td className="td">{fmtRange(t.startDate, t.endDate)}</td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {!t.lead.nextFollowUpAt || t.lead.nextFollowUpAt <= today ? (
                            <Chip label={!t.lead.nextFollowUpAt ? 'Call now' : t.lead.nextFollowUpAt < today ? `Overdue ${fmtDay(t.lead.nextFollowUpAt)}` : 'Call today'} tone="red" />
                          ) : (
                            <span className="whitespace-nowrap">{fmtDay(t.lead.nextFollowUpAt)}</span>
                          )}
                          <Link href={`/follow-ups?log=${t.leadId}&from=boxes`} className="btn-secondary btn-sm whitespace-nowrap">Log call</Link>
                        </div>
                      </td>
                      <td className="td"><StatusChip map={LOCATION_STATUS} value={t.lead.locationStatus} /></td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          <Link href={`/boxes?result=${t.id}`} className="btn btn-sm whitespace-nowrap">Convert to regular</Link>
                          <form action={recordResultAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="result" value="NOT_CONVERTED" />
                            <input type="hidden" name="next" value="LOST" />
                            <ConfirmButton message={`${t.lead.name} does not need a regular box? The trial is closed and the lead is marked Lost.`} className="btn-secondary btn-sm whitespace-nowrap">No need</ConfirmButton>
                          </form>
                        </div>
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
          {tab === 'regular' ? (
            <Callout tone="sky">Regular boxes are monthly package customers. Pause a box and it moves to Paused; the kitchen stops counting it.</Callout>
          ) : (
            <Callout tone="warn">Paused customers are not counted by the kitchen. Set a box to Active and it moves back to Regular boxes.</Callout>
          )}
          <section className="card overflow-x-auto">
            {rows.length === 0 ? (
              <Empty>{tab === 'paused' ? 'No paused boxes.' : 'No regular boxes yet. Record a converted trial to add one.'}</Empty>
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Slot</th><th className="th">Since</th><th className="th">Status</th><th className="th">Change</th></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="td"><Who name={p.lead.name} sub={p.lead.phone} href={`/customers/${p.leadId}`} /></td>
                      <td className="td">{p.lead.region?.name ?? '—'}</td>
                      <td className="td">{p.packageType}</td>
                      <td className="td">{p.lead.slot ?? '—'}</td>
                      <td className="td">{fmtDay(p.startDate)}</td>
                      <td className="td"><StatusChip map={PACKAGE_STATUS} value={p.status} /></td>
                      <td className="td">
                        <form action={setPackageStatusAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value={`/boxes?tab=${tab}`} />
                          <select name="status" defaultValue={p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'} className="input w-32 py-1.5 text-[13px]">
                            {(['ACTIVE', 'PAUSED', 'CANCELLED'] as const).map((v) => <option key={v} value={v}>{PACKAGE_STATUS[v][0]}</option>)}
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
            <input type="hidden" name="result" value="CONVERTED" />
            <div>
              <h2 className="font-display text-lg font-semibold">Convert to regular box</h2>
              <p className="text-[13px] text-muted">{resultFor.lead.name} · trial {fmtRange(resultFor.startDate, resultFor.endDate)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Package type</label><select name="packageType" className="input">{PACKAGE_TYPES.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><label className="label">Start date</label><input type="date" name="startDate" className="input" defaultValue={dayInput(day(1))} /></div>
              <div><label className="label">Delivery preference</label><select name="slot" className="input">{SLOTS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><label className="label">Region</label><select name="regionId" className="input" defaultValue={resultFor.lead.regionId ?? ''}><option value="">Keep current</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            </div>
            <Callout>Saving moves this customer to Regular boxes and updates the kitchen counts.</Callout>
            <div className="flex justify-end gap-2.5"><Link href="/boxes" className="btn-secondary">Cancel</Link><button className="btn">Convert</button></div>
          </form>
        </div>
      )}
    </>
  )
}
