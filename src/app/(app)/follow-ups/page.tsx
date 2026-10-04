import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtDay } from '@/lib/dates'
import { LEAD_STATUS } from '@/lib/labels'
import { Callout, Empty, PageHeader, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { logCallAction } from '../actions'
import type { Prisma } from '@/generated/prisma/client'

const OPEN: Prisma.LeadWhereInput = { status: { notIn: ['LOST', 'NOT_INTERESTED', 'CONVERTED'] } }
const OUTCOMES: [string, string][] = [
  ['INTERESTED', 'Interested'],
  ['CALL_BACK', 'Call back later'],
  ['TRIAL', 'Trial Box Requested'],
  ['NOT_INTERESTED', 'Not interested'],
]

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'overdue' || sp.tab === 'upcoming' ? sp.tab : 'today'
  const today = day(0)
  const views: Record<string, Prisma.LeadWhereInput> = {
    today: { ...OPEN, nextFollowUpAt: today },
    overdue: { ...OPEN, nextFollowUpAt: { lt: today } },
    upcoming: { ...OPEN, nextFollowUpAt: { gt: today, lte: day(7) } },
  }
  const [nToday, nOver, nUp, done, rows, selected] = await Promise.all([
    db.lead.count({ where: views.today }),
    db.lead.count({ where: views.overdue }),
    db.lead.count({ where: views.upcoming }),
    db.followUp.count({ where: { createdAt: { gte: day(-7) } } }),
    db.lead.findMany({
      where: views[tab],
      include: { region: true, followUps: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { nextFollowUpAt: 'asc' },
    }),
    sp.log ? db.lead.findUnique({ where: { id: sp.log } }) : null,
  ])
  const back = `/follow-ups?tab=${tab}`
  return (
    <>
      <PageHeader title="Follow-ups" sub="Calls to make, with notes from the last call" />
      <Tiles cols={4}>
        <Tile label="Today" value={nToday} sub="calls due today" tone="warn" />
        <Tile label="Overdue" value={nOver} sub="missed, call first" tone="red" />
        <Tile label="Upcoming" value={nUp} sub="next 7 days" tone="sky" />
        <Tile label="Done this week" value={done} sub="calls logged" tone="leaf" />
      </Tiles>
      <Tabs
        items={[
          { label: `Today ${nToday}`, href: '/follow-ups?tab=today', active: tab === 'today' },
          { label: `Overdue ${nOver}`, href: '/follow-ups?tab=overdue', active: tab === 'overdue' },
          { label: `Upcoming ${nUp}`, href: '/follow-ups?tab=upcoming', active: tab === 'upcoming' },
        ]}
      />
      <div className={`grid items-start gap-4 ${selected ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
        <section className="card overflow-x-auto">
          {rows.length === 0 ? (
            <Empty>No calls here.</Empty>
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">Customer</th><th className="th">Last call note</th><th className="th">Status</th><th className="th">Due</th><th className="th">Action</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="td"><Who name={l.name} sub={l.region?.name ?? l.phone} href={`/leads?lead=${l.id}`} /></td>
                    <td className="td max-w-72 text-muted">{l.followUps[0]?.note ?? l.notes ?? '—'}</td>
                    <td className="td"><StatusChip map={LEAD_STATUS} value={l.status} /></td>
                    <td className="td">{fmtDay(l.nextFollowUpAt)}</td>
                    <td className="td"><Link href={`${back}&log=${l.id}`} className={l.id === selected?.id ? 'btn btn-sm' : 'btn-secondary btn-sm'}>Log call</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {selected && (
          <form action={logCallAction} className="card space-y-3.5 border-brand p-5.5">
            <input type="hidden" name="id" value={selected.id} />
            <input type="hidden" name="back" value={back} />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold">Log call</h2>
                <p className="text-[13px] text-muted">{selected.name} · {selected.phone}</p>
              </div>
              <a href={`tel:${selected.phone}`} className="btn-secondary btn-sm">Call</a>
            </div>
            <fieldset>
              <legend className="label">Outcome</legend>
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map(([v, l], i) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="outcome" value={v} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="block rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{l}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div><label className="label">Call notes</label><textarea name="note" rows={3} className="input" /></div>
            <div><label className="label">Next follow-up</label><input type="date" name="next" className="input" defaultValue={dayInput(day(2))} /></div>
            <Callout tone="warn">Trial Box Requested sends the order to the kitchen automatically.</Callout>
            <div className="grid grid-cols-2 gap-2.5"><Link href={back} className="btn-secondary">Cancel</Link><button className="btn">Save call</button></div>
          </form>
        )}
      </div>
    </>
  )
}
