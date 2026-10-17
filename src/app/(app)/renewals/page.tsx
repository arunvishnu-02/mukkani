import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { addDays, day, deliveryDayFrom, fmtWeekday } from '@/lib/dates'
import { NOT_INTERESTED_REASONS, RENEWAL } from '@/lib/labels'
import { renewalList } from '@/lib/renewals'
import { getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { Chip, Drawer, Empty, PageHeader, Pills, StatusChip, Tabs, Tile, Tiles, WaLink, Who } from '@/components/ui'
import { Reveal } from '@/components/Reveal'
import { saveRenewalDecisionAction } from '../actions'

// Month over: will the customer continue? Sales sees everyone whose month ends in 3 days or has ended without
// a next month, with the kitchen's renewal call answer, and records Continue / Not continuing from here.
export default async function RenewalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const kitchen = user.role === 'KITCHEN'
  const sp = await searchParams
  const today = day(0)
  const [all, st] = await Promise.all([renewalList(today), getSettings()])
  const open = all.filter((r) => r.decision !== 'NO')
  const tab = sp.tab === 'ending' || sp.tab === 'yes' ? sp.tab : 'finished'
  const finished = open.filter((r) => r.finished && r.decision !== 'YES')
  const ending = open.filter((r) => !r.finished && r.decision !== 'YES')
  const yes = open.filter((r) => r.decision === 'YES')
  const rows = tab === 'finished' ? finished : tab === 'ending' ? ending : yes
  const pick = sp.no ? all.find((r) => r.pkg.id === sp.no) : null
  const self = `/renewals${tab === 'finished' ? '' : `?tab=${tab}`}`
  const msg = (r: (typeof all)[number]) =>
    r.finished
      ? `Hi ${firstName(r.pkg.lead.name)}, your Mukkani month ${r.pkg.number} is complete (26 of 26 boxes). Would you like to continue next month? Reply YES and we will start from ${fmtWeekday(deliveryDayFrom(addDays(today, 1)))}. - Team Mukkani`
      : fill(st.msgReminder, { name: firstName(r.pkg.lead.name), endDate: fmtWeekday(r.plan.end) })
  return (
    <>
      <PageHeader title="Renewals" crumb="Sales" sub="Customers whose month ends in the next 3 days or has ended. Ask if they continue, then start next month or mark them as not continuing.">
        <Tabs items={[
          { label: `Month over ${finished.length}`, href: '/renewals', active: tab === 'finished' },
          { label: `Ending in 3 days ${ending.length}`, href: '/renewals?tab=ending', active: tab === 'ending' },
          { label: `Said yes ${yes.length}`, href: '/renewals?tab=yes', active: tab === 'yes' },
        ]} />
      </PageHeader>
      <Tiles cols={4}>
        <Tile label="Month over, no answer" value={finished.length} sub="ask today" tone={finished.length ? 'red' : 'muted'} />
        <Tile label="Ending in 3 days" value={ending.length} sub="send the reminder" tone="warn" />
        <Tile label="Said yes" value={yes.length} sub={kitchen ? 'sales starts next month' : 'start next month'} tone="leaf" />
        <Tile label="Not continuing" value={all.filter((r) => r.decision === 'NO').length} sub="moved to Not interested" />
      </Tiles>
      <section className="card overflow-x-auto">
        {rows.length === 0 ? <Empty>{tab === 'finished' ? 'Nobody waiting. Every finished customer has an answer.' : tab === 'ending' ? 'No month ends in the next 3 days.' : 'Nobody waiting to start.'}</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Month</th><th className="th">Last box</th><th className="th">Answer</th><th className="th">Ask</th><th className="th">Continue?</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pkg.id}>
                  <td className="td"><Who name={r.pkg.lead.name} sub={r.pkg.lead.phone || 'no phone'} href={`/customers/${r.pkg.leadId}`} /></td>
                  <td className="td">{r.pkg.lead.region?.name ?? '—'}</td>
                  <td className="td">Month {r.pkg.number} · {r.plan.delivered}/26 {r.pkg.paid ? '' : <Chip label="not paid" tone="muted" />}</td>
                  <td className="td whitespace-nowrap">{fmtWeekday(r.plan.end)}{r.finished && <div className="text-[11px] font-semibold text-red">month over</div>}</td>
                  <td className="td">{r.decision ? <StatusChip map={RENEWAL} value={r.decision} /> : <span className="text-xs text-muted">{r.finished ? 'not asked yet' : 'renewal call on day 26'}</span>}</td>
                  <td className="td">{r.pkg.lead.phone ? <WaLink small href={waLink(r.pkg.lead.phone, msg(r))}>{r.finished ? 'Ask' : 'Remind'}</WaLink> : <span className="text-xs text-muted">add phone</span>}</td>
                  <td className="td">
                    <form action={saveRenewalDecisionAction} className="flex flex-wrap gap-1.5">
                      <input type="hidden" name="packageId" value={r.pkg.id} />
                      <input type="hidden" name="back" value={self} />
                      {kitchen ? (r.decision !== 'YES' && <button name="decision" value="YES" className="btn btn-sm">Yes, continuing</button>) : <button name="decision" value="YES" className="btn btn-sm">Continue · start month {r.pkg.number + 1}</button>}
                      {r.decision !== 'UNDECIDED' && <button name="decision" value="UNDECIDED" className="btn-secondary btn-sm">Not decided</button>}
                      <Link href={`${self}${self.includes('?') ? '&' : '?'}no=${r.pkg.id}`} scroll={false} className="btn-secondary btn-sm text-red">Not continuing</Link>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {pick && (
        <Drawer title="Not continuing" sub={`${pick.pkg.lead.name} · month ${pick.pkg.number}`} close={self}>
          <form action={saveRenewalDecisionAction} className="space-y-3.5">
            <input type="hidden" name="packageId" value={pick.pkg.id} />
            <input type="hidden" name="back" value={self} />
            <input type="hidden" name="decision" value="NO" />
            <div><span className="label">Reason *</span><Pills name="reason" required options={NOT_INTERESTED_REASONS.map((x) => [x, x])} /></div>
            <Reveal name="reason" values={['Other']}><div><label className="label">What is the reason?</label><input name="reasonOther" className="input" /></div></Reveal>
            <div><label className="label">Note</label><textarea name="note" rows={2} className="input" placeholder="What the customer said" /></div>
            <p className="text-xs text-muted">The customer moves to Not interested. A month that is still running goes on to its last box.</p>
            <div className="grid grid-cols-2 gap-2.5"><Link href={self} className="btn-secondary">Cancel</Link><button className="btn">Save</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
