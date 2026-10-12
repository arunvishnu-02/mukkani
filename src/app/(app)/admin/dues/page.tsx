import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtDay, fmtWeekday } from '@/lib/dates'
import { DUE_KINDS, rupees } from '@/lib/labels'
import { Callout, Chip, Drawer, Empty, ErrorNote, PageHeader, Pills, Tabs, Tile, Tiles } from '@/components/ui'
import { ConfirmButton } from '@/components/ConfirmButton'
import { DateField } from '@/components/DateField'
import { deleteDue, payDue, saveDue } from '../../ops-actions'

// Rent, salary and bank dues with their dates. A due shows as a reminder from the day before. Admin only.
export default async function DuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const tab = sp.tab === 'paid' ? 'paid' : 'unpaid'
  const today = day(0)
  const [dues, unpaid] = await Promise.all([
    db.due.findMany({ where: tab === 'paid' ? { paidAt: { not: null } } : { paidAt: null }, orderBy: { dueDate: tab === 'paid' ? 'desc' : 'asc' }, take: 300 }),
    db.due.findMany({ where: { paidAt: null }, select: { amount: true, dueDate: true } }),
  ])
  const list = `/admin/dues?tab=${tab}`
  const edit = sp.edit ? dues.find((d) => d.id === sp.edit) ?? (await db.due.findUnique({ where: { id: sp.edit } })) : null
  const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0)
  const overdue = unpaid.filter((d) => d.dueDate < today)
  const soon = unpaid.filter((d) => d.dueDate >= today && d.dueDate <= addDays(today, 1))
  const week = unpaid.filter((d) => d.dueDate >= today && d.dueDate <= addDays(today, 7))
  const when = (d: Date) => {
    const n = Math.round((d.getTime() - today.getTime()) / 86_400_000)
    return n < 0 ? <Chip label={`${-n} day${n < -1 ? 's' : ''} late`} tone="red" /> : n === 0 ? <Chip label="Due today" tone="red" /> : n === 1 ? <Chip label="Due tomorrow" tone="warn" /> : <Chip label={`In ${n} days`} tone="muted" />
  }
  return (
    <>
      <PageHeader title="Dues" crumb="Business" sub="Rent, salary and bank dues with their dates. Each one is shown as a reminder from the day before. Only admin sees this.">
        <Link href={`${list}&add=1`} scroll={false} className="btn">Add due</Link>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {(overdue.length > 0 || soon.length > 0) && (
        <Callout tone={overdue.length ? 'red' : 'warn'}>
          {overdue.length > 0 && `${overdue.length} overdue (${rupees(sum(overdue))}). `}
          {soon.length > 0 && `${soon.length} due today or tomorrow (${rupees(sum(soon))}).`}
        </Callout>
      )}
      <Tiles cols={4}>
        <Tile label="Overdue" value={rupees(sum(overdue))} sub={`${overdue.length} not paid on time`} tone="red" />
        <Tile label="Today and tomorrow" value={rupees(sum(soon))} sub={`${soon.length} to pay`} tone="warn" />
        <Tile label="Next 7 days" value={rupees(sum(week))} sub={`${week.length} coming up`} tone="sky" />
        <Tile label="All unpaid" value={rupees(sum(unpaid))} sub={`${unpaid.length} dues`} />
      </Tiles>
      <Tabs items={[{ label: `To pay ${unpaid.length}`, href: '/admin/dues', active: tab === 'unpaid' }, { label: 'Paid', href: '/admin/dues?tab=paid', active: tab === 'paid' }]} />
      <section className="card overflow-x-auto">
        {dues.length === 0 ? <Empty>{tab === 'unpaid' ? 'Nothing to pay. Tap Add due for rent, salary or a bank due.' : 'Nothing marked paid yet.'}</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Due date</th><th className="th">Type</th><th className="th">For</th><th className="th text-right">Amount</th><th className="th">{tab === 'paid' ? 'Paid on' : 'When'}</th><th className="th">Note</th><th className="th"></th></tr></thead>
            <tbody>
              {dues.map((d) => (
                <tr key={d.id} className={!d.paidAt && d.dueDate < today ? 'bg-red-soft' : ''}>
                  <td className="td whitespace-nowrap font-semibold">{fmtWeekday(d.dueDate)}</td>
                  <td className="td">{DUE_KINDS[d.kind] ?? d.kind}{d.repeatMonthly && <span className="ml-1.5 text-[11px] font-semibold text-muted">every month</span>}</td>
                  <td className="td">{d.title}</td>
                  <td className="td text-right font-semibold">{rupees(d.amount)}</td>
                  <td className="td">{d.paidAt ? fmtDay(d.paidAt) : when(d.dueDate)}</td>
                  <td className="td max-w-56 text-muted">{d.note ?? '—'}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <form action={payDue}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={list} />{d.paidAt ? <button name="paid" value="no" className="btn-secondary btn-sm">Not paid</button> : <button name="paid" value="yes" className="btn btn-sm">Mark paid</button>}</form>
                      <Link href={`${list}&edit=${d.id}`} scroll={false} className="btn-secondary btn-sm">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(sp.add || edit) && (
        <Drawer title={edit ? 'Edit due' : 'Add due'} sub="You get a reminder on the Overview from the day before" close={list}>
          <form action={saveDue} className="space-y-3.5">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <input type="hidden" name="back" value={list} />
            <input type="hidden" name="self" value={edit ? `${list}&edit=${edit.id}` : `${list}&add=1`} />
            <div><span className="label">Type</span><Pills name="kind" value={edit?.kind ?? 'RENT'} options={Object.entries(DUE_KINDS)} /></div>
            <div><label className="label" htmlFor="due-title">For *</label><input id="due-title" name="title" required className="input" defaultValue={edit?.title} placeholder="For example: Kitchen rent, Murugan salary, HDFC loan EMI" /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label" htmlFor="due-amount">Amount (Rs) *</label><input id="due-amount" name="amount" type="number" min={1} step={1} required className="input" defaultValue={edit?.amount} /></div>
              <div><label className="label">Due date *</label><DateField name="dueDate" required defaultValue={dayInput(edit?.dueDate ?? day(1))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="repeatMonthly" defaultChecked={edit?.repeatMonthly ?? true} className="size-4 accent-brand" /> Every month (when marked paid, next month&apos;s due is added)</label>
            <div><label className="label" htmlFor="due-note">Note</label><textarea id="due-note" name="note" rows={2} className="input" defaultValue={edit?.note ?? ''} /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save due</button></div>
          </form>
          {edit && (
            <form action={deleteDue} className="mt-3 border-t border-line pt-3">
              <input type="hidden" name="id" value={edit.id} /><input type="hidden" name="back" value={list} />
              <ConfirmButton message="Delete this due? This cannot be undone." className="btn-secondary btn-sm text-red">Delete due</ConfirmButton>
            </form>
          )}
        </Drawer>
      )}
    </>
  )
}
