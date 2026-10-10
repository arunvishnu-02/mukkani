import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtDay, fmtWeekday, nowHourIST } from '@/lib/dates'
import { LEAD_CALL, LEAD_STATUS, NOT_INTERESTED_REASONS } from '@/lib/labels'
import { regionsList } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { Chip, Drawer, Empty, ErrorNote, PageHeader, Pills, StatusChip, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { Reveal } from '@/components/Reveal'
import { PackageFields } from '@/components/PackageFields'
import { logCallAction } from '../actions'
import type { Prisma } from '@/generated/prisma/client'

const OPEN: Prisma.LeadWhereInput = { status: 'FOLLOW_UP' }

export default async function CallRegister({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'overdue' || sp.tab === 'upcoming' ? sp.tab : 'today'
  const today = day(0)
  const views: Record<string, Prisma.LeadWhereInput> = {
    today: { ...OPEN, nextFollowUpAt: today },
    overdue: { ...OPEN, nextFollowUpAt: { lt: today } },
    upcoming: { ...OPEN, nextFollowUpAt: { gt: today, lte: day(7) } },
  }
  // Trial feedback calls show after 10 AM on the trial day, and stay until the result is recorded.
  const feedbackFrom = nowHourIST() >= 10 ? today : day(-1)
  const [nToday, nOver, nUp, done, rows, trials, selected, regions, st] = await Promise.all([
    db.lead.count({ where: views.today }),
    db.lead.count({ where: views.overdue }),
    db.lead.count({ where: views.upcoming }),
    db.followUp.count({ where: { createdAt: { gte: today } } }),
    db.lead.findMany({
      where: views[tab],
      include: { region: true, followUps: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { nextFollowUpAt: 'asc' },
    }),
    db.trialBox.findMany({
      where: tab === 'upcoming' ? { id: '' } : { status: { not: 'DONE' }, deliveryDate: tab === 'today' ? { lte: feedbackFrom, gte: today } : { lt: today } },
      include: { lead: { include: { region: true } } },
      orderBy: { deliveryDate: 'asc' },
    }),
    sp.log ? db.lead.findUnique({ where: { id: sp.log }, include: { trialBoxes: true, followUps: { orderBy: { createdAt: 'desc' }, take: 3 } } }) : null,
    regionsList(),
    appSettings(),
  ])
  const list = `/calls?tab=${tab}`
  const hasTrial = (selected?.trialBoxes.length ?? 0) > 0
  return (
    <>
      <PageHeader title="Call register" sub="Who is due and overdue. Mark one result per call." />
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="Due today" value={nToday} sub="follow-up calls" tone="warn" />
        <Tile label="Overdue" value={nOver} sub="missed, call first" tone="red" />
        <Tile label="Upcoming" value={nUp} sub="next 7 days" tone="sky" />
        <Tile label="Calls done today" value={done} sub="results marked" tone="leaf" />
      </Tiles>
      <Tabs
        items={[
          { label: `Today ${nToday}`, href: '/calls?tab=today', active: tab === 'today' },
          { label: `Overdue ${nOver}`, href: '/calls?tab=overdue', active: tab === 'overdue' },
          { label: `Upcoming ${nUp}`, href: '/calls?tab=upcoming', active: tab === 'upcoming' },
        ]}
      />
      <section className="card overflow-x-auto">
        {rows.length + trials.length === 0 ? (
          <Empty>No calls here.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Call</th><th className="th">Last call note</th><th className="th">Due</th><th className="th">Action</th></tr></thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id}>
                  <td className="td"><Who name={t.lead.name} sub={t.lead.region?.name ?? t.lead.phone} href={`/customers/${t.leadId}`} /></td>
                  <td className="td"><Chip label="Trial feedback" tone="sky" /></td>
                  <td className="td max-w-72 text-muted">Trial box {fmtWeekday(t.deliveryDate)} · {t.slot ?? 'no slot'}</td>
                  <td className="td">{fmtDay(t.deliveryDate)}</td>
                  <td className="td"><Link href={`/trials?feedback=${t.id}`} className="btn btn-sm">Feedback</Link></td>
                </tr>
              ))}
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="td"><Who name={l.name} sub={l.region?.name ?? l.phone} href={`/leads?lead=${l.id}`} /></td>
                  <td className="td"><StatusChip map={LEAD_STATUS} value={l.status} /></td>
                  <td className="td max-w-72 text-muted">{l.followUps[0] ? `${l.followUps[0].outcome}${l.followUps[0].note ? `: ${l.followUps[0].note}` : ''}` : (l.notes ?? '—')}</td>
                  <td className={`td ${l.nextFollowUpAt && l.nextFollowUpAt < today ? 'font-semibold text-red' : ''}`}>{fmtDay(l.nextFollowUpAt)}</td>
                  <td className="td"><Link href={`${list}&log=${l.id}`} scroll={false} className={l.id === selected?.id ? 'btn btn-sm' : 'btn-secondary btn-sm'}>Log call</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {selected && (
        <Drawer title="Log call" sub={`${selected.name} · ${selected.phone}`} close={list}>
          <form action={logCallAction} className="space-y-4">
            <input type="hidden" name="id" value={selected.id} />
            <input type="hidden" name="back" value={list} />
            <input type="hidden" name="self" value={`${list}&log=${selected.id}`} />
            <a href={`tel:${selected.phone}`} className="btn-secondary w-full">Call {selected.phone}</a>
            {selected.followUps.length > 0 && (
              <div className="space-y-1 rounded-lg bg-s2 px-3 py-2.5 text-[13px]">
                {selected.followUps.map((f) => <div key={f.id}><span className="font-semibold">{fmtDay(f.createdAt)} · {f.outcome}</span>{f.note ? `: ${f.note}` : ''}</div>)}
              </div>
            )}
            <div>
              <span className="label">Result *</span>
              <Pills name="outcome" required options={LEAD_CALL.filter(([v]) => !(v === 'TRIAL' && hasTrial))} tones={{ NOT_INTERESTED: 'red', MONTHLY: 'leaf' }} />
              {hasTrial && <p className="mt-1.5 text-xs text-muted">This customer has already had their one trial box.</p>}
            </div>
            <div><label className="label">What the customer said</label><textarea name="note" rows={3} className="input" /></div>
            <Reveal name="outcome" values={['INTERESTED', 'NO_ANSWER', 'CALL_BACK']}>
              <div><label className="label">Next call date *</label><input type="date" name="next" className="input" defaultValue={dayInput(day(2))} /></div>
            </Reveal>
            <Reveal name="outcome" values={['TRIAL']}>
              <div className="text-xs font-bold tracking-wide text-muted uppercase">Trial box · Rs {st.trialPrice} including the box</div>
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="label">Delivery date</label><input type="date" name="trialDate" className="input" defaultValue={dayInput(day(1))} /></div>
                <div>
                  <label className="label">Time slot *</label>
                  <select name="trialSlot" className="input" defaultValue=""><option value="">Pick a slot</option>{st.slots.map((x) => <option key={x}>{x}</option>)}</select>
                </div>
              </div>
            </Reveal>
            <Reveal name="outcome" values={['MONTHLY']}>
              <PackageFields start={day(1)} regions={regions} slots={st.slots} regionId={selected.regionId} price={st.monthlyPrice} bmPrice={st.buttermilkPrice} />
            </Reveal>
            <Reveal name="outcome" values={['NOT_INTERESTED']}>
              <div><span className="label">Reason</span><Pills name="reason" options={NOT_INTERESTED_REASONS.map((r) => [r, r])} /></div>
            </Reveal>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save call</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
