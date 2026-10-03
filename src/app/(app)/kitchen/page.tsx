import { requireUser } from '@/lib/auth'
import { day, longToday } from '@/lib/dates'
import { kitchenToday } from '@/lib/queries'
import { SLOTS } from '@/lib/labels'
import { Bar, Card, Chip, Empty, PageHeader, Who } from '@/components/ui'
import { KitchenTiles } from './KitchenTiles'

// Kitchen manager screens are view only: no buttons, no forms.
export default async function KitchenDashboard() {
  await requireUser(['KITCHEN'])
  const k = await kitchenToday()
  const regions = new Map<string, { regular: number; trial: number; noPin: number }>()
  const bump = (name: string, key: 'regular' | 'trial', pinned: boolean) => {
    const r = regions.get(name) ?? { regular: 0, trial: 0, noPin: 0 }
    r[key]++
    if (!pinned) r.noPin++
    regions.set(name, r)
  }
  k.packages.forEach((p) => bump(p.lead.region?.name ?? 'No region', 'regular', p.lead.locationStatus === 'PIN_SAVED'))
  k.trials.forEach((t) => bump(t.lead.region?.name ?? 'No region', 'trial', t.lead.locationStatus === 'PIN_SAVED'))
  const rows = [...regions.entries()].sort((a, b) => b[1].regular + b[1].trial - (a[1].regular + a[1].trial))
  const slots = SLOTS.map((s) => [s, [...k.packages, ...k.trials].filter((x) => x.lead.slot === s).length] as const)
  const maxSlot = Math.max(1, ...slots.map((s) => s[1]))
  const today = day(0).getTime()
  const newOnes = k.trials.filter((t) => t.startDate.getTime() === today)
  return (
    <>
      <PageHeader title="Today's kitchen" sub={`${longToday()} · boxes to prepare`}>
        <Chip label="View only" tone="sky" />
      </PageHeader>
      <KitchenTiles k={k} />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Boxes by region</h2>
            <p className="text-[13px] text-muted">Regular and trial boxes for each delivery area</p>
          </div>
          {rows.length === 0 ? (
            <Empty>No boxes today.</Empty>
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">Region</th><th className="th">Regular</th><th className="th">Trial</th><th className="th">Total</th><th className="th">No location</th></tr></thead>
              <tbody>
                {rows.map(([name, r]) => (
                  <tr key={name}><td className="td">{name}</td><td className="td">{r.regular}</td><td className="td">{r.trial}</td><td className="td font-semibold">{r.regular + r.trial}</td><td className="td">{r.noPin}</td></tr>
                ))}
                <tr className="font-bold"><td className="td">All regions</td><td className="td">{k.packages.length}</td><td className="td">{k.trials.length}</td><td className="td">{k.total}</td><td className="td">{rows.reduce((a, [, r]) => a + r.noPin, 0)}</td></tr>
              </tbody>
            </table>
          )}
        </section>
        <div className="space-y-4">
          <Card title="Delivery slots" sub="Boxes per morning slot">
            <div className="space-y-2.5">{slots.map(([s, n]) => <Bar key={s} label={s} value={n} max={maxSlot} />)}</div>
          </Card>
          <Card title="Regular vs trial">
            <div className="space-y-2.5">
              <Bar label="Regular boxes" value={k.packages.length} max={Math.max(1, k.total)} />
              <Bar label="Trial boxes" value={k.trials.length} max={Math.max(1, k.total)} tone="warn" />
            </div>
          </Card>
          <Card title="New trials today">
            {newOnes.length === 0 ? (
              <p className="text-sm text-muted">No new trials today.</p>
            ) : (
              <div className="space-y-2.5">
                {newOnes.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5">
                    <div className="flex-1"><Who name={t.lead.name} sub={[t.lead.region?.name, t.notes].filter(Boolean).join(' · ')} /></div>
                    <Chip label="Starts today" tone="sky" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
