import Image from 'next/image'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/settings'
import { DateField } from '@/components/DateField'
import { HomeLocation } from './HomeLocation'
import { submitInvite } from './actions'

export const metadata: Metadata = { title: 'Your details · Mukkani', robots: { index: false } }

// The form a new customer opens from the link we send. They fill in their own details and home location.
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params
  const sp = await searchParams
  const invite = await db.leadInvite.findUnique({ where: { token } })
  const valid = invite && invite.expiresAt > new Date()
  const [regions, st] = valid && !invite.filledAt ? await Promise.all([db.region.findMany({ orderBy: { name: 'asc' } }), appSettings()]) : [[], null]
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-surface px-5 py-7">
      <Image src="/mukkani-logo.png" alt="Mukkani" width={150} height={72} priority />
      {!valid ? (
        <p className="text-sm text-muted">This link has expired. Please ask Mukkani for a new one.</p>
      ) : invite.filledAt || sp.done ? (
        <div className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-leaf-soft text-xl font-bold text-leaf">✓</div>
          <h1 className="font-display text-2xl font-bold">Thank you! We have your details.</h1>
          <p className="text-sm leading-relaxed text-muted">Our team will call you soon about your fresh fruit and salad box. You can close this page now.</p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight">Welcome{invite.name ? `, ${invite.name.split(' ')[0]}` : ''}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">Please fill in your details so we can deliver your Mukkani box. It takes one minute. Everything marked * is needed.</p>
          </div>
          {sp.error && <div className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[13px] font-medium text-red">{sp.error}</div>}
          <form action={submitInvite} className="space-y-3.5">
            <input type="hidden" name="token" value={token} />
            <div><label className="label" htmlFor="j-name">Your name *</label><input id="j-name" name="name" required maxLength={80} autoComplete="name" className="input" defaultValue={invite.name ?? ''} /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label" htmlFor="j-phone">Phone *</label><input id="j-phone" name="phone" required inputMode="tel" autoComplete="tel" className="input" defaultValue={invite.phone} /></div>
              <div><label className="label" htmlFor="j-alt">Another phone</label><input id="j-alt" name="altPhone" inputMode="tel" className="input" /></div>
            </div>
            <HomeLocation />
            <div><label className="label" htmlFor="j-address">Address *</label><textarea id="j-address" name="address" rows={2} required className="input" placeholder="Door number, street, area, landmark" /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="label" htmlFor="j-region">Area *</label>
                <select id="j-region" name="regionId" required className="input" defaultValue=""><option value="">Pick your area</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              </div>
              <div>
                <label className="label" htmlFor="j-slot">Delivery time *</label>
                <select id="j-slot" name="slot" required className="input" defaultValue=""><option value="">Pick a time</option>{(st?.slots ?? []).map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            </div>
            <div><label className="label">Date of birth *</label><DateField name="dob" required birthday /></div>
            <div><label className="label" htmlFor="j-avoid">Fruits or foods you do not eat *</label><input id="j-avoid" name="avoidFoods" required className="input" placeholder="For example: banana, papaya. Type None if nothing" /></div>
            <div><label className="label" htmlFor="j-health">Any health condition we should know *</label><input id="j-health" name="healthNotes" required className="input" placeholder="For example: diabetes. Type None if nothing" /></div>
            <button className="btn w-full py-3.5 text-base">Submit</button>
            <p className="text-center text-xs text-muted">We use these details only for your Mukkani deliveries.</p>
          </form>
        </>
      )}
    </div>
  )
}
