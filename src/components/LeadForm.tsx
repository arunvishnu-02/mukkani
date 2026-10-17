import { SOURCE } from '@/lib/labels'
import { Reveal } from '@/components/Reveal'
import { dayInput } from '@/lib/dates'
import type { Lead, Region } from '@/generated/prisma/client'
import { DateField } from '@/components/DateField'

// Customer details sales collects (plan doc section 1).
export function LeadFields({ lead, regions, slots }: { lead?: Lead | null; regions: Region[]; slots: string[] }) {
  return (
    <>
      <p className="text-xs text-muted">Fields marked * must be filled. Only Alternate phone, Delivery time and Notes can be left empty.</p>
      <div><label className="label">Name *</label><input name="name" className="input" required defaultValue={lead?.name} /></div>
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="label">Phone *</label><input name="phone" className="input" inputMode="tel" required defaultValue={lead?.phone} /></div>
        <div><label className="label">Alternate phone</label><input name="altPhone" className="input" inputMode="tel" defaultValue={lead?.altPhone ?? ''} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label">Source *</label>
          <select name="source" required className="input" defaultValue={lead?.source ?? 'WHATSAPP'}>{Object.entries(SOURCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div><label className="label">Date of birth *</label><DateField name="dob" required defaultValue={dayInput(lead?.dob)} birthday /></div>
      </div>
      <Reveal name="source" values={['OTHER']} initial={lead?.source ?? 'WHATSAPP'}>
        <div><label className="label">Which other source? *</label><input name="sourceOther" className="input" defaultValue={lead?.sourceOther ?? ''} placeholder="For example: friend, pamphlet, apartment group" /></div>
      </Reveal>
      <div><label className="label">Address *</label><input name="address" required className="input" placeholder="Door number, street, area" defaultValue={lead?.address ?? ''} /></div>
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="label">Region *</label>
          <select name="regionId" required className="input" defaultValue={lead?.regionId ?? ''}><option value="">Pick a region</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <div>
          <label className="label">Time slot</label>
          <select name="slot" className="input" defaultValue={lead?.slot ?? ''}><option value="">Pick a slot</option>{slots.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div><label className="label">Delivery time</label><input type="time" name="deliveryTime" className="input" defaultValue={lead?.deliveryTime ?? ''} /></div>
      </div>
      <div><label className="label">Foods to avoid *</label><input name="avoidFoods" required className="input" placeholder="For example: banana, papaya. Type None if nothing" defaultValue={lead?.avoidFoods ?? ''} /></div>
      <div><label className="label">Health issues *</label><input name="healthNotes" required className="input" placeholder="For example: sugar patient. Type None if nothing" defaultValue={lead?.healthNotes ?? ''} /></div>
      <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" defaultValue={lead?.notes ?? ''} /></div>
    </>
  )
}
