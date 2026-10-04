import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { CUSTOMER_COLUMNS } from '@/lib/csv'
import { db } from '@/lib/db'
import { fmtDay } from '@/lib/dates'
import { LOCATION_STATUS, PACKAGE_STATUS } from '@/lib/labels'
import { customerWhere, leadInclude } from '@/lib/queries'
import { importCustomers } from '../actions'
import { Callout, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const q = sp.q?.trim()
  const all = await db.lead.findMany({
    where: { ...customerWhere, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) },
    include: leadInclude,
    orderBy: { name: 'asc' },
  })
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
        <Link href="/customers?import=1" className="btn">Import</Link>
      </PageHeader>
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
          <Empty>No customers here.</Empty>
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
