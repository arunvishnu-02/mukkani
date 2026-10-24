import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, deliveryDayFrom, fmtDay, fmtTime, fmtWeekday } from '@/lib/dates'
import { CUSTOMER_CALL, CUSTOMER_STATUS, LEAD_STATUS, LOCATION_STATUS, PACKAGE_STATUS, RENEWAL, SOURCE, TRIAL_RESULT, TRIAL_STATUS, rupees, sourceLabel } from '@/lib/labels'
import { holidaySet, planFor, regionsList } from '@/lib/queries'
import { appSettings, getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { Avatar, Callout, Card, Chip, Drawer, ErrorNote, Progress, StatusChip, WaLink } from '@/components/ui'
import { PackageCalendar } from '@/components/PackageCalendar'
import { PackageFields } from '@/components/PackageFields'
import { MapPin } from '@/components/MapPin'
import { BillPhotos } from '@/components/BillPhotos'
import { setButtermilkAction, setPackagePaidAction, startPackageAction } from '../../actions'

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-32 shrink-0 text-[13px] text-muted">{k}</span>
      <span className="min-w-0 flex-1 font-medium">{v}</span>
    </div>
  )
}

const DOT: Record<string, string> = { location: 'bg-leaf', trial: 'bg-tur', package: 'bg-leaf', call: 'bg-sky', status: 'bg-brand', box: 'bg-sky', reminder: 'bg-leaf' }

