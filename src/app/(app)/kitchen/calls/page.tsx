import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, deliveryDayFrom, fmtDay, fmtWeekday } from '@/lib/dates'
import { CUSTOMER_CALL, NOT_INTERESTED_REASONS, RENEWAL } from '@/lib/labels'
import { dueCalls, waitingPayment } from '@/lib/kitchen'
import { appSettings, getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { Callout, Chip, Drawer, Empty, ErrorNote, PageHeader, Pills, StatusChip, Tile, Tiles, WaLink, Who } from '@/components/ui'
import { Reveal } from '@/components/Reveal'
import { ShareQr } from '@/components/ShareQr'
import { customerCallAction, markPaidAction } from '../actions'

// Kitchen manager calls: new customers day 1, 5, 15 and 26 of the first month; later months day 15 and 26.
export default async function CustomerCalls({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  const sp = await searchParams
  const today = day(0)
  const [due, waiting, msgs, st, recent] = await Promise.all([
    dueCalls(today),
    waitingPayment(),
    getSettings(),
    appSettings(),
    db.customerCall.findMany({ where: { createdAt: { gte: day(-6) } }, include: { lead: true, package: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ])
  const selected = sp.call ? due.find((d) => d.pkg.id === sp.call) : null
  const qrUrl = msgs.paymentQrId ? `/api/files/${msgs.paymentQrId}` : null
  const amount = (bm: number) => st.monthlyPrice + bm * st.buttermilkPrice
  const payText = (name: string, bm: number) => fill(msgs.msgRenewal, { name: firstName(name), amount: amount(bm).toLocaleString('en-IN') })
  return (
    <>
      <PageHeader title="Customer calls" sub="New customers: day 1, 5, 15 and 26 of the first month. From month 2: day 15 and 26. Day 26 is the renewal call. Sunday is not counted." />
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="Due today" value={due.length} sub="counted on delivery days" tone="brand" />
        <Tile label="Renewal calls" value={due.filter((d) => d.renewal).length} sub="day 26" tone="leaf" />
        <Tile label="Waiting for payment" value={waiting.length} sub="QR sent, no screenshot yet" tone="warn" />
        <Tile label="Calls this week" value={recent.length} sub={`${recent.filter((r) => r.outcome === 'ISSUE').length} with an issue`} tone="red" />
      </Tiles>
      <section className="card overflow-x-auto">
        <div className="px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Calls to make today</h2>
          <p className="text-[13px] text-muted">Write what the customer said. Renewal calls send the payment QR when the customer says yes.</p>
        </div>
        {due.length === 0 ? <Empty>No calls due. Nice work.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Month</th><th className="th">Call</th><th className="th">Due</th><th className="th">Foods to avoid</th><th className="th"></th></tr></thead>
            <tbody>
              {due.map((d) => (
                <tr key={d.pkg.id}>
                  <td className="td"><Who name={d.pkg.lead.name} sub={d.pkg.lead.phone} href={`/customers/${d.pkg.leadId}`} /></td>
                  <td className="td">Month {d.pkg.number}</td>
                  <td className="td"><Chip label={d.renewal ? 'Day 26 · Renewal' : `Day ${d.dayNo}`} tone={d.renewal ? 'leaf' : 'sky'} /></td>
                  <td className={`td ${d.date < today ? 'font-semibold text-red' : ''}`}>{d.date < today ? fmtWeekday(d.date) : 'Today'}</td>
                  <td className="td max-w-48 text-muted">{d.pkg.lead.avoidFoods ?? '—'}</td>
                  <td className="td"><Link href={`/kitchen/calls?call=${d.pkg.id}`} scroll={false} className="btn btn-sm">Log call</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {waiting.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Waiting for payment</h2>
            <p className="text-[13px] text-muted">Mark paid when the screenshot comes. The next package starts after the last day of this one.</p>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Said yes</th><th className="th">Amount</th><th className="th"></th></tr></thead>
            <tbody>
              {waiting.map((c) => (
                <tr key={c.id}>
                  <td className="td"><Who name={c.package.lead.name} sub={c.package.lead.phone} href={`/customers/${c.leadId}`} /></td>
                  <td className="td">{fmtDay(c.createdAt)}</td>
                  <td className="td">Rs {amount(c.package.buttermilkQty).toLocaleString('en-IN')}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1.5">
                      <WaLink small href={waLink(c.package.lead.phone, payText(c.package.lead.name, c.package.buttermilkQty))}>Resend</WaLink>
                      <form action={markPaidAction}>
                        <input type="hidden" name="packageId" value={c.packageId} />
                        <button className="btn btn-sm">Mark paid</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="card overflow-x-auto">
        <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Calls this week</h2></div>
        {recent.length === 0 ? <Empty>No calls logged this week.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Customer</th><th className="th">Call</th><th className="th">Result</th><th className="th">Note</th><th className="th">When</th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td className="td"><Who name={c.lead.name} sub={`Month ${c.package.number}`} href={`/customers/${c.leadId}`} /></td>
                  <td className="td">Day {c.dayNo}</td>
                  <td className="td"><div className="flex flex-wrap gap-1"><StatusChip map={CUSTOMER_CALL} value={c.outcome} />{c.renewal && <StatusChip map={RENEWAL} value={c.renewal} />}</div></td>
                  <td className="td max-w-64 text-muted">{[c.reason, c.note].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="td">{fmtDay(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Callout tone="brand">Day 1 and day 5 calls are only for new customers in their first month. Sunday is not counted.</Callout>
      {selected && (
        <Drawer
          title={`${selected.renewal ? 'Renewal call' : `Day ${selected.dayNo} call`} · ${selected.pkg.lead.name}`}
          sub={`Day ${selected.dayNo} of 26 · ${selected.pkg.lead.region?.name ?? 'No region'} · Month ${selected.pkg.number}`}
          close="/kitchen/calls"
          wide={selected.renewal}
        >
          <form action={customerCallAction} className="space-y-4">
            <input type="hidden" name="packageId" value={selected.pkg.id} />
            <input type="hidden" name="dayNo" value={selected.dayNo} />
            <input type="hidden" name="back" value="/kitchen/calls" />
            <a href={`tel:${selected.pkg.lead.phone}`} className="btn-secondary w-full">Call {selected.pkg.lead.phone}</a>
            {selected.renewal ? (
              <>
                <div><span className="label">Will the customer continue next month? *</span><Pills name="renewal" required options={[['YES', 'Yes, renewing'], ['NO', 'No'], ['UNDECIDED', 'Not decided']]} tones={{ YES: 'leaf', NO: 'red', UNDECIDED: 'warn' }} /></div>
                <Reveal name="renewal" values={['YES']}>
                  <div className="rounded-xl bg-leaf-soft p-4">
                    <div className="mb-2 text-xs font-bold text-leaf">Payment message (WhatsApp)</div>
                    {qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrUrl} alt="Payment QR" className="mb-3 size-36 rounded-lg border border-line bg-white object-contain p-1" />
                    ) : (
                      <p className="mb-2 text-xs text-red">Admin has not uploaded the payment QR yet (Settings).</p>
                    )}
                    <p className="text-[13px] leading-5">{payText(selected.pkg.lead.name, selected.pkg.buttermilkQty)}</p>
                  </div>
                  <ShareQr qrUrl={qrUrl} wa={waLink(selected.pkg.lead.phone, payText(selected.pkg.lead.name, selected.pkg.buttermilkQty))} text={payText(selected.pkg.lead.name, selected.pkg.buttermilkQty)} />
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="paid" className="size-4 accent-brand" /> Paid (screenshot received)</label>
                  <Callout>When marked paid, the next package starts on {fmtWeekday(selected.plan.end ? deliveryDayFrom(addDays(selected.plan.end, 1)) : null)} and the Google review request is ready to send.</Callout>
                  <WaLink href={waLink(selected.pkg.lead.phone, fill(msgs.msgReview, { name: firstName(selected.pkg.lead.name), link: msgs.reviewLink }))}>Ask for a Google review</WaLink>
                </Reveal>
                <Reveal name="renewal" values={['NO']}>
                  <div><span className="label">Reason</span><Pills name="reason" options={NOT_INTERESTED_REASONS.map((r) => [r, r])} /></div>
                  <p className="text-xs text-muted">A customer who says no moves to Not interested. The current package still runs to its last day.</p>
                </Reveal>
              </>
            ) : (
              <div><span className="label">How did it go? *</span><Pills name="outcome" required options={[['HAPPY', 'Happy'], ['ISSUE', 'Has an issue'], ['NO_ANSWER', 'No answer']]} tones={{ HAPPY: 'leaf', ISSUE: 'red', NO_ANSWER: 'muted' }} /></div>
            )}
            <div><label className="label">Note</label><textarea name="note" rows={3} className="input" placeholder="What the customer said" /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href="/kitchen/calls" className="btn-secondary">Cancel</Link><button className="btn">Save call</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
