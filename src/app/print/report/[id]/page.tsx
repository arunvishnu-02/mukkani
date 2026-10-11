import Image from 'next/image'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { day, keyOf } from '@/lib/dates'
import { planFor } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { fill, firstName } from '@/lib/whatsapp'

const D = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const MON = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' })

// Monthly report (front: the 26 days; back: thank-you letter), from Arun's paper sample.
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
  const sundays = days.filter((d) => d.kind === 'holiday').length
  const pct = Math.round((plan.delivered / 26) * 100)
  return (
    <>
      <div className="a4 flex flex-col">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark to-[#8a4cc4] px-12 pt-10 pb-9 text-white">
          <div className="absolute -top-16 -right-10 size-64 rounded-full bg-white/10" />
          <div className="inline-flex rounded-xl bg-white px-3 py-2"><Image src="/mukkani-logo.png" alt="Mukkani" width={90} height={43} /></div>
          <div className="mt-5 inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wider uppercase">Monthly report · Package {pkg.number}</div>
          <h1 className="mt-2 font-display text-[30px] font-bold">Your 26-day healthy journey</h1>
          <div className="mt-1 text-[15px] font-semibold">{pkg.lead.name}{pkg.lead.region ? ` · ${pkg.lead.region.name}` : ''}</div>
          <div className="text-[13px] opacity-80">{D.format(pkg.startDate)} → {plan.end ? D.format(plan.end) : '—'}</div>
          <div
            className="absolute top-10 right-12 flex size-36 flex-col items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#5fd068 ${pct}%, rgb(255 255 255 / 0.2) 0)` }}
          >
            <div className="flex size-28 flex-col items-center justify-center rounded-full bg-brand">
              <div className="font-display text-3xl font-bold">{plan.delivered}/26</div>
              <div className="text-[9px] font-bold tracking-wider uppercase">Boxes delivered</div>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-12 py-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              [plan.delivered, 'Boxes delivered', 'bg-leaf'],
              [bmDays.size, 'Buttermilk days', 'bg-[#c2477f]'],
              [skipped, 'Days skipped', 'bg-red'],
              [sundays, 'Sundays off', 'bg-[#b9b0c6]'],
            ].map(([n, l, c]) => (
              <div key={l as string} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <span className={`size-7 rounded-full ${c}`} />
                <div><div className="font-display text-xl font-bold leading-none">{n}</div><div className="text-[11px] text-muted">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-5 mb-2 flex items-end">
            <h2 className="flex-1 font-display text-lg font-bold">Your month at a glance</h2>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-wider text-muted uppercase">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className={d === 'Sun' ? 'text-red' : ''}>{d}</div>)}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-[62px] rounded-lg border border-dashed border-line" />
              const bm = bmDays.has(keyOf(d.date))
              const skip = d.kind === 'leave' || d.kind === 'notDelivered'
              const sun = d.kind === 'holiday'
              const cls = sun ? 'bg-[#f3f0f7] text-[#b9b0c6]' : skip ? 'border border-red/40 bg-red-soft text-red' : bm ? 'border border-[#c2477f]/40 text-[#c2477f]' : d.kind === 'delivered' ? 'border border-leaf/30 text-leaf' : 'border border-line text-muted'
              return (
                <div key={i} className={`h-[62px] rounded-lg px-2 py-1.5 text-left ${cls}`}>
                  <div className="flex items-baseline gap-1"><span className="font-display text-lg font-bold text-ink">{String(d.date.getUTCDate()).padStart(2, '0')}</span><span className="text-[9px] font-bold uppercase">{MON.format(d.date)}</span></div>
                  <div className="text-[10px] font-semibold">{sun ? 'Holiday' : skip ? 'Skipped' : `Day ${d.dayNo}${bm ? ' · BM' : ''}`}</div>
                </div>
              )
            })}
          </div>
          {pkg.reportNote && <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-[13px]">{pkg.reportNote}</p>}
          <div className="flex-1" />
          <div className="relative mt-5 flex items-center overflow-hidden rounded-2xl bg-gradient-to-r from-leaf to-[#4cb256] px-7 py-5 text-white">
            <div className="flex-1">
              <div className="font-display text-xl font-bold">Thank you for eating healthy with us!</div>
              <div className="mt-1 text-[13px] opacity-90">Your next 26 days can start right after your last box.</div>
              <div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-leaf">Reply YES on WhatsApp to continue</div>
            </div>
            <div className="flex size-24 flex-col items-center justify-center rounded-full border-2 border-dashed border-brand bg-white text-center text-[9px] font-bold text-brand uppercase">Kitchen<br />manager<span className="mt-0.5 text-[8px] font-medium normal-case text-muted">stamp + sign</span></div>
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
