import Image from 'next/image'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { day, keyOf } from '@/lib/dates'
import { planFor } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { fill, firstName } from '@/lib/whatsapp'

const D = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const MON = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Monthly report. Front: a light statement-style page with the 26 days and the pack details. Back: the thank-you letter.
export default async function ReportPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pkg = await db.package.findUnique({ where: { id }, include: { lead: { include: { region: true } } } })
  if (!pkg) notFound()
  const [att, st] = await Promise.all([
    db.attendance.findMany({ where: { leadId: pkg.leadId, date: { gte: pkg.startDate } } }),
    getSettings(),
  ])
  const plan = planFor(pkg, att, day(0))
  const bmDays = new Set(att.filter((a) => a.buttermilk && a.status === 'DELIVERED').map((a) => keyOf(a.date)))
  const days = plan.days
  const first = days[0]?.date ?? pkg.startDate
  const pad = (first.getUTCDay() + 6) % 7
  const cells = [...Array(pad).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  const skipped = days.filter((d) => d.kind === 'leave' || d.kind === 'notDelivered').length
  const leaveDates = days.filter((d) => d.kind === 'leave' || d.kind === 'notDelivered').map((d) => d.date)
  return (
    <>
      <div className="a4 flex flex-col">
        <div className="flex h-2"><span className="flex-[3] bg-brand" /><span className="flex-1 bg-leaf" /></div>
        <div className="flex items-start gap-6 px-12 pt-8">
          <Image src="/mukkani-logo.png" alt="Mukkani" width={132} height={63} />
          <div className="flex-1" />
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Monthly report</div>
            <div className="font-display text-2xl font-bold leading-tight">Month {pkg.number}</div>
            <div className="text-[12px] text-muted">{D.format(pkg.startDate)} to {plan.end ? D.format(plan.end) : 'paused'}</div>
          </div>
        </div>
        <div className="mx-12 mt-6 flex items-end gap-8 border-b border-line pb-5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-wider text-muted uppercase">Prepared for</div>
            <h1 className="font-display text-[30px] font-bold leading-tight">{pkg.lead.name}</h1>
            <div className="mt-0.5 text-[13px] text-muted">{[pkg.lead.region?.name, pkg.lead.phone, pkg.lead.deliveryTime ?? pkg.lead.slot].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="w-[250px] shrink-0">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[34px] font-bold leading-none text-leaf">{plan.delivered}<span className="text-lg text-muted"> of 26</span></span>
              <span className="text-[11px] font-bold tracking-wider text-muted uppercase">boxes delivered</span>
            </div>
            <div className="mt-2 flex gap-[3px]">
              {Array.from({ length: 26 }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded-sm ${i < plan.delivered ? 'bg-leaf' : 'bg-s2'}`} />)}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-12 pt-5 pb-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              [plan.delivered, 'Boxes delivered', 'border-leaf'],
              [26 - plan.delivered, 'Boxes still to come', 'border-brand'],
              [skipped, skipped === 1 ? 'Day skipped' : 'Days skipped', 'border-red'],
              [bmDays.size, 'Add-on drink days', 'border-[#c2477f]'],
            ].map(([n, l, c]) => (
              <div key={l as string} className={`rounded-lg border-l-4 bg-[#faf8fc] px-3.5 py-2.5 ${c}`}>
                <div className="font-display text-2xl font-bold leading-none">{n}</div>
                <div className="mt-1 text-[11px] font-medium text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 mb-2 flex items-center gap-4">
            <h2 className="flex-1 font-display text-base font-bold">Day by day</h2>
            {[['bg-leaf', 'Delivered'], ['bg-red', 'Skipped'], ['bg-[#c2477f]', 'Add-on drink'], ['border border-line bg-white', 'Coming up'], ['bg-[#d9d2e3]', 'Sunday']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[10px] text-muted"><span className={`size-2.5 rounded-full ${c}`} />{l}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-wider text-muted uppercase">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-[52px]" />
              const bm = bmDays.has(keyOf(d.date))
              const skip = d.kind === 'leave' || d.kind === 'notDelivered' || d.kind === 'paused'
              const sun = d.kind === 'holiday'
              const done = d.kind === 'delivered'
              const cls = sun ? 'bg-[#f3f0f7] text-[#a79db8]' : skip ? 'bg-red-soft text-red' : done ? 'bg-leaf-soft text-leaf' : 'border border-line text-muted'
              return (
                <div key={i} className={`relative flex h-[52px] flex-col justify-between rounded-lg px-2 py-1.5 ${cls}`}>
                  <div className="flex items-baseline gap-1"><span className={`font-display text-[17px] font-bold leading-none ${sun ? '' : 'text-ink'}`}>{d.date.getUTCDate()}</span><span className="text-[9px] font-semibold uppercase">{MON.format(d.date)}</span></div>
                  <div className="text-[10px] font-semibold leading-none">{sun ? 'Sunday' : d.kind === 'leave' ? 'Leave' : d.kind === 'paused' ? 'Paused' : d.kind === 'notDelivered' ? 'Not delivered' : `Day ${d.dayNo}`}</div>
                  {(done || skip) && <span className={`absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${done ? 'bg-leaf' : 'bg-red'}`}>{done ? '✓' : '×'}</span>}
                  {bm && <span className="absolute right-1.5 bottom-1.5 size-2.5 rounded-full bg-[#c2477f]" />}
                </div>
              )
            })}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5 rounded-xl border border-line px-5 py-4 text-[12px]">
            {[
              ['First box', D.format(pkg.startDate)],
              ['Last box', plan.end ? D.format(plan.end) : 'Paused, no date yet'],
              ['Monthly pack', `Rs ${pkg.price.toLocaleString('en-IN')} · ${pkg.paid ? 'paid' : 'not paid yet'}`],
              ['Add-on drink', pkg.buttermilkQty ? `${pkg.buttermilkQty} bottle${pkg.buttermilkQty > 1 ? 's' : ''} on Mon, Wed, Fri` : 'Not taken'],
              ['Days skipped', leaveDates.length ? leaveDates.map((x) => SHORT.format(x)).join(', ') : 'None'],
              ['Added to the end', leaveDates.length ? `${leaveDates.length} day${leaveDates.length > 1 ? 's' : ''}, so you still get all 26 boxes` : 'Nothing to add'],
            ].map(([l, v]) => <div key={l} className="flex gap-3"><span className="w-28 shrink-0 text-muted">{l}</span><span className="font-semibold">{v}</span></div>)}
          </div>
          {pkg.reportNote && <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-[12px] leading-5"><b>Note from Mukkani:</b> {pkg.reportNote}</p>}
          <div className="flex-1" />
          <div className="mt-5 flex items-stretch gap-4">
            <div className="flex-1 rounded-xl bg-leaf-soft px-5 py-4">
              <div className="font-display text-[17px] font-bold text-leaf">Thank you for eating healthy with us</div>
              <div className="mt-1 text-[12px] leading-5">Your next 26 days can start right after your last box. Reply <b>YES</b> on WhatsApp to {st.businessPhone} to continue.</div>
            </div>
            <div className="flex w-44 flex-col justify-end rounded-xl border border-dashed border-ink/40 px-4 py-3 text-center">
              <div className="border-t border-ink/50 pt-1 text-[10px] font-semibold tracking-wider text-muted uppercase">Kitchen manager · stamp and sign</div>
            </div>
          </div>
        </div>
        <div className="flex border-t border-line px-12 py-3 text-[10px] text-muted">
          <span className="flex-1">Mukkani · Fresh fruit and salad boxes · {st.address} · {st.businessPhone}</span>
          <span>FSSAI {st.fssai}</span>
        </div>
      </div>
      <div className="a4 flex flex-col px-16 py-14">
        <Image src="/mukkani-logo.png" alt="Mukkani" width={150} height={72} />
        <div className="mt-10 text-sm text-muted">{D.format(plan.end ?? day(0))}</div>
        <div className="mt-6 text-[15px] leading-7 whitespace-pre-line">{fill(st.letter, { name: firstName(pkg.lead.name) })}</div>
        <div className="flex-1" />
        <div className="mt-10 rounded-2xl bg-brand-soft px-6 py-5 text-[13px] leading-6">
          <div className="font-display text-base font-bold text-brand">Mukkani</div>
          <div>{st.address}</div>
          <div>Phone {st.businessPhone}</div>
          <div>FSSAI {st.fssai}</div>
        </div>
      </div>
    </>
  )
}
