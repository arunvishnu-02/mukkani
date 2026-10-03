import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { LOCATION_STATUS, PACKAGE_STATUS } from '@/lib/labels'
import { kitchenToday } from '@/lib/queries'
import { Chip, Empty, PageHeader, StatusChip, Who } from '@/components/ui'
import { KitchenTiles } from '../KitchenTiles'

export default async function KitchenMonthly() {
  await requireUser(['KITCHEN'])
  const [k, packages] = await Promise.all([
    kitchenToday(),
    db.package.findMany({ where: { status: { in: ['ACTIVE', 'PAUSED'] } }, include: { lead: { include: { region: true } } }, orderBy: { lead: { name: 'asc' } } }),
  ])
  return (
    <>
      <PageHeader title="Monthly customers" sub="Regular box customers and their delivery details">
        <Chip label="View only" tone="sky" />
      </PageHeader>
      <KitchenTiles k={k} />
      <section className="card overflow-x-auto">
        {packages.length === 0 ? (
          <Empty>No monthly customers yet.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Slot</th><th className="th">Status</th><th className="th">Location</th><th className="th">Food notes</th></tr></thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id}>
                  <td className="td"><Who name={p.lead.name} /></td>
                  <td className="td">{p.lead.region?.name ?? '—'}</td>
                  <td className="td">{p.packageType}</td>
                  <td className="td">{p.lead.slot ?? '—'}</td>
                  <td className="td"><StatusChip map={PACKAGE_STATUS} value={p.status} /></td>
                  <td className="td"><StatusChip map={LOCATION_STATUS} value={p.lead.locationStatus} /></td>
                  <td className="td">{p.lead.foodNotes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
