import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay } from '@/lib/dates'
import { LOCATION_STATUS } from '@/lib/labels'
import { boxType, customerWhere, leadInclude } from '@/lib/queries'
import { Callout, Chip, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const q = sp.q?.trim()
  const all = await db.lead.findMany({
    where: { ...customerWhere, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) },
    include: leadInclude,
    orderBy: { name: 'asc' },
  })
  const regular = all.filter((l) => boxType(l) === 'Regular box')
  const trial = all.filter((l) => boxType(l) === 'Trial box')
  const missing = all.filter((l) => l.locationStatus !== 'PIN_SAVED')
  const f = sp.f ?? 'all'
  const rows = f === 'regular' ? regular : f === 'trial' ? trial : f === 'missing' ? missing : all
  const href = (k: string) => `/customers?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <>
      <PageHeader title="Customers" sub="Everyone with a trial or regular box" />
      <Callout>Locations update automatically. When a customer shares their location, the pin, address and region are saved to their profile.</Callout>
      <Tiles cols={4}>
        <Tile label="All customers" value={all.length} />
        <Tile label="Regular box" value={regular.length} sub="monthly package" tone="leaf" />
        <Tile label="Trial box" value={trial.length} sub="in trial now" tone="warn" />
        <Tile label="Location missing" value={missing.length} sub="send a location link" tone="red" />
      </Tiles>
      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs
          items={[
            { label: `All ${all.length}`, href: href('all'), active: f === 'all' },
            { label: `Regular box ${regular.length}`, href: href('regular'), active: f === 'regular' },
            { label: `Trial box ${trial.length}`, href: href('trial'), active: f === 'trial' },
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
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Box</th><th className="th">Delivery location</th><th className="th">Slot</th><th className="th">Since</th></tr></thead>
            <tbody>
              {rows.map((l) => {
                const b = boxType(l)
                const since = l.packages[0]?.startDate ?? l.trialBoxes[0]?.startDate
                return (
                  <tr key={l.id}>
                    <td className="td"><Who name={l.name} sub={l.phone} href={`/customers/${l.id}`} /></td>
                    <td className="td">{l.region?.name ?? '—'}</td>
                    <td className="td">{b && <Chip label={b} tone={b === 'Regular box' ? 'leaf' : 'warn'} />}</td>
                    <td className="td"><StatusChip map={LOCATION_STATUS} value={l.locationStatus} /></td>
                    <td className="td">{l.slot ?? '—'}</td>
                    <td className="td">{fmtDay(since)}</td>
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
