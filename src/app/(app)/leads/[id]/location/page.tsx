import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtTime } from '@/lib/dates'
import { Chip, PageHeader } from '@/components/ui'
import { CopyButton } from '@/components/CopyButton'
import { MapPin } from '@/components/MapPin'
import { requestLocationAction } from '../../../actions'

function waPhone(p: string) {
  const d = p.replace(/\D/g, '')
  return d.length === 10 ? `91${d}` : d
}

export default async function LocationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(['SALES'])
  const { id } = await params
  const lead = await db.lead.findUnique({
    where: { id },
    include: { region: true, locationRequests: { orderBy: { createdAt: 'desc' }, take: 1, include: {} } },
  })
  if (!lead) notFound()
  const req = lead.locationRequests[0]
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const link = req ? `${base}/loc/${req.token}` : null
  const first = lead.name.split(' ')[0]
  const msg = link
    ? `Hi ${first}, this is Mukkani. Please tap the link below to share your exact delivery location so your box reaches the right door.\n${link}`
    : ''
  const steps = ['Sales sends the link', 'Customer taps Share my location', 'Exact pin saved on the lead']
  return (
    <>
      <PageHeader crumb={<><Link href={`/leads?lead=${lead.id}`} className="hover:underline">Leads</Link> / {lead.name}</>} title="Get exact delivery location" sub="Send the customer a link. One tap on their phone saves the exact spot to this lead." />
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2.5 rounded-full border border-line bg-surface px-3 py-2 text-[13px] font-semibold">
            <span className="flex size-[22px] items-center justify-center rounded-full bg-leaf text-xs text-white">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">1. Send location link</h2>
              <p className="text-[13px] text-muted">To {lead.phone}</p>
            </div>
            {req && !req.sharedAt && <Chip label="Waiting" tone="warn" />}
          </div>
          {!req ? (
            <form action={requestLocationAction} className="grid grid-cols-2 gap-2.5">
              <input type="hidden" name="id" value={lead.id} />
              <button name="channel" value="WhatsApp" className="btn">Create WhatsApp link</button>
              <button name="channel" value="SMS" className="btn-secondary">Create SMS link</button>
            </form>
          ) : (
            <>
              <div className="whitespace-pre-line rounded-[10px] bg-[#dff3d6] p-3.5 text-[13px] leading-[19px]">{msg}</div>
              <div className="grid grid-cols-2 gap-2.5">
                <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/${waPhone(lead.phone)}?text=${encodeURIComponent(msg)}`}>Send on WhatsApp</a>
                <a className="btn-secondary" href={`sms:${lead.phone}?body=${encodeURIComponent(msg)}`}>Send SMS</a>
                <CopyButton text={msg} label="Copy message" />
                <form action={requestLocationAction}>
                  <input type="hidden" name="id" value={lead.id} />
                  <button name="channel" value={req.channel} className="btn-secondary w-full">New link</button>
                </form>
              </div>
              <p className="text-xs text-muted">Link created {fmtTime(req.createdAt)} · works for 7 days</p>
            </>
          )}
        </section>
        <section className="card space-y-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">2. Exact location saved</h2>
              <p className="text-[13px] text-muted">{lead.locationUpdatedAt ? `Shared ${fmtTime(lead.locationUpdatedAt)}` : 'Shows here when the customer taps the link'}</p>
            </div>
            {lead.locationStatus === 'PIN_SAVED' && <Chip label="Saved" tone="leaf" />}
          </div>
          {lead.lat != null && lead.lng != null ? (
            <>
              <MapPin lat={lead.lat} lng={lead.lng} />
              <div className="text-sm font-semibold">{lead.address ?? 'Address not found, pin saved'}</div>
              <div className="font-mono text-xs text-muted">
                {lead.lat.toFixed(5)}° N, {lead.lng.toFixed(5)}° E{lead.accuracyM ? ` · accurate to ${lead.accuracyM} m` : ''}
              </div>
              {lead.region && <div className="text-xs font-semibold text-leaf">Region set to {lead.region.name} automatically</div>}
              <div className="grid grid-cols-2 gap-2.5">
                <a className="btn" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${lead.lat},${lead.lng}`}>Open in Google Maps</a>
                <CopyButton text={`https://www.google.com/maps?q=${lead.lat},${lead.lng}`} label="Copy map link" />
              </div>
            </>
          ) : (
            <div className="rounded-[10px] bg-s2 px-4 py-10 text-center text-sm text-muted">No pin yet. Refresh after the customer shares.</div>
          )}
        </section>
      </div>
    </>
  )
}
