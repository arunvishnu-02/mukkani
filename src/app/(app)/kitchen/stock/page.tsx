import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday } from '@/lib/dates'
import { appSettings } from '@/lib/settings'
import { stockToday } from '@/lib/stock'
import { Callout, Card, Chip, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { addStockAction, deleteStockAction } from '../actions'

// Record the fruit that comes in and see what is left at the end of each day.
export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const tab = sp.tab === 'week' ? 'week' : 'today'
  const today = day(0)
  const st = await appSettings()
  const [rows, entries, sheetBoxes] = await Promise.all([
    stockToday(today, st.fruits, st.lowStockKg),
    db.stockEntry.findMany({ where: { date: { gte: tab === 'week' ? day(-6) : today } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    db.attendance.count({ where: { date: today, status: 'DELIVERED' } }),
  ])
  const cameIn = rows.reduce((a, r) => a + r.cameIn, 0)
  const used = rows.reduce((a, r) => a + r.used, 0)
  const back = `/kitchen/stock${tab === 'week' ? '?tab=week' : ''}`
  const r1 = (n: number) => Math.round(n * 10) / 10
  return (
    <>
      <PageHeader title="Fruit stock" crumb="Stock" sub="Record the fruit that comes in and see what is left at the end of each day.">
        <Tabs items={[{ label: 'Today', href: '/kitchen/stock', active: tab === 'today' }, { label: 'This week', href: '/kitchen/stock?tab=week', active: tab === 'week' }]} />
      </PageHeader>
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="Fruits in stock" value={rows.filter((r) => r.left > 0).length} sub="items tracked" />
        <Tile label="Low stock" value={rows.filter((r) => r.low).length} sub={`under ${st.lowStockKg} kg · order before tomorrow`} tone="red" />
        <Tile label="Came in today" value={`${r1(cameIn)} kg`} tone="leaf" />
        <Tile label="Used today" value={`${r1(used)} kg`} sub={sheetBoxes ? `cut for ${sheetBoxes} boxes` : undefined} />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="card overflow-x-auto">
            <div className="px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Stock today · {fmtWeekday(today)}</h2>
              <p className="text-[13px] text-muted">Left = opening + came in - used - wastage (kg)</p>
            </div>
            <table className="w-full">
              <thead><tr><th className="th">Fruit</th><th className="th">Opening</th><th className="th">Came in</th><th className="th">Used</th><th className="th">Wastage</th><th className="th">Left</th><th className="th">Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.fruit} className={r.low ? 'bg-red-soft/60' : ''}>
                    <td className="td font-semibold">{r.fruit}</td><td className="td">{r.opening}</td><td className="td">{r.cameIn ? `+${r.cameIn}` : '–'}</td><td className="td">{r.used || '–'}</td><td className="td">{r.wastage || '–'}</td><td className="td font-bold">{r.left}</td>
                    <td className="td">{r.low ? <Chip label="Low" tone="red" /> : <Chip label="OK" tone="leaf" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card overflow-x-auto">
            <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Entries {tab === 'week' ? 'this week' : 'today'}</h2></div>
            {entries.length === 0 ? <Empty>No entries yet.</Empty> : (
              <table className="w-full">
                <thead><tr><th className="th">Date</th><th className="th">Fruit</th><th className="th">Type</th><th className="th">Kg</th><th className="th">Note</th><th className="th"></th></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="td">{fmtWeekday(e.date)}</td><td className="td font-semibold">{e.fruit}</td>
                      <td className="td">{e.kind === 'IN' ? <Chip label="Came in" tone="leaf" /> : <Chip label="Used" tone="sky" />}</td>
                      <td className="td">{e.qtyKg}</td><td className="td text-muted">{e.note ?? '—'}</td>
                      <td className="td">
                        <form action={deleteStockAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="back" value={back} /><button className="text-[13px] font-semibold text-red">Remove</button></form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <Card title="Add stock" sub="When fruit arrives, or what was cut for the boxes">
            <form action={addStockAction} className="space-y-3.5">
              <input type="hidden" name="back" value={back} />
              <div><span className="label">Type</span><Pills name="kind" value="IN" options={[['IN', 'Came in'], ['USED', 'Used for boxes']]} /></div>
              <div><label className="label">Fruit *</label><select name="fruit" className="input" required>{st.fruits.map((f) => <option key={f}>{f}</option>)}</select></div>
              <div><label className="label">Quantity (kg) *</label><input name="qtyKg" type="number" step="0.1" min="0" required className="input" /></div>
              <div><label className="label">Date</label><input name="date" type="date" className="input" defaultValue={dayInput(today)} /></div>
              <div><label className="label">Note</label><input name="note" className="input" placeholder="For example: from Gandhi Market" /></div>
              <button className="btn w-full">Save</button>
            </form>
          </Card>
          <Callout tone="brand">Prices and bills are added by admin in Purchase + expenses. The kitchen enters only quantities.</Callout>
        </div>
      </div>
    </>
  )
}
