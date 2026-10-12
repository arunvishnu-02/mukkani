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
  const done = rows.length - blank.length
  const failed = rows.filter((r) => marks[r.leadId] === 'failed').length

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">{region} · {rows.length} customers</h2>
          <p className="text-[13px] text-muted">Tap the attendance. Each row saves by itself, there is no Save button.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${failed ? 'bg-red-soft text-red' : done === rows.length ? 'bg-leaf-soft text-leaf' : 'bg-tur-soft text-warn'}`}>{failed ? `${failed} not saved, tap again` : done === rows.length ? 'All entered and saved' : `${done} of ${rows.length} entered`}</span>
        {blank.length > 0 && <button type="button" onClick={() => blank.forEach((r) => change(r.leadId, { status: 'DELIVERED' }))} className="btn btn-sm">Mark the other {blank.length} delivered</button>}
      </div>
      <div className="divide-y divide-line border-t border-line">
        {rows.map((r, i) => {
          const e = entries[r.leadId]
          const m = marks[r.leadId] ?? 'idle'
          return (
            <div key={r.key} className={`grid items-center gap-x-4 gap-y-2.5 px-5 py-3.5 lg:grid-cols-[minmax(190px,1.1fr)_auto_minmax(0,1.5fr)_92px] ${e.altBox ? 'bg-sky-soft' : ''}`}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 w-5 shrink-0 text-right text-[13px] font-semibold text-muted">{i + 1}</span>
                <div className="min-w-0">
                  <Link href={`/customers/${r.leadId}`} className="font-semibold hover:underline">{r.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                    {r.time && <span className="text-muted">{r.time}</span>}
                    {r.tags.map(([t, tone]) => <span key={t} className={`rounded-full px-2 py-px font-semibold ${TAG[tone]}`}>{t}</span>)}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${r.name}`}>
                {STATUS.map(([v, l, on]) => (
                  <button key={v} type="button" aria-pressed={e.status === v} onClick={() => change(r.leadId, { status: v })} className={`rounded-lg border px-3 py-2 text-[13px] font-semibold whitespace-nowrap ${e.status === v ? on : 'border-line bg-surface hover:border-brand'}`}>{l}</button>
                ))}
              </div>
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] ${e.status ? '' : 'opacity-55'}`}>
                {r.bm > 0 && <label className="flex items-center gap-1.5 font-semibold whitespace-nowrap"><input type="checkbox" checked={e.buttermilk} onChange={(ev) => change(r.leadId, { buttermilk: ev.target.checked })} className="size-4 accent-leaf" />Drink × {r.bm}</label>}
                <div className="flex items-center gap-1.5 whitespace-nowrap text-muted" role="group" aria-label={`Empty box back for ${r.name}`}>Empty box back
                  <span className="flex gap-1">
                    {([['Yes', true, 'border-leaf bg-leaf text-white'], ['No', false, 'border-red bg-red text-white']] as const).map(([l, v, on]) => (
                      <button key={l} type="button" aria-pressed={e.boxBack === v} onClick={() => change(r.leadId, { boxBack: e.boxBack === v ? null : v })} className={`rounded-md border px-2.5 py-1 font-semibold ${e.boxBack === v ? on : 'border-line bg-surface text-ink'}`}>{l}</button>
                    ))}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 whitespace-nowrap text-muted">Alt box no.
                  <input type="number" min={1} max={100} value={e.altBox} onChange={(ev) => change(r.leadId, { altBox: ev.target.value }, false)} onBlur={() => store(r.leadId, e)} className="input px-2 py-1 text-center text-ink" style={{ width: 60 }} />
                </label>
                <input value={e.remarks} onChange={(ev) => change(r.leadId, { remarks: ev.target.value }, false)} onBlur={() => store(r.leadId, e)} placeholder="Remarks" aria-label={`Remarks for ${r.name}`} className="input min-w-32 flex-1 px-2.5 py-1 text-ink" />
              </div>
              <div className="flex items-center justify-end gap-2 text-xs font-semibold whitespace-nowrap">
                {m === 'saving' ? <span className="text-muted">Saving…</span> : m === 'failed' ? <button type="button" onClick={() => store(r.leadId, e)} className="text-red underline">Not saved · retry</button> : e.status ? <span className="text-leaf">✓ Saved</span> : <span className="text-warn">To enter</span>}
                {e.status && m !== 'saving' && <button type="button" onClick={() => clear(r.leadId)} title="Remove this entry" className="font-medium text-muted hover:text-red">Clear</button>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
