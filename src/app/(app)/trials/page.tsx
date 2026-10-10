import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday } from '@/lib/dates'
import { LOCATION_STATUS, NOT_INTERESTED_REASONS, TRIAL_RESULT, TRIAL_STATUS } from '@/lib/labels'
import { regionsList } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { Chip, Drawer, Empty, ErrorNote, PageHeader, Pills, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { Reveal } from '@/components/Reveal'
import { PackageFields } from '@/components/PackageFields'
import { bookTrialAction, trialFeedbackAction } from '../actions'
import type { TrialStatus } from '@/generated/prisma/enums'

const TABS: [string, string, TrialStatus][] = [
  ['booked', 'Booked', 'BOOKED'],
  ['waiting', 'Awaiting result', 'DELIVERED'],
  ['done', 'Done', 'DONE'],
]

export default async function TrialsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = TABS.find((t) => t[0] === sp.tab) ?? TABS[0]
  const today = day(0)
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const [trials, counts, tomorrow, converted, feedbackFor, leads, regions, st] = await Promise.all([
    db.trialBox.findMany({
      where: { status: tab[2] },
      include: { lead: { include: { region: true } } },
      orderBy: { deliveryDate: tab[2] === 'DONE' ? 'desc' : 'asc' },
      take: 200,
    }),
    db.trialBox.groupBy({ by: ['status'], _count: true }),
    db.trialBox.count({ where: { deliveryDate: day(1) } }),
    db.trialBox.count({ where: { result: 'MONTHLY', updatedAt: { gte: monthStart } } }),
    sp.feedback ? db.trialBox.findUnique({ where: { id: sp.feedback }, include: { lead: true } }) : null,
    sp.book ? db.lead.findMany({ where: { status: 'FOLLOW_UP', trialBoxes: { none: {} } }, orderBy: { name: 'asc' } }) : [],
    regionsList(),
    appSettings(),
  ])
  const c = Object.fromEntries(counts.map((r) => [r.status, r._count])) as Record<string, number>
  const list = `/trials?tab=${tab[0]}`
  return (
    <>
      <PageHeader title="Trials" sub={`One trial box per customer, delivered on one date. Rs ${st.trialPrice} including the box.`}>
        <Link href={`${list}&book=1`} className="btn" scroll={false}>Book trial</Link>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="Trials tomorrow" value={tomorrow} sub={fmtWeekday(day(1))} tone="sky" />
        <Tile label="Booked" value={c.BOOKED ?? 0} sub="not delivered yet" tone="brand" />
        <Tile label="Awaiting result" value={c.DELIVERED ?? 0} sub="feedback call after 10 AM" tone="warn" />
        <Tile label="Monthly pack this month" value={converted} sub="from a trial" tone="leaf" />
      </Tiles>
      <Tabs items={TABS.map(([k, l, s]) => ({ label: `${l} ${c[s] ?? 0}`, href: `/trials?tab=${k}`, active: tab[0] === k }))} />
      <section className="card overflow-x-auto">
        {trials.length === 0 ? (
          <Empty>No trials here.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Trial date</th><th className="th">Slot</th><th className="th">Payment</th><th className="th">Location</th><th className="th">{tab[2] === 'DONE' ? 'Result' : 'Action'}</th></tr></thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id}>
                  <td className="td"><Who name={t.lead.name} sub={t.lead.phone} href={`/customers/${t.leadId}`} /></td>
                  <td className="td">{t.lead.region?.name ?? '—'}</td>
                  <td className="td">{fmtWeekday(t.deliveryDate)}</td>
                  <td className="td">{t.slot ?? '—'}</td>
                  <td className="td">{t.paid ? <Chip label={`Paid Rs ${t.price}`} tone="leaf" /> : <Chip label="Not paid" tone="muted" />}</td>
                  <td className="td"><StatusChip map={LOCATION_STATUS} value={t.lead.locationStatus} /></td>
                  <td className="td">
                    {t.status === 'DONE' ? (
                      <StatusChip map={TRIAL_RESULT} value={t.result ?? ''} />
                    ) : t.deliveryDate <= today ? (
                      <Link href={`${list}&feedback=${t.id}`} scroll={false} className="btn btn-sm">Feedback call</Link>
                    ) : (
                      <StatusChip map={TRIAL_STATUS} value={t.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {sp.book && (
        <Drawer title="Book trial" sub="Delivery date is tomorrow unless you change it. The time slot is required." close={list}>
          <form action={bookTrialAction} className="space-y-3.5">
            <input type="hidden" name="back" value="/trials?tab=booked" />
            <input type="hidden" name="self" value={`${list}&book=1`} />
            <div>
              <label className="label">Customer *</label>
              <select name="leadId" className="input" required defaultValue={sp.lead ?? ''}>
                <option value="">Pick a lead in Follow up</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.phone}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label">Delivery date</label><input type="date" name="trialDate" className="input" defaultValue={dayInput(day(1))} /></div>
              <div>
                <label className="label">Time slot *</label>
                <select name="slot" className="input" required defaultValue=""><option value="">Pick a slot</option>{st.slots.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Book trial</button></div>
          </form>
        </Drawer>
      )}
      {feedbackFor && (
        <Drawer title="Trial feedback call" sub={`${feedbackFor.lead.name} · trial on ${fmtWeekday(feedbackFor.deliveryDate)}`} close={list}>
          <form action={trialFeedbackAction} className="space-y-4">
            <input type="hidden" name="id" value={feedbackFor.id} />
            <input type="hidden" name="back" value="/trials?tab=done" />
            <input type="hidden" name="self" value={`${list}&feedback=${feedbackFor.id}`} />
            <a href={`tel:${feedbackFor.lead.phone}`} className="btn-secondary w-full">Call {feedbackFor.lead.phone}</a>
            <div><label className="label">Feedback</label><textarea name="feedback" rows={3} className="input" defaultValue={feedbackFor.feedback ?? ''} placeholder="What did they think of the box?" /></div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="paid" defaultChecked={feedbackFor.paid} className="size-4 accent-brand" /> Trial paid (Rs {feedbackFor.price})</label>
            <div><span className="label">Result *</span><Pills name="result" required options={[['MONTHLY', 'Monthly pack'], ['FOLLOW_UP', 'Follow up'], ['NOT_INTERESTED', 'Not interested']]} tones={{ MONTHLY: 'leaf', NOT_INTERESTED: 'red' }} /></div>
            <Reveal name="result" values={['MONTHLY']}>
              <PackageFields start={day(1)} regions={regions} slots={st.slots} regionId={feedbackFor.lead.regionId} slot={feedbackFor.slot} price={st.monthlyPrice} bmPrice={st.buttermilkPrice} />
            </Reveal>
            <Reveal name="result" values={['FOLLOW_UP']}>
              <div><label className="label">Next call date *</label><input type="date" name="next" className="input" defaultValue={dayInput(day(2))} /></div>
            </Reveal>
            <Reveal name="result" values={['NOT_INTERESTED']}>
              <div><span className="label">Reason</span><Pills name="reason" options={NOT_INTERESTED_REASONS.map((r) => [r, r])} /></div>
            </Reveal>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save result</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