export default async function CustomerProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const { id } = await params
  const sp = await searchParams
  const today = day(0)
  const [lead, activity, st, msgs, regions] = await Promise.all([
    db.lead.findUnique({
      where: { id },
      include: {
        region: true,
        owner: { select: { name: true } },
        trialBoxes: true,
        packages: { orderBy: { number: 'asc' } },
        calls: { orderBy: { createdAt: 'desc' } },
        followUps: { orderBy: { createdAt: 'desc' }, take: 5 },
        altBoxes: { orderBy: { givenOn: 'desc' }, take: 5 },
        attendance: { select: { date: true, status: true, boxes: true } },
      },
    }),
    db.activity.findMany({ where: { leadId: id }, include: { by: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    appSettings(),
    getSettings(),
    regionsList(),
  ])
  if (!lead) notFound()
  const kitchen = user.role === 'KITCHEN'
  const sales = user.role !== 'KITCHEN'
  const trial = lead.trialBoxes[0]
  const pkg = lead.packages.find((p) => p.status === 'ACTIVE') ?? lead.packages[lead.packages.length - 1]
  const plan = pkg ? planFor({ ...pkg, lead }, lead.attendance, today, await holidaySet()) : null
  const absentToday = lead.attendance.some((a) => a.date.getTime() === today.getTime() && a.status === 'ABSENT')
  const status =
    lead.customerStatus === 'INACTIVE' ? 'INACTIVE' : lead.customerStatus === 'PAUSED' && (!lead.pausedUntil || lead.pausedUntil >= today) ? 'PAUSED' : absentToday ? 'ABSENT' : 'ACTIVE'
  const birthday = lead.dob && lead.dob.getUTCDate() === today.getUTCDate() && lead.dob.getUTCMonth() === today.getUTCMonth()
  const self = `/customers/${lead.id}`
  // Next month: the delivery day after this pack's last day, never before tomorrow.
  const latest = pkg ? !lead.packages.some((p) => p.number > pkg.number) : false
  const nextStart = deliveryDayFrom(plan?.end && addDays(plan.end, 1) > day(1) ? addDays(plan.end, 1) : day(1))
  const proofs = pkg && sales && pkg.paymentProofIds.length ? await db.upload.findMany({ where: { id: { in: pkg.paymentProofIds } }, select: { id: true, mime: true } }) : []
  const shots = (pkg?.paymentProofIds ?? []).map((id) => proofs.find((x) => x.id === id)).filter((x) => !!x).map((x) => ({ id: x.id, isImage: x.mime.startsWith('image/') }))
  return (
    <>
      <div className="text-[13px] font-medium text-muted">
        <Link href={kitchen ? '/kitchen/customers' : '/customers'} className="hover:underline">Customers</Link> / {lead.name}
      </div>
      <ErrorNote error={sp.error} />
      {sp.paid && <Callout>Payment saved.</Callout>}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={lead.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[28px] font-bold">{lead.name}</h1>
            <StatusChip map={LEAD_STATUS} value={lead.status} />
            {lead.status === 'MONTHLY' && <StatusChip map={CUSTOMER_STATUS} value={status} />}
          </div>
          <p className="text-sm text-muted">
            {lead.phone} · {lead.region?.name ?? 'No region'} · {lead.deliveryTime ?? lead.slot ?? 'no delivery time'}
            {lead.owner ? ` · added by ${lead.owner.name}` : ''}
          </p>
        </div>
        <a href={`tel:${lead.phone}`} className="btn-secondary">Call</a>
        <WaLink href={waLink(lead.phone, '')} />
        {sales && <Link href={`/leads?lead=${lead.id}`} className="btn-secondary">Edit</Link>}
        <Link href={`${kitchen ? '/kitchen/customers' : '/customers'}?tab=all&status=${lead.id}`} className="btn-secondary">Set status</Link>
      </div>
      {birthday && (
        <Callout tone="brand">
          Birthday today. <a className="font-semibold text-brand underline" target="_blank" rel="noreferrer" href={waLink(lead.phone, fill(msgs.msgBirthday, { name: firstName(lead.name) }))}>Send a wish on WhatsApp</a>
        </Callout>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {pkg && plan ? (
            <Card
              title={`Package ${pkg.number} of ${lead.packages.length}`}
              sub={`${rupees(pkg.price)} · 26 boxes · Mon to Sat${pkg.boxesPerDay > 1 ? ` · ${pkg.boxesPerDay} boxes a day` : ''}${pkg.buttermilkQty ? ` · add-on drink ${pkg.buttermilkQty} bottle${pkg.buttermilkQty > 1 ? 's' : ''}` : ''}`}
              right={
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip map={PACKAGE_STATUS} value={pkg.status} />
                  {pkg.paid ? <Chip label={`Paid${pkg.paidAt ? ` ${fmtDay(pkg.paidAt)}` : ''}`} tone="leaf" /> : <Chip label="Not paid" tone="muted" />}
                  {sales && (pkg.paid ? (
                    <form action={setPackagePaidAction}>
                      <input type="hidden" name="packageId" value={pkg.id} />
                      <input type="hidden" name="back" value={self} />
                      <button name="paid" value="no" className="text-xs font-semibold text-muted hover:text-red">Undo</button>
                    </form>
                  ) : (
                    <Link href={`${self}?pay=1`} scroll={false} className="btn btn-sm">Mark paid</Link>
                  ))}
                </div>
              }
            >
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Start', fmtDay(pkg.startDate)],
                  ['End (leave carried forward)', plan.end ? fmtDay(plan.end) : 'Paused'],
                  [pkg.boxesPerDay > 1 ? 'Boxes delivered' : 'Delivered', plan.delivered],
                  ['Leave', plan.leave],
                  ['Left', 26 - plan.delivered],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <div className="text-xs text-muted">{k}</div>
                    <div className="font-display text-xl font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mb-4 flex items-center gap-3"><Progress value={plan.delivered} max={26} tone="leaf" /><span className="text-xs font-semibold">{plan.delivered}/26</span></div>
              {sales && pkg.paid && (
                <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-leaf-soft px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold text-leaf">Paid{pkg.paidAt ? ` ${fmtDay(pkg.paidAt)}` : ''}{pkg.paymentNote ? ` · ${pkg.paymentNote}` : ''}</span>
                  {shots.map((x, i) => (
                    <a key={x.id} href={`/api/files/${x.id}`} target="_blank" rel="noreferrer" title="Open the screenshot" className="flex size-11 items-center justify-center overflow-hidden rounded-md border border-line bg-surface text-[10px] font-bold text-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {x.isImage ? <img src={`/api/files/${x.id}`} alt={`Payment screenshot ${i + 1}`} className="size-full object-cover" /> : 'PDF'}
                    </a>
                  ))}
                  {shots.length === 0 && <span className="text-xs text-muted">No screenshot</span>}
                  <span className="flex-1" />
                  <Link href={`${self}?pay=1`} scroll={false} className="text-xs font-semibold text-sky">{shots.length ? 'Change' : 'Add screenshot'}</Link>
                </div>
              )}
              <PackageCalendar plan={plan} today={today} />
              {pkg.status === 'ACTIVE' && (
                <form action={setButtermilkAction} className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-line pt-4">
                  <input type="hidden" name="packageId" value={pkg.id} />
                  <input type="hidden" name="back" value={self} />
                  <div className="w-48">
                    <label className="label">Add-on drink (Mon, Wed, Fri) · Rs {pkg.buttermilkPrice}/month a bottle</label>
                    <select name="qty" className="input" defaultValue={String(pkg.buttermilkQty)}>
                      <option value="0">No add-on drink</option><option value="1">1 bottle</option><option value="2">2 bottles</option><option value="3">3 bottles</option>
                    </select>
                  </div>
                  <div className="w-44">
                    <label className="label">Boxes each day · each box counts in the 26</label>
                    <select name="boxes" className="input" defaultValue={String(pkg.boxesPerDay)}>
                      <option value="1">1 box</option><option value="2">2 boxes</option><option value="3">3 boxes</option>
                    </select>
                  </div>
                  <button className="btn-secondary">Save</button>
                  <span className="flex-1" />
                  <Link href={`/reports?pkg=${pkg.id}`} className="text-[13px] font-semibold text-sky">Monthly report</Link>
                </form>
              )}
            </Card>
          ) : (
            sales && (
              <Card title="No monthly pack yet" sub="Start one when the customer says yes">
                <Link href={`${self}?start=1`} className="btn">Start monthly pack</Link>
              </Card>
            )
          )}
          {pkg && latest && pkg.status !== 'CANCELLED' && (
            <div className={`flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3 ${pkg.status === 'COMPLETED' ? 'bg-leaf-soft' : 'bg-s2'}`}>
              <span className="flex-1 text-[13px] font-medium">
                {pkg.status === 'COMPLETED' ? `Month ${pkg.number} is finished. Continuing? Start month ${pkg.number + 1}.` : `Renewing early? Month ${pkg.number + 1} starts after this pack's last day.`}
              </span>
              <Link href={`${self}?start=1`} scroll={false} className={pkg.status === 'COMPLETED' ? 'btn' : 'btn-secondary btn-sm'}>Start month {pkg.number + 1}</Link>
            </div>
          )}
          {sales && pkg && pkg.status === 'CANCELLED' && (
            <Link href={`${self}?start=1`} className="btn-secondary">Start a new monthly pack</Link>
          )}
          <Card title="Customer details">
            <Row k="Foods to avoid" v={lead.avoidFoods ?? '—'} />
            <Row k="Salad to avoid" v={lead.avoidSalad ?? '—'} />
            <Row k="Health issues" v={lead.healthNotes ?? '—'} />
            <Row k="Date of birth" v={lead.dob ? fmtDay(lead.dob) : '—'} />
            <Row k="Time slot" v={lead.slot ?? '—'} />
            <Row k="Delivery time" v={lead.deliveryTime ?? '—'} />
            <Row k="Alternate phone" v={lead.altPhone ?? '—'} />
            <Row k="Source" v={sourceLabel(lead)} />
            {lead.notInterestedReason && <Row k="Not interested" v={lead.notInterestedReason} />}
            <Row k="Notes" v={lead.notes ?? '—'} />
          </Card>
          <Card title="Delivery location" right={<StatusChip map={LOCATION_STATUS} value={lead.locationStatus} />}>
            {lead.lat != null && lead.lng != null && <MapPin lat={lead.lat} lng={lead.lng} height={160} />}
            <Row k="Address" v={lead.address ?? '—'} />
            <div className="mt-2 flex flex-wrap gap-2.5">
              {lead.lat != null && <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${lead.lat},${lead.lng}`}>Open in Google Maps</a>}
              {sales && <Link className="btn-secondary btn-sm" href={`/leads/${lead.id}/location`}>Send location link</Link>}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {trial && (
            <Card title="Trial box" sub={`${fmtWeekday(trial.deliveryDate)} · ${trial.slot ?? 'no slot'}`} right={trial.result ? <StatusChip map={TRIAL_RESULT} value={trial.result} /> : <StatusChip map={TRIAL_STATUS} value={trial.status} />}>
              <Row k="Payment" v={trial.paid ? `Paid ${rupees(trial.price)}` : `Not paid (${rupees(trial.price)})`} />
              <Row k="Feedback" v={trial.feedback ?? '—'} />
              {sales && trial.status !== 'DONE' && trial.deliveryDate <= today && <Link href={`/trials?feedback=${trial.id}`} className="btn mt-2 w-full">Feedback call</Link>}
            </Card>
          )}
          {lead.packages.length > 0 && (
            <Card title="Packages">
              <div className="space-y-2">
                {lead.packages.map((p) => (
                  <Link key={p.id} href={`/reports?pkg=${p.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] hover:bg-s2">
                    <span className="font-semibold">Month {p.number}</span>
                    <span className="text-muted">from {fmtDay(p.startDate)}</span>
                    <span className="flex-1" />
                    <StatusChip map={PACKAGE_STATUS} value={p.status} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
          {(lead.calls.length > 0 || lead.followUps.length > 0) && (
            <Card title="Calls">
              <div className="space-y-2.5 text-[13px]">
                {lead.calls.map((c) => (
                  <div key={c.id}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">Day {c.dayNo}</span>
                      <StatusChip map={CUSTOMER_CALL} value={c.outcome} />
                      {c.renewal && <StatusChip map={RENEWAL} value={c.renewal} />}
                      <span className="flex-1" /><span className="text-xs text-muted">{fmtTime(c.createdAt)}</span>
                    </div>
                    {(c.note || c.reason) && <div className="text-muted">{[c.reason, c.note].filter(Boolean).join(' · ')}</div>}
                  </div>
                ))}
                {lead.followUps.map((f) => (
                  <div key={f.id}>
                    <div className="flex items-center gap-1.5"><span className="font-semibold">{f.outcome}</span><span className="flex-1" /><span className="text-xs text-muted">{fmtTime(f.createdAt)}</span></div>
                    {f.note && <div className="text-muted">{f.note}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {lead.altBoxes.length > 0 && (
            <Card title="Alternative boxes">
              {lead.altBoxes.map((b) => <Row key={b.id} k={`Box ${b.boxNo}`} v={`Sent ${fmtDay(b.givenOn)} · ${b.collectedOn ? `back ${fmtDay(b.collectedOn)}` : 'not back yet'}`} />)}
            </Card>
          )}
          <Card title="History">
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[a.kind] ?? 'bg-muted'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{a.text}</div>
                    <div className="text-xs text-muted">{[a.detail, a.by?.name ? `by ${a.by.name}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="font-mono text-[11px] text-muted">{fmtTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {sales && sp.pay && pkg && (
        <Drawer title={pkg.paid ? 'Payment' : 'Mark paid'} sub={`${lead.name} · Month ${pkg.number} · ${rupees(pkg.price + pkg.buttermilkQty * pkg.buttermilkPrice)}`} close={self}>
          <form action="/api/form/payment" method="post" encType="multipart/form-data" className="space-y-3.5">
            <input type="hidden" name="packageId" value={pkg.id} />
            <input type="hidden" name="back" value={`${self}?pay=1`} />
            <BillPhotos saved={shots} max={4} label="Payment screenshot (GPay / PhonePe / UPI)" name="proof" removeName="removeProof" />
            <div><label className="label">Note</label><input name="paymentNote" className="input" defaultValue={pkg.paymentNote ?? ''} placeholder="For example: GPay, ref 4521, paid by husband" /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={self} className="btn-secondary">Cancel</Link><button className="btn">{pkg.paid ? 'Save' : 'Mark paid'}</button></div>
          </form>
        </Drawer>
      )}
      {(sales || pkg) && sp.start && (
        <Drawer title={pkg ? `Start month ${lead.packages.length + 1}` : 'Start monthly pack'} sub={lead.name} close={self}>
          <form action={startPackageAction} className="space-y-3.5">
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="back" value={self} />
            <input type="hidden" name="self" value={`${self}?start=1`} />
            <PackageFields start={pkg ? nextStart : day(1)} regions={regions} slots={st.slots} regionId={lead.regionId} slot={lead.slot} price={st.monthlyPrice} bmPrice={st.buttermilkPrice} />
            <div className="grid grid-cols-2 gap-2.5"><Link href={self} className="btn-secondary">Cancel</Link><button className="btn">Start</button></div>
          </form>
        </Drawer>
      )}
    </>
  )
}
