import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay, fmtRange, fmtTime } from '@/lib/dates'
import { LOCATION_STATUS, PACKAGE_STATUS, SOURCE, TRIAL_FLOW, TRIAL_STATUS, rupees } from '@/lib/labels'
import { boxType, leadInclude } from '@/lib/queries'
import { Avatar, Callout, Card, Chip, StatusChip } from '@/components/ui'
import { MapPin } from '@/components/MapPin'

function Row({ k, v, auto }: { k: string; v: React.ReactNode; auto?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-[13px] text-muted">{k}</span>
      <span className="min-w-0 flex-1 font-medium">{v}</span>
      {auto && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-[11px] font-bold text-leaf">Auto-updated</span>}
    </div>
  )
}

const DOT: Record<string, string> = { location: 'bg-leaf', trial: 'bg-tur', package: 'bg-leaf', call: 'bg-sky', alert: 'bg-warn' }

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(['SALES'])
  const { id } = await params
  const [lead, activity] = await Promise.all([
    db.lead.findUnique({ where: { id }, include: leadInclude }),
    db.activity.findMany({ where: { leadId: id }, include: { by: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ])
  if (!lead) notFound()
  const b = boxType(lead)
  const trial = lead.trialBoxes[0]
  const pkg = lead.packages[0]
  const auto = lead.locationUpdatedAt != null
  const step = trial ? TRIAL_FLOW.indexOf(trial.status) : -1
  return (
    <>
      <div className="text-[13px] font-medium text-muted"><Link href="/customers" className="hover:underline">Customers</Link> / {lead.name}</div>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={lead.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[28px] font-bold">{lead.name}</h1>
            {b && <Chip label={b} tone={b === 'Regular box' ? 'leaf' : 'warn'} />}
          </div>
          <p className="text-sm text-muted">
            {lead.phone} · {lead.region?.name ?? 'No region'} · customer since {fmtDay(pkg?.startDate ?? trial?.startDate)}
            {lead.owner ? ` · handled by ${lead.owner.name}` : ''}
          </p>
        </div>
        <a href={`tel:${lead.phone}`} className="btn-secondary">Call</a>
        <Link href={`/leads?lead=${lead.id}`} className="btn-secondary">Edit</Link>
      </div>
      {auto && (
        <Callout>Location received from the customer {fmtTime(lead.locationUpdatedAt!)}. Address, map pin and region below were filled in automatically.</Callout>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card title="Delivery location" sub="From the customer's phone GPS" right={<StatusChip map={LOCATION_STATUS} value={lead.locationStatus} />}>
            {lead.lat != null && lead.lng != null ? <MapPin lat={lead.lat} lng={lead.lng} height={180} /> : <div className="rounded-[10px] bg-s2 py-10 text-center text-sm text-muted">No pin yet</div>}
            <div className="mt-2">
              <Row k="Address" v={lead.address ?? '—'} auto={auto && !!lead.address} />
              <Row k="Map pin" v={<span className="font-mono text-[13px]">{lead.lat != null ? `${lead.lat.toFixed(5)}° N, ${lead.lng!.toFixed(5)}° E${lead.accuracyM ? ` · ${lead.accuracyM} m` : ''}` : '—'}</span>} auto={auto} />
              <Row k="Region" v={lead.region?.name ?? '—'} auto={auto && !!lead.region} />
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {lead.lat != null ? <a className="btn" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${lead.lat},${lead.lng}`}>Open in Google Maps</a> : <span />}
              <Link className="btn-secondary" href={`/leads/${lead.id}/location`}>Send new location link</Link>
            </div>
          </Card>
          <Card title="Customer details">
            <Row k="Phone" v={lead.phone} />
            <Row k="Alternate" v={lead.altPhone ?? '—'} />
            <Row k="Source" v={SOURCE[lead.source]} />
            <Row k="Delivery slot" v={lead.slot ?? '—'} />
            <Row k="Food notes" v={lead.foodNotes ?? '—'} />
            <Row k="Notes" v={lead.notes ?? '—'} />
          </Card>
        </div>
        <div className="space-y-4">
          {pkg && (pkg.status === 'ACTIVE' || pkg.status === 'PAUSED') ? (
            <Card title="Regular box" sub={pkg.packageType} right={<StatusChip map={PACKAGE_STATUS} value={pkg.status} />} className="border-leaf">
              <Row k="Price" v={`${rupees(pkg.price)}/month`} />
              <Row k="Started" v={fmtDay(pkg.startDate)} />
              <Row k="Delivery slot" v={lead.slot ?? '—'} />
              <Link href="/boxes?tab=regular" className="mt-2 block text-[13px] font-semibold text-sky">Pause or change in Trial / Regular boxes</Link>
            </Card>
          ) : trial ? (
            <Card title="Trial box" sub="7-day trial before a regular box" right={<StatusChip map={TRIAL_STATUS} value={trial.status} />} className="border-tur">
              <div className="grid grid-cols-6 gap-1">
                {['Requested', 'Assigned', 'Preparing', 'Delivered', 'Trial active', 'Completed'].map((s, i) => (
                  <div key={s}>
                    <div className={`h-1.5 rounded ${i <= step ? 'bg-tur' : 'bg-line'}`} />
                    <div className={`mt-1.5 text-[10px] ${i === step ? 'font-bold text-warn' : 'font-medium text-muted'}`}>{s}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Row k="Trial dates" v={fmtRange(trial.startDate, trial.endDate)} />
                <Row k="Kitchen notes" v={trial.notes ?? '—'} />
              </div>
              {trial.status === 'COMPLETED' && !trial.result && (
                <Link href={`/boxes?result=${trial.id}`} className="btn mt-3 w-full">Record trial result</Link>
              )}
            </Card>
          ) : null}
          <Card title="Activity">
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
    </>
  )
}
