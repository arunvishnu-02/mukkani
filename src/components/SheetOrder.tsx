'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { saveSheetOrder } from '@/app/(app)/ops-actions'

type Row = { id: string; name: string; address: string | null; time: string | null }

// The delivery route of one region: drag a customer up or down (or use the arrows on a phone), then save.
// The attendance sheet on screen and the printed sheet follow this order every day until it is changed.
export function SheetOrder({ rows, back, region }: { rows: Row[]; back: string; region: string }) {
  const [list, setList] = useState(rows)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const changed = useRef(false)
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= list.length) return
    const next = [...list]
    const [r] = next.splice(from, 1)
    next.splice(to, 0, r)
    changed.current = true
    setList(next)
  }
  return (
    <form action={saveSheetOrder} className="border-t border-line">
      <input type="hidden" name="back" value={back} />
      <p className="bg-brand-soft px-5 py-3 text-[13px]">
        Drag each customer into the order the boxes are delivered in {region}, first stop at the top. On a phone, use the arrows. Then save, check the sheet and print it.
      </p>
      <ol className="divide-y divide-line">
        {list.map((r, i) => (
          <li
            key={r.id}
            draggable
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); setOver(i) }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (drag != null) move(drag, i); setDrag(null); setOver(null) }}
            onDragEnd={() => { setDrag(null); setOver(null) }}
            className={`flex cursor-grab items-center gap-3 px-5 py-2.5 active:cursor-grabbing ${drag === i ? 'opacity-40' : ''} ${over === i && drag !== i ? 'bg-brand-soft' : 'bg-surface'}`}
          >
            <input type="hidden" name="lead" value={r.id} />
            <input type="hidden" name={`pos_${r.id}`} value={i + 1} />
            <span aria-hidden className="text-lg leading-none text-muted select-none">⋮⋮</span>
            <span className="w-7 shrink-0 text-center font-display text-lg font-bold text-brand">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r.name}</span>
              <span className="block truncate text-xs text-muted">{[r.time, r.address].filter(Boolean).join(' · ') || 'No address yet'}</span>
            </span>
            <span className="flex gap-1">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${r.name} up`} className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:border-brand hover:text-brand disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move ${r.name} down`} className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:border-brand hover:text-brand disabled:opacity-30">↓</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-end gap-2.5 px-5 py-4">
        <Link href={back} scroll={false} className="btn-secondary">Cancel</Link>
        <button className="btn">Save order</button>
      </div>
    </form>
  )
}
