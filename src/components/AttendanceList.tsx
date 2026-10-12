'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { clearAttendanceRowAction, saveAttendanceRowAction } from '@/app/(app)/actions'

export type AttendanceRow = {
  key: string
  leadId: string
  name: string
  time: string | null
  tags: [string, 'warn' | 'leaf' | 'sky' | 'brand'][]
  bm: number
  altBox: number | null
  status: string | null
  boxBack: boolean | null
  remarks: string | null
  buttermilk: boolean
}
type Entry = { status: string | null; buttermilk: boolean; altBox: string; boxBack: boolean | null; remarks: string }
type Mark = 'idle' | 'saving' | 'saved' | 'failed'

const STATUS: [string, string, string][] = [
  ['DELIVERED', 'Delivered', 'border-leaf bg-leaf text-white'],
  ['ABSENT', 'Absent', 'border-tur bg-tur text-white'],
  ['NOT_DELIVERED', 'Not delivered', 'border-red bg-red text-white'],
]
const TAG = { warn: 'bg-tur-soft text-warn', leaf: 'bg-leaf-soft text-leaf', sky: 'bg-sky-soft text-sky', brand: 'bg-brand-soft text-brand' }

// Attendance entry that saves by itself: tapping Delivered, Absent or Not delivered stores that row at once,
// and the drink tick, alternative box number, empty box and remarks are stored as soon as they change.
export function AttendanceList({ date, region, rows }: { date: string; region: string; rows: AttendanceRow[] }) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(rows.map((r) => [r.leadId, { status: r.status, buttermilk: r.buttermilk, altBox: r.altBox ? String(r.altBox) : '', boxBack: r.boxBack, remarks: r.remarks ?? '' }])))
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [, start] = useTransition()
  const mark = (id: string, m: Mark) => setMarks((x) => ({ ...x, [id]: m }))

  function store(leadId: string, e: Entry) {
    if (!e.status) return // nothing is kept for a row until its attendance is picked
    mark(leadId, 'saving')
    start(async () => {
      try {
        const box = Number(e.altBox)
        const r = await saveAttendanceRowAction(date, { leadId, status: e.status!, buttermilk: e.buttermilk, boxBack: e.boxBack, altBox: e.altBox && box >= 1 && box <= 100 ? Math.round(box) : null, remarks: e.remarks.trim() || null })
        mark(leadId, r.ok ? 'saved' : 'failed')
      } catch {
        mark(leadId, 'failed')
      }
    })
  }
  function change(leadId: string, patch: Partial<Entry>, save = true) {
    const next = { ...entries[leadId], ...patch }
    setEntries((x) => ({ ...x, [leadId]: next }))
    if (save) store(leadId, next)
  }
  function clear(leadId: string) {
    setEntries((x) => ({ ...x, [leadId]: { ...x[leadId], status: null, boxBack: null } }))
    mark(leadId, 'saving')
    start(async () => {
      try { await clearAttendanceRowAction(date, leadId); mark(leadId, 'idle') } catch { mark(leadId, 'failed') }
    })
  }
  const blank = rows.filter((r) => !entries[r.leadId].status)
  const failed = rows.filter((r) => marks[r.leadId] === 'failed').length

  const pill = 'rounded-md border px-2.5 py-1 text-[13px] font-medium'
  return (
    <section className="card overflow-x-auto">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">{region} · {rows.length} customers</h2>
          <p className="text-[13px] text-muted">Tap one option per row. Each row is saved as soon as you tap it.</p>
        </div>
        {failed > 0 && <span className="text-[13px] font-semibold text-red">{failed} not saved, tap again</span>}
        {blank.length > 0 && <button type="button" onClick={() => blank.forEach((r) => change(r.leadId, { status: 'DELIVERED' }))} className="btn">Mark the other {blank.length} delivered</button>}
      </div>
      <table className="w-full">
        <thead><tr><th className="th">#</th><th className="th">Customer</th><th className="th">Time</th><th className="th">Attendance</th><th className="th">Drink</th><th className="th">Alt box no.</th><th className="th">Empty box back</th><th className="th">Remarks</th><th className="th"></th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const e = entries[r.leadId]
            const m = marks[r.leadId] ?? 'idle'
            return (
              <tr key={r.key} className={e.altBox ? 'bg-sky-soft' : ''}>
                <td className="td">{i + 1}</td>
                <td className="td">
                  <Link href={`/customers/${r.leadId}`} className="font-semibold hover:underline">{r.name}</Link>
                  <div className="mt-0.5 flex flex-wrap gap-1">{r.tags.map(([t, tone]) => <span key={t} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG[tone]}`}><span className="size-1.5 rounded-full bg-current" />{t}</span>)}</div>
                </td>
                <td className="td">{r.time ?? '—'}</td>
                <td className="td">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Attendance for ${r.name}`}>
                    {STATUS.map(([v, l, on]) => <button key={v} type="button" aria-pressed={e.status === v} onClick={() => change(r.leadId, { status: v })} className={`${pill} ${e.status === v ? on : 'border-line bg-surface'}`}>{l}</button>)}
                  </div>
                </td>
                <td className="td">{r.bm > 0 ? <label className="flex items-center gap-1.5 text-[13px] font-semibold"><input type="checkbox" checked={e.buttermilk} onChange={(ev) => change(r.leadId, { buttermilk: ev.target.checked })} className="size-4 accent-leaf" />{r.bm}</label> : ''}</td>
                <td className="td"><input type="number" min={1} max={100} value={e.altBox} onChange={(ev) => change(r.leadId, { altBox: ev.target.value }, false)} onBlur={() => store(r.leadId, e)} className="input w-16 px-2 py-1.5 text-center" aria-label={`Alternative box number for ${r.name}`} /></td>
                <td className="td">
                  <div className="flex gap-1.5" role="group" aria-label={`Empty box back for ${r.name}`}>
                    {([['Yes', true, 'border-leaf bg-leaf text-white'], ['No', false, 'border-red bg-red text-white']] as const).map(([l, v, on]) => <button key={l} type="button" aria-pressed={e.boxBack === v} onClick={() => change(r.leadId, { boxBack: e.boxBack === v ? null : v })} className={`${pill} ${e.boxBack === v ? on : 'border-line bg-surface'}`}>{l}</button>)}
                  </div>
                </td>
                <td className="td"><input value={e.remarks} onChange={(ev) => change(r.leadId, { remarks: ev.target.value }, false)} onBlur={() => store(r.leadId, e)} className="input min-w-32 px-2 py-1.5" aria-label={`Remarks for ${r.name}`} /></td>
                <td className="td whitespace-nowrap">
                  {m === 'saving' ? <span className="text-xs font-semibold text-muted">Saving…</span>
                    : m === 'failed' ? <button type="button" onClick={() => store(r.leadId, e)} className="text-xs font-semibold text-red underline">Not saved · retry</button>
                    : e.status ? <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-semibold text-leaf"><span className="size-1.5 rounded-full bg-current" />Entered</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full bg-tur-soft px-2.5 py-0.5 text-xs font-semibold text-warn"><span className="size-1.5 rounded-full bg-current" />To enter</span>}
                  {e.status && m !== 'saving' && <button type="button" onClick={() => clear(r.leadId)} title="Remove this entry" className="ml-2 text-xs font-medium text-muted hover:text-red">Clear</button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
