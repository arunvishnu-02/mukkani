import Link from 'next/link'
import { fmtWeekday } from '@/lib/dates'
import type { CloseItem } from '@/lib/dayclose'

// Checklist shown before the next day's sheet: what is filled and what is still missing.
export function DayClose({ work, sheetDate, items, what = 'sheet' }: { work: Date; sheetDate: Date; items: CloseItem[]; what?: string }) {
  const left = items.filter((i) => !i.done)
  return (
    <section className={`card px-5 py-4 ${left.length ? 'border-tur' : ''}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-display text-lg font-semibold">{left.length ? `Finish ${fmtWeekday(work)} before the ${fmtWeekday(sheetDate)} ${what}` : `${fmtWeekday(work)} is closed`}</h2>
        <span className="text-[13px] text-muted">{left.length ? `${left.length} still to fill. ${what === 'sheet' ? 'The sheet prints when all are done.' : 'Tomorrow’s attendance opens when all are done.'}` : what === 'sheet' ? 'Everything is filled. The sheet is ready to print.' : 'Everything is done for the day.'}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <Link key={i.key} href={i.href} className={`flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 ${i.done ? 'bg-leaf-soft' : 'bg-tur-soft hover:ring-2 hover:ring-tur'}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i.done ? 'bg-leaf text-white' : 'border-2 border-warn text-warn'}`}>{i.done ? '✓' : '!'}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{i.label} <span className="text-[11px] font-medium text-muted">· {i.who}</span></span>
              <span className={`block truncate text-xs ${i.done ? 'text-leaf' : 'text-warn'}`}>{i.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
