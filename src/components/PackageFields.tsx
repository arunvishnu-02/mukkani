import { dayInput } from '@/lib/dates'
import type { Region } from '@/generated/prisma/client'

// Fields to start a monthly pack: start date, slot (required, no default), delivery time, region, buttermilk.
export function PackageFields({ start, regions, slots, regionId, slot, price, bmPrice }: { start: Date; regions: Region[]; slots: string[]; regionId?: string | null; slot?: string | null; price: number; bmPrice: number }) {
  return (
    <>
      <div className="text-xs font-bold tracking-wide text-muted uppercase">Monthly pack · Rs {price.toLocaleString('en-IN')} for 26 delivery days</div>
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="label">Start date</label><input type="date" name="startDate" className="input" defaultValue={dayInput(start)} /></div>
        <div>
          <label className="label">Time slot *</label>
          <select name="slot" className="input" defaultValue={slot ?? ''}><option value="">Pick a slot</option>{slots.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div><label className="label">Delivery time</label><input type="time" name="deliveryTime" className="input" /></div>
        <div>
          <label className="label">Region</label>
          <select name="regionId" className="input" defaultValue={regionId ?? ''}><option value="">Keep current</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <div>
          <label className="label">Buttermilk (Rs {bmPrice}/month a bottle)</label>
          <select name="buttermilkQty" className="input" defaultValue="0"><option value="0">No buttermilk</option><option value="1">1 bottle</option><option value="2">2 bottles</option><option value="3">3 bottles</option></select>
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="pkgPaid" className="size-4 accent-brand" /> Paid</label>
      </div>
    </>
  )
}
