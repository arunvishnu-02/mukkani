import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { CUSTOMER_COLUMNS } from '@/lib/csv'
import { db } from '@/lib/db'
import { fmtDay } from '@/lib/dates'
import { day, dayInput } from '@/lib/dates'
import { LOCATION_STATUS, PACKAGE_STATUS, SLOTS } from '@/lib/labels'
import { customerWhere, leadInclude, regionsList } from '@/lib/queries'
import { createCustomer, importCustomers } from '../actions'
import { Callout, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const q = sp.q?.trim()
  const [all, regions] = await Promise.all([db.lead.findMany({
    where: { ...customerWhere, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) },
    include: leadInclude,
    orderBy: { name: 'asc' },
  }), sp.new ? regionsList() : []])
  const regular = all.filter((l) => l.packages[0]?.status === 'ACTIVE')
  const paused = all.filter((l) => l.packages[0]?.status === 'PAUSED')
  const missing = all.filter((l) => l.locationStatus !== 'PIN_SAVED')
  const f = sp.f ?? 'all'
  const rows = f === 'regular' ? regular : f === 'paused' ? paused : f === 'missing' ? missing : all
  const href = (k: string) => `/customers?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <>
      <PageHeader title="Customers" sub="Converted leads with a monthly package">
        <a href="/customers/export" download className="btn-secondary">Export</a>
        <Link href="/customers?import=1" className="btn-secondary">Import</Link>
        <Link href="/customers?new=1" className="btn">Add customer</Link>
      </PageHeader>
      {sp.new && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4">
          <form action={createCustomer} className="card w-full max-w-[560px] space-y-3.5 p-7">
            <div>
              <h2 className="font-display text-lg font-semibold">Add customer</h2>
              <p className="text-[13px] text-muted">For someone starting the monthly package right away, without a trial.</p>
            </div>
            {sp.error === 'phone' && (
              <Callout tone="red">This phone number is already in the CRM. <Link href={`/leads?lead=${sp.lead}`} className="font-semibold text-sky">Open that person</Link> and set the status to Monthly Package Converted.</Callout>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input name="name" className="input" required /></div>
              <div><label className="label">Phone number</label><input name="phone" className="input" inputMode="tel" required /></div>
            </div>
            <div>
              <label className="label">Location</label>
              <select name="regionId" className="input"><option value="">Area not set</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <input name="address" className="input mt-2" placeholder="Address, or send a location link after saving" />
            </div>
            <div><label className="label">Health issues</label><input name="foodNotes" className="input" placeholder="Diabetes, BP, allergy, food to avoid" /></div>
            <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Start date</label><input type="date" name="startDate" className="input" defaultValue={dayInput(day(0))} /></div>
              <div><label className="label">Delivery slot</label><select name="slot" className="input">{SLOTS.map((p) => <option key={p}>{p}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2.5"><Link href="/customers" className="btn-secondary">Cancel</Link><button className="btn">Save customer</button></div>
          </form>
        </div>
      )}
      {sp.added != null && (
        <Callout tone={Number(sp.added) > 0 ? 'leaf' : 'warn'}>
          {sp.added} customers imported.
          {Number(sp.skipped) > 0 && ` ${sp.skipped} skipped because the phone number is already in the CRM.`}
          {Number(sp.invalid) > 0 && ` ${sp.invalid} rows left out: name or phone missing.`}
        </Callout>
      )}
      {sp.import && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4">
          <form action={importCustomers} className="card w-full max-w-[560px] space-y-4 p-7">
            <div>
              <h2 className="font-display text-lg font-semibold">Import customers</h2>
              <p className="text-[13px] text-muted">Upload a CSV file. Fill it in Excel or Google Sheets and save as CSV.</p>
            </div>
            {sp.error && <Callout tone="red">{sp.error === 'columns' ? 'This file has no Name and Phone columns. Use the sample file as the format.' : 'Choose a CSV file first.'}</Callout>}
            <div className="rounded-[10px] bg-s2 p-3.5 text-[13px] leading-[19px]">
              <div className="font-semibold">Columns, in the first row of the file</div>
              <div className="mt-1 text-muted">{CUSTOMER_COLUMNS.join(', ')}</div>
              <ul className="mt-2 list-disc space-y-0.5 pl-4.5 text-muted">
                <li>Name and Phone are needed. The rest can be empty.</li>
                <li>Location is a region name, like Srirangam.</li>
                <li>Start date as 2026-10-04 or 04/10/2026. Status is Active or Paused.</li>
                <li>A phone number already in the CRM is skipped, never added twice.</li>
              </ul>
              <a href="/customers/export?sample=1" download className="mt-2.5 inline-block font-semibold text-sky">Download sample file</a>
            </div>
            <input type="file" name="file" accept=".csv,text/csv" required className="input" />
            <div className="flex justify-end gap-2.5"><Link href="/customers" className="btn-secondary">Cancel</Link><button className="btn">Import</button></div>
          </form>
        </div>
      )}
      <Callout>Locations update automatically. When a customer shares their location, the pin, address and region are saved to their profile.</Callout>
      <Tiles cols={4}>
        <Tile label="All customers" value={all.length} />
        <Tile label="Regular box" value={regular.length} sub="monthly package" tone="leaf" />
        <Tile label="Paused" value={paused.length} sub="not delivering now" tone="warn" />
        <Tile label="Location missing" value={missing.length} sub="send a location link" tone="red" />
      </Tiles>
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs
          items={[
            { label: `All ${all.length}`, href: href('all'), active: f === 'all' },
            { label: `Regular box ${regular.length}`, href: href('regular'), active: f === 'regular' },
            { label: `Paused ${paused.length}`, href: href('paused'), active: f === 'paused' },
            { label: `Location missing ${missing.length}`, href: href('missing'), active: f === 'missing' },
          ]}
        />
        <div className="flex-1" />
        <form action="/customers" className="w-full sm:w-60">
          <input type="hidden" name="f" value={f} />
          <input name="q" defaultValue={q} placeholder="Search name or phone" className="input py-2" />
        </form>
      </div>
      <section className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No customers here. Use Add customer, Import, or convert a lead.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Delivery location</th><th className="th">Slot</th><th className="th">Since</th></tr></thead>
            <tbody>
              {rows.map((l) => {
                const p = l.packages[0]
                return (
                  <tr key={l.id}>
                    <td className="td"><Who name={l.name} sub={l.phone} href={`/customers/${l.id}`} /></td>
                    <td className="td">{l.region?.name ?? '—'}</td>
                    <td className="td">{p && <StatusChip map={PACKAGE_STATUS} value={p.status} />}</td>
                    <td className="td"><StatusChip map={LOCATION_STATUS} value={l.locationStatus} /></td>
                    <td className="td">{l.slot ?? '—'}</td>
                    <td className="td">{fmtDay(p?.startDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
