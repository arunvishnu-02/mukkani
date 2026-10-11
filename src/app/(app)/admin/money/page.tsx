import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday } from '@/lib/dates'
import { MONEY_CATEGORIES, rupees } from '@/lib/labels'
import { period } from '@/lib/report'
import { Chip, Drawer, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { BulkBar, RowCheck, SelectAll } from '@/components/Bulk'
import { BillPhotos } from '@/components/BillPhotos'
import { deleteMoneyEntries } from '../actions'

const MAX_BILLS = 6

// Purchase and expense entries with the bill photo (admin only).
export default async function Money({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const p = period(sp.period === 'week' ? 'week' : 'month')
  const type = sp.type === 'PURCHASE' || sp.type === 'EXPENSE' ? sp.type : null
  const entries = await db.moneyEntry.findMany({
    where: { date: { gte: p.from, lt: p.to }, ...(type ? { type } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  const all = type ? await db.moneyEntry.findMany({ where: { date: { gte: p.from, lt: p.to } }, select: { type: true, amount: true } }) : entries
  const sum = (t: string) => all.filter((e) => e.type === t).reduce((a, e) => a + e.amount, 0)
  const qs = (o: Record<string, string | null>) => {
    const u = new URLSearchParams()
    const m = { period: sp.period ?? null, type, ...o }
    for (const [k, v] of Object.entries(m)) if (v) u.set(k, v)
    const s = u.toString()
    return `/admin/money${s ? `?${s}` : ''}`
  }
  const back = qs({})
  const edit = sp.edit ? entries.find((e) => e.id === sp.edit) ?? (await db.moneyEntry.findUnique({ where: { id: sp.edit } })) : null
  const mimes = edit?.billIds.length ? await db.upload.findMany({ where: { id: { in: edit.billIds } }, select: { id: true, mime: true } }) : []
  const bills = (edit?.billIds ?? []).map((id) => ({ id, isImage: mimes.find((m) => m.id === id)?.mime.startsWith('image/') ?? true }))
  const open = sp.add === '1' || !!edit
  const self = edit ? qs({ edit: edit.id }) : qs({ add: '1' })
  return (
    <>
      <PageHeader title="Purchase + expenses" crumb="Business" sub="Everything bought or paid for, with the bill photo. Only admin sees this.">
        <Tabs items={[{ label: 'This month', href: qs({ period: null }), active: p.kind === 'month' }, { label: 'This week', href: qs({ period: 'week' }), active: p.kind === 'week' }]} />
        <Link href={qs({ add: '1' })} className="btn">Add entry</Link>
      </PageHeader>
      <ErrorNote error={open ? undefined : sp.error} />
      <Tiles cols={4}>
        <Tile label="Purchases" value={rupees(sum('PURCHASE'))} sub={p.label} />
        <Tile label="Expenses" value={rupees(sum('EXPENSE'))} sub={p.label} />
        <Tile label="Total spent" value={rupees(sum('PURCHASE') + sum('EXPENSE'))} tone="red" />
        <Tile label="Entries" value={all.length} sub={`${entries.filter((e) => e.billIds.length === 0).length} without a bill photo`} tone="warn" />
      </Tiles>
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Entries · {p.label}</h2>
          <div className="flex gap-2 text-[13px] font-semibold">
            {([[null, 'All'], ['PURCHASE', 'Purchases'], ['EXPENSE', 'Expenses']] as const).map(([v, l]) => (
              <Link key={l} href={qs({ type: v })} className={`rounded-full px-3 py-1.5 ${type === v ? 'bg-brand text-white' : 'bg-s2'}`}>{l}</Link>
            ))}
            <a href={`/api/export/money?period=${p.kind}`} className="rounded-full bg-s2 px-3 py-1.5">Download</a>
          </div>
        </div>
        {entries.length === 0 ? <Empty>No entries yet. Tap Add entry to record a purchase or a bill.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th w-10"><SelectAll formId="bulk-money" /></th><th className="th">Date</th><th className="th">Item</th><th className="th">Type</th><th className="th">Category</th><th className="th">Qty</th><th className="th">Paid to</th><th className="th text-right">Amount</th><th className="th">Bill</th><th className="th"></th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="td"><RowCheck formId="bulk-money" id={e.id} /></td>
                  <td className="td whitespace-nowrap">{fmtWeekday(e.date)}</td>
                  <td className="td font-semibold">{e.item}</td>
                  <td className="td">{e.type === 'PURCHASE' ? <Chip label="Purchase" tone="sky" /> : <Chip label="Expense" tone="warn" />}</td>
                  <td className="td">{e.category}</td>
                  <td className="td">{e.quantity ?? '—'}</td>
                  <td className="td">{e.paidTo ?? '—'}</td>
                  <td className="td text-right font-semibold">{rupees(e.amount)}</td>
                  <td className="td">{e.billIds.length === 0 ? <span className="text-muted">—</span> : <span className="flex gap-2">{e.billIds.map((b, i) => <a key={b} href={`/api/files/${b}`} target="_blank" rel="noreferrer" className="font-semibold text-brand">{e.billIds.length === 1 ? 'View' : i + 1}</a>)}</span>}</td>
                  <td className="td"><Link href={qs({ edit: e.id })} className="btn-secondary btn-sm">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <BulkBar formId="bulk-money" action={deleteMoneyEntries} confirmText="Delete {n} entries and their bill photos? This cannot be undone." />
      {open && (
        <Drawer title={edit ? 'Edit entry' : 'Add purchase or expense'} sub="Take photos of the bill so it is never lost" close={back}>
          <form action="/api/form/money" method="post" encType="multipart/form-data" className="space-y-3.5">
            <input type="hidden" name="id" value={edit?.id ?? ''} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="self" value={self} />
            <ErrorNote error={sp.error} />
            <div><span className="label">Type</span><Pills name="type" value={edit?.type ?? 'PURCHASE'} options={[['PURCHASE', 'Purchase'], ['EXPENSE', 'Expense']]} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Date *</label><input name="date" type="date" required className="input" defaultValue={dayInput(edit?.date ?? day(0))} max={dayInput(addDays(day(0), 1))} /></div>
              <div><label className="label">Category</label><select name="category" className="input" defaultValue={edit?.category ?? MONEY_CATEGORIES[0]}>{MONEY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div><label className="label">Item *</label><input name="item" required className="input" defaultValue={edit?.item} placeholder="For example: Papaya, box covers, electricity bill" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Quantity</label><input name="quantity" className="input" defaultValue={edit?.quantity ?? ''} placeholder="20 kg" /></div>
              <div><label className="label">Amount (Rs) *</label><input name="amount" type="number" min="1" step="1" required className="input" defaultValue={edit?.amount} /></div>
            </div>
            <div><label className="label">Paid to</label><input name="paidTo" className="input" defaultValue={edit?.paidTo ?? ''} placeholder="Shop or person" /></div>
            <BillPhotos saved={bills} max={MAX_BILLS} />
            <div className="flex gap-2.5 pt-1"><Link href={back} className="btn-secondary flex-1">Cancel</Link><button className="btn flex-1">Save</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
