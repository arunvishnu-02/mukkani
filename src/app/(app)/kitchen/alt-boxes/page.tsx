import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday } from '@/lib/dates'
import { Callout, Card, Empty, ErrorNote, PageHeader, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { Reveal } from '@/components/Reveal'
import { appSettings } from '@/lib/settings'
import { addAltBoxAction, collectAltBoxAction } from '../actions'
import type { Prisma } from '@/generated/prisma/client'
import { DateField } from '@/components/DateField'

// When a customer hasn't given back the empty box, we send an alternative box and note its number.
export default async function AltBoxes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const tab = sp.tab === 'collected' || sp.tab === 'all' ? sp.tab : 'out'
  const today = day(0)
  const where: Prisma.AltBoxWhereInput = tab === 'out' ? { collectedOn: null } : tab === 'collected' ? { collectedOn: { not: null } } : {}
  const [boxes, out, given, collected, late, customers, outNow, st] = await Promise.all([
    db.altBox.findMany({ where, include: { lead: true }, orderBy: { givenOn: 'asc' }, take: 200 }),
    db.altBox.count({ where: { collectedOn: null } }),
    db.altBox.findMany({ where: { givenOn: today }, select: { boxNo: true } }),
    db.altBox.count({ where: { collectedOn: today } }),
    db.altBox.count({ where: { collectedOn: null, givenOn: { lte: day(-3) } } }),
    db.lead.findMany({ where: { status: { in: ['MONTHLY', 'TRIAL'] } }, include: { region: true }, orderBy: { name: 'asc' } }),
    db.altBox.findMany({ where: { collectedOn: null }, include: { lead: { select: { name: true } } } }),
    appSettings(),
  ])
  const total = st.altBoxTotal
  const withWhom = new Map(outNow.map((b) => [b.boxNo, b]))
  const free = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !withWhom.has(n))
  const back = `/kitchen/alt-boxes?tab=${tab}`
  const daysOut = (d: Date) => Math.round((today.getTime() - d.getTime()) / 86_400_000)
  return (
    <>
      <PageHeader title="Alternative boxes" sub="When a customer hasn't given back the empty box, we send an alternative box and note its number. Mark it when it comes back.">
        <Tabs items={[{ label: 'Not collected', href: '/kitchen/alt-boxes', active: tab === 'out' }, { label: 'Collected', href: '/kitchen/alt-boxes?tab=collected', active: tab === 'collected' }, { label: 'All', href: '/kitchen/alt-boxes?tab=all', active: tab === 'all' }]} />
      </PageHeader>
      <Tiles cols={4}>
        <Tile label="Out now" value={`${out} of ${total}`} sub={`${free.length} in the kitchen`} tone="sky" />
        <Tile label="Given today" value={given.length} sub={given.length ? `Box ${given.map((g) => g.boxNo).join(' and ')}` : 'none'} />
        <Tile label="Collected today" value={collected} tone="leaf" />
        <Tile label="Not back for 3+ days" value={late} sub="call the customer" tone="red" />
      </Tiles>
      <ErrorNote error={sp.error} />
      <section className="card px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-display text-lg font-semibold">All {total} boxes</h2>
          <p className="text-[13px] text-muted">{free.length} in the kitchen · {out} out. Each box shows who has it.</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-[repeat(auto-fill,minmax(128px,1fr))]">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const b = withWhom.get(n)
            const lateBox = b && daysOut(b.givenOn) >= 3
            return (
              <div key={n} className={`rounded-lg border px-2.5 py-2 ${b ? (lateBox ? 'border-red bg-red-soft' : 'border-sky bg-sky-soft') : 'border-line bg-surface'}`}>
                <div className={`font-display text-lg font-bold leading-none ${b ? (lateBox ? 'text-red' : 'text-sky') : 'text-muted'}`}>{n}</div>
                <div className="mt-1 truncate text-xs font-semibold">{b ? (b.lead?.name ?? b.holder ?? 'Someone') : 'In the kitchen'}</div>
                <div className="text-[11px] text-muted">{b ? `since ${fmtWeekday(b.givenOn)}${b.lead ? '' : ' · not a customer'}` : 'free'}</div>
              </div>
            )
          })}
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4">
            <h2 className="font-display text-lg font-semibold">{tab === 'out' ? 'Boxes to collect' : tab === 'collected' ? 'Collected' : 'All alternative boxes'}</h2>
            <p className="text-[13px] text-muted">Check these on the next delivery. Box numbers 1 to {total}.</p>
          </div>
          {boxes.length === 0 ? <Empty>No boxes here.</Empty> : (
            <table className="w-full">
              <thead><tr><th className="th">Box no.</th><th className="th">Who has it</th><th className="th">Given on</th><th className="th">Days out</th><th className="th">Next delivery</th></tr></thead>
              <tbody>
                {boxes.map((b) => {
                  const n = daysOut(b.givenOn)
                  const isLate = !b.collectedOn && n >= 3
                  return (
                    <tr key={b.id} className={isLate ? 'bg-red-soft' : ''}>
                      <td className="td"><span className={`inline-block rounded-md border-2 px-2.5 py-0.5 font-bold ${isLate ? 'border-red text-red' : 'border-sky text-sky'}`}>{b.boxNo}</span></td>
                      <td className="td">{b.lead ? <Who name={b.lead.name} sub={b.lead.phone} href={`/customers/${b.leadId}`} /> : <Who name={b.holder ?? 'Someone'} sub="Not a customer" />}</td>
                      <td className="td">{fmtWeekday(b.givenOn)}</td>
                      <td className={`td ${isLate ? 'font-semibold text-red' : ''}`}>{b.collectedOn ? `back ${fmtWeekday(b.collectedOn)}` : n === 0 ? 'Today' : `${n} day${n > 1 ? 's' : ''}`}</td>
                      <td className="td">
                        <form action={collectAltBoxAction} className="flex gap-1.5">
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="back" value={back} />
                          <button name="collected" value="yes" className={`rounded-md border px-2.5 py-1 text-[13px] font-medium ${b.collectedOn ? 'border-leaf bg-leaf text-white' : 'border-line'}`}>Collected</button>
                          <button name="collected" value="no" className={`rounded-md border px-2.5 py-1 text-[13px] font-medium ${!b.collectedOn && isLate ? 'border-red bg-red text-white' : 'border-line'}`}>Not collected</button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
        <div className="space-y-4">
          <Card title="Add alternative box" sub="Note it before the box goes out">
            <form action={addAltBoxAction} className="space-y-3.5">
              <input type="hidden" name="back" value={back} />
              <div>
                <label className="label" htmlFor="alt-lead">Given to *</label>
                <select id="alt-lead" name="leadId" className="input" defaultValue="">
                  <option value="">Someone else (type the name below)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.region ? ` · ${c.region.name}` : ''}</option>)}
                </select>
              </div>
              <Reveal name="leadId" values={['']} initial="">
                <div><label className="label" htmlFor="alt-holder">Who has the box *</label><input id="alt-holder" name="holder" className="input" placeholder="For example: Ravi (delivery), Sri Ram shop" /><p className="mt-1 text-xs text-muted">For a box given to someone who is not a customer</p></div>
              </Reveal>
              <div>
                <label className="label" htmlFor="alt-no">Alternative box number *</label>
                <select id="alt-no" name="boxNo" required className="input" defaultValue="">
                  <option value="">{free.length ? 'Pick a free box' : 'No box is free'}</option>
                  {free.map((n) => <option key={n} value={n}>Box {n}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">{free.length} of {total} boxes are in the kitchen</p>
              </div>
              <div><label className="label">Date given</label><DateField name="givenOn" defaultValue={dayInput(today)} /></div>
              <button className="btn w-full">Save</button>
            </form>
          </Card>
          <Callout tone="sky">Alternative box customers show in blue on the daily attendance sheet.</Callout>
        </div>
      </div>
    </>
  )
}
