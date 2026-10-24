import Image from 'next/image'
import { day, fmtDay, parseDay } from '@/lib/dates'
import { daySheet, groupByRegion, swapTotals } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { dayClose } from '@/lib/dayclose'
import { db } from '@/lib/db'

type Line = { time: string | null; name: string; tags: [string, string][]; bm: number; box: number | null; alt: boolean; status: string | null; back: boolean | null }

const MARK: Record<string, [string, string]> = { DELIVERED: ['✓ Delivered', 'text-leaf'], NOT_DELIVERED: ['✗ Not delivered', 'text-red'], ABSENT: ['Absent', 'text-warn'] }

const TAG: Record<string, string> = { red: 'bg-red-soft text-red', leaf: 'bg-leaf-soft text-leaf', warn: 'bg-tur-soft text-warn' }
const D = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

function Column({ rows, start, filled }: { rows: Line[]; start: number; filled?: boolean }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-ink text-[11px]">
      <thead>
        <tr className="bg-brand text-left text-[9px] font-bold text-white uppercase">
          <th className="w-6 px-1.5 py-1.5">#</th><th className="w-9 px-1">Time</th><th className="px-1">Customer</th><th className="w-9 px-1 text-center">Drink</th><th className="w-11 px-1 text-center">Box no.</th><th className="w-7 px-1 text-center">Ret.</th>{filled && <th className="w-20 px-1">Status</th>}
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
            <td className="px-1 text-center">{r.bm ? <span className="rounded bg-leaf px-1 text-[8px] font-bold text-white">{r.bm}</span> : ''}</td>
            <td className="px-1 text-center"><span className={`inline-block h-[18px] w-9 rounded border ${r.alt ? 'border-sky font-bold text-sky' : 'border-brand/40'}`}>{r.box ?? ''}</span></td>
            <td className="px-1 text-center">{filled && r.back != null ? <span className={`text-[10px] font-bold ${r.back ? 'text-leaf' : 'text-red'}`}>{r.back ? 'Yes' : 'No'}</span> : <span className="inline-block size-3.5 rounded-sm border border-ink/60" />}</td>
            {filled && <td className={`px-1 text-[10px] font-bold ${r.status ? MARK[r.status]?.[1] : 'text-muted'}`}>{r.status ? MARK[r.status]?.[0] : 'Not entered'}</td>}
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
  // filled=1: the attendance as entered (delivered, not delivered, box back), to print after delivery.
  const filled = sp.filled === '1'
  const onlySummary = sp.summary === '1'
  // The kitchen manager takes the next sheet only after the day's work is filled (stock, wastage, staff, menu).
  const user = await requireUser()
  if (user.role === 'KITCHEN' && !filled && date >= day(0)) {
    const close = await dayClose(date)
    if (!close.done) {
      // Admin is told once a day which items stopped the sheet.
      const text = `Kitchen could not print the ${fmtDay(date)} sheet`
      if (!(await db.adminNotice.findFirst({ where: { text, createdAt: { gte: new Date(Date.now() - 12 * 3_600_000) } } })))
        await db.adminNotice.create({ data: { text, detail: close.items.filter((i) => !i.done).map((i) => `${i.label} (${i.who}): ${i.detail}`).join('\n'), byId: user.id, byName: user.name, byRole: user.role } })
      return (
        <div className="mx-auto max-w-[560px] space-y-4 rounded-xl bg-white p-6 text-ink shadow">
          <h1 className="font-display text-2xl font-bold">Finish the day first</h1>
          <p className="text-sm text-muted">The {fmtDay(date)} sheet prints after these are filled for {fmtDay(close.work)}:</p>
          <ul className="space-y-2">
            {close.items.map((i) => (
              <li key={i.key} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i.done ? 'bg-leaf-soft' : 'bg-tur-soft'}`}>
                <span className="font-bold">{i.done ? '✓' : '!'}</span>
                <span className="flex-1"><b>{i.label}</b> · {i.who} · {i.detail}</span>
                {!i.done && <Link href={i.href} className="text-[13px] font-semibold text-sky underline">Fill now</Link>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">The menu is added by sales. If it is missing, ask sales or admin. Admin has been told what is missing.</p>
        </div>
      )
    }
  }
  const [sheet, st] = await Promise.all([daySheet(date), getSettings()])
  const monthly = sheet.rows.filter((r) => !r.absent)
  const grouped = new Map(groupByRegion(monthly, (r) => r.lead.region?.name))
  for (const t of sheet.trials) if (!grouped.has(t.trial.lead.region?.name ?? 'No region')) grouped.set(t.trial.lead.region?.name ?? 'No region', [])
  for (const r of sheet.rows) if (r.absent && !grouped.has(r.lead.region?.name ?? 'No region')) grouped.set(r.lead.region?.name ?? 'No region', [])
  const regions = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).filter(([name]) => !sp.region || name === sp.region)
  if (regions.length === 0) return <div className="a4 flex items-center justify-center text-muted">No deliveries on {fmtDay(date)}.</div>
  // Day summary (first page when printing all regions): boxes per region, menu, drinks, raw fruit, wastage.
  const [stock, waste] = await Promise.all([
    db.stockEntry.findMany({ where: { date } }),
    db.wastage.findMany({ where: { date } }),
  ])
  const kgBy = (rows: { fruit: string; kg: number }[]) => [...rows.reduce((m, r) => m.set(r.fruit, (m.get(r.fruit) ?? 0) + r.kg), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const raw = kgBy(stock.filter((e) => e.kind === 'IN').map((e) => ({ fruit: e.fruit, kg: e.qtyKg })))
  const cut = kgBy(stock.filter((e) => e.kind === 'USED').map((e) => ({ fruit: e.fruit, kg: e.qtyKg })))
  const wasted = kgBy(waste.filter((w) => w.wasteKg > 0).map((w) => ({ fruit: w.fruit, kg: w.wasteKg })))
  const kg = (n: number) => `${Math.round(n * 10) / 10} kg`
  const sum = (rows: [string, number][]) => rows.reduce((a, r) => a + r[1], 0)
  const allRegions = [...grouped.keys()].sort()
  const perRegion = allRegions.map((name) => {
    const rs = sheet.rows.filter((r) => (r.lead.region?.name ?? 'No region') === name)
    const on = rs.filter((r) => !r.absent)
    const tr = sheet.trials.filter((t) => (t.trial.lead.region?.name ?? 'No region') === name).length
    const boxes = on.reduce((a, r) => a + r.boxes, 0)
    return { name, customers: on.length, boxes, trials: tr, total: boxes + tr, drinks: on.reduce((a, r) => a + r.bm, 0), leave: rs.length - on.length }
  })
  const tot = perRegion.reduce((a, r) => ({ customers: a.customers + r.customers, boxes: a.boxes + r.boxes, trials: a.trials + r.trials, total: a.total + r.total, drinks: a.drinks + r.drinks, leave: a.leave + r.leave }), { customers: 0, boxes: 0, trials: 0, total: 0, drinks: 0, leave: 0 })
  const swapsAll = swapTotals([...sheet.rows.filter((r) => !r.absent).map((r) => r.swap), ...sheet.trials.map((t) => t.swap)])
  const Weights = ({ title, rows, empty }: { title: string; rows: [string, number][]; empty: string }) => (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1.5 flex items-baseline justify-between text-xs font-bold uppercase"><span>{title}</span><span className="font-display text-base">{rows.length ? kg(sum(rows)) : '____ kg'}</span></div>
      {rows.length ? rows.map(([f, n]) => <div key={f} className="flex text-[11px]"><span className="flex-1">{f}</span><span className="tabular-nums">{kg(n)}</span></div>)
        : <div className="space-y-2 pt-1 text-[11px] text-muted">{empty}{[0, 1, 2, 3].map((i) => <div key={i} className="h-4 border-b border-dashed border-ink/30" />)}</div>}
    </div>
  )
  return (
    <>
      {!sp.region && (
        <div className="a4 flex flex-col px-9 pt-6 pb-0">
          <div className="absolute inset-x-0 top-0 flex h-1.5"><span className="flex-[3] bg-brand" /><span className="flex-1 bg-leaf" /></div>
          <div className="flex items-start gap-4">
            <Image src="/mukkani-logo.png" alt="Mukkani" width={86} height={41} />
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">Day summary</h1>
              <div className="mt-1 text-xs text-muted">All regions · boxes, menu, add-on drink, fruit and wastage</div>
            </div>
            <div className="rounded-xl bg-brand-soft px-4 py-2 text-right">
              <div className="text-[9px] font-bold tracking-wider text-brand uppercase">Date</div>
              <div className="font-display text-base font-bold">{D.format(date)}</div>
            </div>
          </div>
          {sheet.holiday && <div className="mt-3 rounded-lg bg-red-soft px-3 py-2 text-sm font-bold text-red">Office holiday: {sheet.holiday.name}. No boxes go out.</div>}
          <table className="mt-4 w-full border-collapse overflow-hidden rounded-lg border border-ink text-[12px]">
            <thead><tr className="bg-brand text-left text-[10px] font-bold text-white uppercase"><th className="px-2 py-1.5">Region</th><th className="px-2 text-right">Customers</th><th className="px-2 text-right">Boxes</th><th className="px-2 text-right">Trial</th><th className="px-2 text-right">Total boxes</th><th className="px-2 text-right">Add-on drink</th><th className="px-2 text-right">On leave</th></tr></thead>
            <tbody className="tabular-nums">
              {perRegion.map((r) => <tr key={r.name} className="border-t border-line"><td className="px-2 py-1.5 font-semibold">{r.name}</td><td className="px-2 text-right">{r.customers}</td><td className="px-2 text-right">{r.boxes}</td><td className="px-2 text-right">{r.trials}</td><td className="px-2 text-right font-bold">{r.total}</td><td className="px-2 text-right">{r.drinks || '–'}</td><td className="px-2 text-right">{r.leave || '–'}</td></tr>)}
              <tr className="border-t-2 border-ink bg-brand-soft font-bold"><td className="px-2 py-1.5">Total</td><td className="px-2 text-right">{tot.customers}</td><td className="px-2 text-right">{tot.boxes}</td><td className="px-2 text-right">{tot.trials}</td><td className="px-2 text-right text-base">{tot.total}</td><td className="px-2 text-right">{tot.drinks || '–'}</td><td className="px-2 text-right">{tot.leave || '–'}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 rounded-xl bg-leaf-soft p-3.5 text-[12px]">
            <div className="mb-1 text-xs font-bold uppercase">Menu</div>
            {sheet.menu ? (
              <div className="space-y-0.5">
                <div><b>Fruits:</b> {sheet.menu.fruits}</div>
                <div><b>Salad:</b> {sheet.menu.salad || '—'}</div>
                <div><b>Customization:</b> {swapsAll.length ? swapsAll.map(([f, n]) => `${f} ${n}`).join(' · ') : 'none'}{sheet.menu.swapFruits ? ` (fruits to give instead: ${sheet.menu.swapFruits})` : ''}</div>
                {sheet.menu.note && <div><b>Note:</b> {sheet.menu.note}</div>}
              </div>
            ) : <div className="text-red">Menu not added yet</div>}
            <div className="mt-1.5"><b>Add-on drink:</b> {tot.drinks ? `${tot.drinks} bottle${tot.drinks > 1 ? 's' : ''}` : 'none today (Mon, Wed, Fri only)'}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Weights title="Raw fruit came in" rows={raw} empty="Write fruit and kg:" />
            <Weights title="Cut for boxes" rows={cut} empty="Write fruit and kg:" />
            <Weights title="Wastage" rows={wasted} empty="Write fruit and kg:" />
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-3 gap-6 pt-6 pb-3 text-[10px] text-muted">
            <div className="border-t border-ink/40 pt-1">Total boxes packed ____ / {tot.total}</div>
            <div className="border-t border-ink/40 pt-1">Boxes returned ____</div>
            <div className="border-t border-ink/40 pt-1">Kitchen manager sign</div>
          </div>
          <div className="-mx-9 bg-s2 px-9 py-2 text-[9px] text-muted">Mukkani · Fresh fruit and salad boxes · {st.address} · {st.businessPhone}</div>
        </div>
      )}
      {!onlySummary && regions.flatMap(([region, rows]) => {
        const lines: Line[] = rows.map((r) => ({
          time: r.lead.deliveryTime,
          name: r.lead.name,
          tags: [
            ...(r.swap?.swapTo ? ([[`No ${r.swap.avoids.join(', ')} → ${r.swap.swapTo}`, 'red']] as [string, string][]) : []),
            ...(r.isNew ? ([['New', 'leaf']] as [string, string][]) : []),
            ...(r.boxes > 1 ? ([[`${r.boxes} boxes`, 'red']] as [string, string][]) : []),
            ...(r.dayNo && r.dayNo >= 25 ? ([[`Day ${r.dayNo}`, 'warn']] as [string, string][]) : []),
          ],
          bm: r.bm,
          box: r.altBox,
          alt: !!r.altBox,
          status: r.attendance?.status ?? null,
          back: r.attendance?.boxBack ?? null,
        }))
        const trials = sheet.trials.filter((t) => (t.trial.lead.region?.name ?? 'No region') === region)
        const leave = sheet.paused.filter((p) => (p.region?.name ?? 'No region') === region)
        const absent = sheet.rows.filter((r) => r.absent && (r.lead.region?.name ?? 'No region') === region)
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
                <h1 className="font-display text-2xl font-bold">Customer Attendance{filled ? ' · entered' : ''}</h1>
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
                [bm, 'Add-on drink', 'bg-[#fbe4ef]'],
                [trials.length, 'Trial box', 'bg-tur-soft'],
                [swaps, 'Customizations', 'bg-red-soft'],
              ].map(([n, l, c]) => (
                <div key={l as string} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${c}`}>
                  <span className="font-display text-xl font-bold">{n}</span><span className="text-[10px] font-bold tracking-wide uppercase">{l}</span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <Column rows={page.slice(0, 25)} start={p * 50 + 1} filled={filled} />
              {page.length > 25 ? <Column rows={page.slice(25)} start={p * 50 + 26} filled={filled} /> : <div />}
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
                  <div className="mb-1.5 text-xs font-bold">On leave · not packed</div>
                  {absent.map((r) => (
                    <div key={r.pkg.id} className="flex"><span className="flex-1">{r.lead.name}</span><span className="text-muted">absent today</span></div>
                  ))}
                  {leave.length + absent.length === 0 ? <div className="text-muted">Nobody on leave</div> : leave.map((l) => (
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
