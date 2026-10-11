import Image from 'next/image'
import { day, fmtDay, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion } from '@/lib/queries'
import { getSettings } from '@/lib/settings'

type Line = { time: string | null; name: string; tags: [string, string][]; bm: number; box: number | null; alt: boolean }

const TAG: Record<string, string> = { red: 'bg-red-soft text-red', leaf: 'bg-leaf-soft text-leaf', warn: 'bg-tur-soft text-warn' }
const D = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

function Column({ rows, start }: { rows: Line[]; start: number }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-ink text-[11px]">
      <thead>
        <tr className="bg-brand text-left text-[9px] font-bold text-white uppercase">
          <th className="w-6 px-1.5 py-1.5">#</th><th className="w-9 px-1">Time</th><th className="px-1">Customer</th><th className="w-7 px-1 text-center">BM</th><th className="w-11 px-1 text-center">Box no.</th><th className="w-7 px-1 text-center">Ret.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`h-[26px] border-t border-line ${r.alt ? 'bg-sky-soft' : i % 2 ? 'bg-[#f8f6fb]' : ''}`}>
            <td className="px-1.5 text-muted">{start + i}</td>
            <td className="px-1 font-semibold">{r.time ?? ''}</td>
            <td className="px-1 font-semibold">
              {r.name}
              {r.tags.map(([t, c]) => <span key={t} className={`ml-1 rounded px-1 py-px text-[8px] font-bold uppercase ${TAG[c]}`}>{t}</span>)}
            </td>
            <td className="px-1 text-center">{r.bm ? <span className="rounded bg-leaf px-1 text-[8px] font-bold text-white">BM{r.bm > 1 ? ` ${r.bm}` : ''}</span> : ''}</td>
            <td className="px-1 text-center"><span className={`inline-block h-[18px] w-9 rounded border ${r.alt ? 'border-sky font-bold text-sky' : 'border-brand/40'}`}>{r.box ?? ''}</span></td>
            <td className="px-1 text-center"><span className="inline-block size-3.5 rounded-sm border border-ink/60" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Daily customer attendance sheet: one A4 per region, up to 50 customers per page. Printed at 3 AM.
export default async function SheetPrint({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const date = sp.date ? parseDay(sp.date) : day(0)
  const [sheet, st] = await Promise.all([daySheet(date), getSettings()])
  const monthly = sheet.rows.filter((r) => !r.absent)
  const grouped = new Map(groupByRegion(monthly, (r) => r.lead.region?.name))
  for (const t of sheet.trials) if (!grouped.has(t.trial.lead.region?.name ?? 'No region')) grouped.set(t.trial.lead.region?.name ?? 'No region', [])
  const regions = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).filter(([name]) => !sp.region || name === sp.region)
  if (regions.length === 0) return <div className="a4 flex items-center justify-center text-muted">No deliveries on {fmtDay(date)}.</div>
  return (
    <>
      {regions.flatMap(([region, rows]) => {
        const lines: Line[] = rows.map((r) => ({
          time: r.lead.deliveryTime,
          name: r.lead.name,
          tags: [
            ...(r.swap?.swapTo ? ([[`No ${r.swap.avoids.join(', ')} → ${r.swap.swapTo}`, 'red']] as [string, string][]) : []),
            ...(r.isNew ? ([['New', 'leaf']] as [string, string][]) : []),
            ...(r.dayNo && r.dayNo >= 25 ? ([[`Day ${r.dayNo}`, 'warn']] as [string, string][]) : []),
          ],
          bm: r.bm,
          box: r.altBox,
          alt: !!r.altBox,
        }))
        const trials = sheet.trials.filter((t) => (t.trial.lead.region?.name ?? 'No region') === region)
        const leave = sheet.paused.filter((p) => (p.region?.name ?? 'No region') === region)
        const swaps = rows.filter((r) => r.swap?.swapTo).length + trials.filter((t) => t.swap?.swapTo).length
        const bm = rows.reduce((a, r) => a + r.bm, 0)
        const pages: Line[][] = []
        for (let i = 0; i < Math.max(1, lines.length); i += 50) pages.push(lines.slice(i, i + 50))
        return pages.map((page, p) => (
          <div key={`${region}-${p}`} className="a4 flex flex-col px-9 pt-6 pb-0">
            <div className="absolute inset-x-0 top-0 flex h-1.5"><span className="flex-[3] bg-brand" /><span className="flex-1 bg-leaf" /></div>
            <div className="flex items-start gap-4">
              <Image src="/mukkani-logo.png" alt="Mukkani" width={86} height={41} />
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold">Customer Attendance</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">{region} region</span>
                  Morning delivery · {st.slots.split('\n')[0]?.split(' to ')[0]} to 8:00 AM{pages.length > 1 ? ` · page ${p + 1} of ${pages.length}` : ''}
                </div>
              </div>
              <div className="rounded-xl bg-brand-soft px-4 py-2 text-right">
                <div className="text-[9px] font-bold tracking-wider text-brand uppercase">Date</div>
                <div className="font-display text-base font-bold">{D.format(date)}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              {[
                [rows.length, 'Boxes', 'bg-brand-soft'],
                [bm, 'Buttermilk', 'bg-[#fbe4ef]'],
                [trials.length, 'Trial box', 'bg-tur-soft'],
                [swaps, 'Fruit swaps', 'bg-red-soft'],
              ].map(([n, l, c]) => (
                <div key={l as string} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${c}`}>
                  <span className="font-display text-xl font-bold">{n}</span><span className="text-[10px] font-bold tracking-wide uppercase">{l}</span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <Column rows={page.slice(0, 25)} start={p * 50 + 1} />
              {page.length > 25 ? <Column rows={page.slice(25)} start={p * 50 + 26} /> : <div />}
            </div>
            {p === pages.length - 1 && (
              <div className="mt-3.5 grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl bg-tur-soft px-3.5 py-3">
                  <div className="mb-1.5 text-xs font-bold text-warn">Trial pack</div>
                  {trials.length === 0 ? <div className="text-muted">No trial boxes</div> : trials.map((t) => (
                    <div key={t.trial.id} className="mb-1 flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="rounded bg-tur-soft px-1.5 text-[10px] font-bold text-warn">{t.trial.boxNo ? `T-${t.trial.boxNo}` : 'Trial'}</span>
                      <span className="flex-1"><b>{t.trial.lead.name}</b> · {t.trial.lead.deliveryTime ?? t.trial.slot} · Rs {t.trial.price} {t.trial.paid ? 'paid' : 'to collect'}</span>
                      <span className="inline-block size-3.5 rounded-sm border border-ink/60" /> Box back
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-s2 px-3.5 py-3">
                  <div className="mb-1.5 text-xs font-bold">On long leave · not packed</div>
                  {leave.length === 0 ? <div className="text-muted">Nobody on leave</div> : leave.map((l) => (
                    <div key={l.id} className="flex"><span className="flex-1">{l.name}</span><span className="text-muted">{l.pausedUntil ? `till ${fmtDay(l.pausedUntil)}` : 'paused'}</span></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1" />
            <div className="grid grid-cols-3 gap-6 pt-6 pb-3 text-[10px] text-muted">
              <div className="border-t border-ink/40 pt-1">Delivered by</div>
              <div className="border-t border-ink/40 pt-1">Boxes returned ___ / {page.length}</div>
              <div className="border-t border-ink/40 pt-1">Kitchen manager sign</div>
            </div>
            <div className="-mx-9 bg-s2 px-9 py-2 text-[9px] text-muted">Mukkani · Fresh fruit and salad boxes · {st.address} · {st.businessPhone}</div>
          </div>
        ))
      })}
    </>
  )
}
