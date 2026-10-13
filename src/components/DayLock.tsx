import { askDayPermission } from '@/app/(app)/ops-actions'
import { dayInput, fmtWeekday } from '@/lib/dates'
import { dayOpen, latestRequest } from '@/lib/lock'
import type { Role } from '@/generated/prisma/enums'

// Shown on a past day's screen for sales and the kitchen manager: the day is locked, with a button to ask the
// admin. Renders nothing when the day is open. Returns whether the day is open so the page can hide its forms.
export async function DayLock({ user, date, area, back }: { user: { id: string; role: Role }; date: Date; area: string; back: string }) {
  if (await dayOpen(user, date)) return null
  const last = await latestRequest(user.id, date)
  const waiting = last?.status === 'PENDING'
  return (
    <section className="rounded-[10px] border border-tur bg-tur-soft px-4 py-3.5">
      <div className="text-sm font-bold text-warn">{fmtWeekday(date)} is locked</div>
      <p className="mt-0.5 text-[13px]">A past day can be changed only with the admin&apos;s permission. Today can be changed freely.</p>
      {waiting ? (
        <p className="mt-2 text-[13px] font-semibold">Your request was sent. Waiting for the admin to allow it.</p>
      ) : (
        <form action={askDayPermission} className="mt-2.5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="date" value={dayInput(date)} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="back" value={back} />
          <div className="min-w-56 flex-1"><label className="label" htmlFor="lock-note">Why do you need to change it? *</label><input id="lock-note" name="note" required maxLength={200} className="input bg-white" placeholder="For example: one attendance was entered wrong" /></div>
          <button className="btn">Ask admin for permission</button>
        </form>
      )}
      {last?.status === 'REFUSED' && <p className="mt-2 text-[13px] font-semibold text-red">The admin refused your last request for this day.</p>}
      {last?.status === 'ALLOWED' && <p className="mt-2 text-[13px] text-muted">The earlier permission for this day has ended. Ask again if you still need it.</p>}
    </section>
  )
}
