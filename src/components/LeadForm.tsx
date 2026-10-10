import { SOURCE } from '@/lib/labels'
import { dayInput } from '@/lib/dates'
import type { Lead, Region } from '@/generated/prisma/client'

// Customer details sales collects (plan doc section 1).
export function LeadFields({ lead, regions, slots }: { lead?: Lead | null; regions: Region[]; slots: string[] }) {
  return (
    <>
      <div><label className="label">Name *</label><input name="name" className="input" required defaultValue={lead?.name} /></div>
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="label">Phone *</label><input name="phone" className="input" inputMode="tel" required defaultValue={lead?.phone} /></div>
        <div><label className="label">Alternate phone</label><input name="altPhone" className="input" inputMode="tel" defaultValue={lead?.altPhone ?? ''} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label">Source</label>
          <select name="source" className="input" defaultValue={lead?.source ?? 'WHATSAPP'}>{Object.entries(SOURCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div><label className="label">Date of birth</label><input type="date" name="dob" className="input" defaultValue={dayInput(lead?.dob)} /></div>
      </div>
      <div><label className="label">Address</label><input name="address" className="input" placeholder="Or send a location link after saving" defaultValue={lead?.address ?? ''} /></div>
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="label">Region</label>
          <select name="regionId" className="input" defaultValue={lead?.regionId ?? ''}><option value="">Not set</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <div>
          <label className="label">Time slot</label>
          <select name="slot" className="input" defaultValue={lead?.slot ?? ''}><option value="">Not set</option>{slots.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div><label className="label">Delivery time</label><input type="time" name="deliveryTime" className="input" defaultValue={lead?.deliveryTime ?? ''} /></div>
      </div>
      <div><label className="label">Foods to avoid</label><input name="avoidFoods" className="input" placeholder="For example: banana, papaya" defaultValue={lead?.avoidFoods ?? ''} /></div>
      <div><label className="label">Health issues</label><input name="healthNotes" className="input" placeholder="For example: sugar patient" defaultValue={lead?.healthNotes ?? ''} /></div>
      <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" defaultValue={lead?.notes ?? ''} /></div>
    </>
  )
}
