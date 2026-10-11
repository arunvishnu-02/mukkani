import Link from 'next/link'
import { cancelLeaveAction, markLeaveAction } from '@/app/(app)/actions'
import { DateField } from '@/components/DateField'
import { Drawer } from '@/components/ui'

// A customer says they will not take the box on a day. Marking it here takes them off that day's
// attendance sheet straight away and moves the day to the end of their pack.
export function LeaveDrawer({ customers, date, close, self }: { customers: { id: string; name: string; phone: string; region: string | null }[]; date: string; close: string; self: string }) {
  return (
    <Drawer title="Mark leave" sub="For a customer who told you they will not take the box" close={close}>
      <form action={markLeaveAction} className="space-y-3.5">
        <input type="hidden" name="back" value={close} />
        <input type="hidden" name="self" value={self} />
        <div>
          <label className="label" htmlFor="leave-lead">Customer *</label>
          <select id="leave-lead" name="leadId" required defaultValue="" className="input">
            <option value="">Pick a monthly customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.region ?? 'No region'} · {c.phone}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className="label">Leave on *</label><DateField name="from" required defaultValue={date} /></div>
          <div><label className="label">Until (if more days)</label><DateField name="to" /></div>
        </div>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
          <li>The customer is left off the attendance sheet for those days and shown under On leave.</li>
          <li>Each leave day is added to the end of their 26-day pack. Sundays are skipped.</li>
          <li>Up to 14 days here. For a longer break, set the customer to Paused in Customers.</li>
        </ul>
        <div className="grid grid-cols-2 gap-2.5"><Link href={close} className="btn-secondary">Cancel</Link><button className="btn">Save leave</button></div>
      </form>
    </Drawer>
  )
}

// One row of an On leave list, with a button to take the leave back while the day has not passed.
export function CancelLeave({ leadId, date, back }: { leadId: string; date: string; back: string }) {
  return (
    <form action={cancelLeaveAction}>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="back" value={back} />
      <button className="btn-secondary btn-sm">Cancel leave</button>
    </form>
  )
}
