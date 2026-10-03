import { requireUser } from '@/lib/auth'
import { fmtRange } from '@/lib/dates'
import { LOCATION_STATUS } from '@/lib/labels'
import { kitchenToday } from '@/lib/queries'
import { Chip, Empty, PageHeader, StatusChip, Tabs, Who } from '@/components/ui'
import { KitchenTiles } from '../KitchenTiles'

// One simple list of today's boxes. Each row says Trial box or Regular box. View only.
export default async function KitchenBoxes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const type = sp.type === 'trial' || sp.type === 'regular' ? sp.type : 'all'
  const k = await kitchenToday()
  const rows = [
    ...k.trials.map((t) => ({ id: t.id, lead: t.lead, kind: 'Trial box' as const, dates: fmtRange(t.startDate, t.endDate), notes: t.notes ?? t.lead.foodNotes })),
    ...k.packages.map((p) => ({ id: p.id, lead: p.lead, kind: 'Regular box' as const, dates: 'Monthly', notes: p.lead.foodNotes })),
  ]
    .filter((r) => type === 'all' || (type === 'trial') === (r.kind === 'Trial box'))
    .sort((a, b) => a.lead.name.localeCompare(b.lead.name))
  return (
    <>
      <PageHeader title="Today's boxes" sub="Every box to prepare, trial and regular">
        <Chip label="View only" tone="sky" />
      </PageHeader>
      <KitchenTiles k={k} />
      <Tabs
        items={[
          { label: `All ${k.total}`, href: '/kitchen/boxes', active: type === 'all' },
          { label: `Trial ${k.trials.length}`, href: '/kitchen/boxes?type=trial', active: type === 'trial' },
          { label: `Regular ${k.packages.length}`, href: '/kitchen/boxes?type=regular', active: type === 'regular' },
        ]}
      />
      <section className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No boxes today.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Box</th><th className="th">Dates</th><th className="th">Slot</th><th className="th">Food notes</th><th className="th">Location</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td"><Who name={r.lead.name} sub={r.lead.phone} /></td>
                  <td className="td">{r.lead.region?.name ?? '—'}</td>
                  <td className="td"><Chip label={r.kind} tone={r.kind === 'Trial box' ? 'warn' : 'leaf'} /></td>
                  <td className="td">{r.dates}</td>
                  <td className="td">{r.lead.slot ?? '—'}</td>
                  <td className="td">{r.notes ?? '—'}</td>
                  <td className="td">
                    {r.lead.lat != null ? (
                      <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.lead.lat},${r.lead.lng}`}><StatusChip map={LOCATION_STATUS} value={r.lead.locationStatus} /></a>
                    ) : (
                      <StatusChip map={LOCATION_STATUS} value={r.lead.locationStatus} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
