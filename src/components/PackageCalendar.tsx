import { fmtDay, keyOf } from '@/lib/dates'
import { calendarWeeks, type PackagePlan } from '@/lib/plan'

// The full ~30 calendar days of a package (Arun, 10 Oct): Sundays in the holiday colour,
// days carried forward by leave or not delivered in blue.
const STYLE = {
  delivered: 'bg-leaf text-white',
  leave: 'bg-tur text-white',
  notDelivered: 'bg-red text-white',
  paused: 'bg-sky-soft text-sky',
  holiday: 'bg-[#dcd6e3] text-muted',
  planned: 'bg-s2 text-ink',
  carried: 'bg-sky text-white',
  outside: 'border border-dashed border-line text-line',
}

export function PackageCalendar({ plan, today }: { plan: PackagePlan; today: Date }) {
  const weeks = calendarWeeks(plan)
  const t = keyOf(today)
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className={d === 'Sun' ? 'text-red' : ''}>{d}</div>)}
      </div>
      <div className="mt-1.5 space-y-1.5">
        {weeks.map((w, i) => (
          <div key={i} className="grid grid-cols-7 gap-1.5">
            {w.map((d) => {
              const kind = d.kind === 'planned' && 'carried' in d && d.carried ? 'carried' : d.kind
              const isToday = keyOf(d.date) === t
              const label =
                d.kind === 'outside' ? '' :
                d.kind === 'holiday' ? 'Holiday' :
                d.kind === 'leave' ? 'Leave' :
                d.kind === 'notDelivered' ? 'Not delivered' :
                d.kind === 'paused' ? 'Paused' :
                `Day ${'dayNo' in d ? d.dayNo : ''}${kind === 'carried' ? ' · +1' : ''}${isToday ? ' · Today' : ''}`
              return (
                <div
                  key={keyOf(d.date)}
                  className={`min-h-12 rounded-lg px-2 py-1.5 ${STYLE[kind]} ${isToday ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                >
                  <div className="text-[13px] font-bold">{fmtDay(d.date)}</div>
                  <div className="text-[11px] opacity-90">{label}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ['bg-leaf', 'Delivered'],
          ['bg-tur', 'Leave'],
          ['bg-red', 'Not delivered'],
          ['bg-s2 ring-2 ring-brand', 'Today'],
          ['bg-[#dcd6e3]', 'Sunday holiday'],
          ['bg-sky', 'Carried forward'],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${c}`} />{l}</span>
        ))}
      </div>
    </div>
  )
}
