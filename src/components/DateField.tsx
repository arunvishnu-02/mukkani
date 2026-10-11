'use client'

import { useEffect, useRef, useState } from 'react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const parts = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? { y: Number(v.slice(0, 4)), m: Number(v.slice(5, 7)) - 1, d: Number(v.slice(8, 10)) } : null)

function todayIso() {
  const t = new Date()
  return iso(t.getFullYear(), t.getMonth(), t.getDate())
}

// A date input with the app's own calendar instead of the browser's. The value is sent as YYYY-MM-DD under `name`,
// exactly like <input type="date">. `birthday` opens on the year list and offers years back to 1930.
export function DateField({
  name,
  defaultValue,
  required,
  min,
  max,
  id,
  compact,
  birthday,
}: {
  name: string
  defaultValue?: string | null
  required?: boolean
  min?: string
  max?: string
  id?: string
  compact?: boolean
  birthday?: boolean
}) {
  const [value, setValue] = useState(defaultValue ?? '')
  // The same field can be reused for another record (next lead in the drawer): follow its new starting value.
  const [from, setFrom] = useState(defaultValue ?? '')
  if (from !== (defaultValue ?? '')) {
    setFrom(defaultValue ?? '')
    setValue(defaultValue ?? '')
  }
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [view, setView] = useState({ y: 2000, m: 0 })
  const [place, setPlace] = useState({ right: false, up: false })
  const box = useRef<HTMLDivElement>(null)
  const yearList = useRef<HTMLDivElement>(null)
  const today = todayIso()
  const picked = parts(value)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  useEffect(() => {
    if (open && mode === 'years') yearList.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'center' })
  }, [open, mode])

  function show() {
    const t = parts(today)!
    setView(picked ? { y: picked.y, m: picked.m } : birthday ? { y: t.y - 30, m: t.m } : { y: t.y, m: t.m })
    setMode(birthday && !picked ? 'years' : 'days')
    const r = box.current?.getBoundingClientRect()
    if (r) setPlace({ right: r.left + 296 > window.innerWidth, up: r.bottom + 350 > window.innerHeight && r.top > 350 })
    setOpen(true)
  }

  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max)
  const choose = (v: string) => { setValue(v); setOpen(false) }
  const step = (n: number) => setView(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const thisYear = Number(today.slice(0, 4))
  const lastYear = max ? Number(max.slice(0, 4)) : birthday ? thisYear : thisYear + 5
  const firstYear = min ? Number(min.slice(0, 4)) : birthday ? 1930 : thisYear - 5
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i)
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const count = new Date(view.y, view.m + 1, 0).getDate()
  const label = picked ? `${picked.d} ${MONTHS[picked.m].slice(0, 3)} ${picked.y}` : ''
  const cell = 'flex h-9 items-center justify-center rounded-lg text-[13px] font-medium hover:bg-brand-soft disabled:pointer-events-none disabled:text-muted/40'
  const on = 'bg-brand font-semibold text-white hover:bg-brand'

  return (
    <div ref={box} className="relative">
      {/* Carries the value in the form; required makes the browser ask for it like any other field. */}
      <input name={name} value={value} required={required} onChange={() => {}} tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />
      <button type="button" id={id} onClick={() => (open ? setOpen(false) : show())} aria-haspopup="dialog" aria-expanded={open} className={`input flex items-center justify-between gap-2 text-left ${compact ? 'py-2' : ''} ${open ? 'border-brand ring-2 ring-brand-soft' : ''}`}>
        <span className={label ? '' : 'text-muted'}>{label || 'Pick a date'}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-muted"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Pick a date" className={`absolute z-50 w-[288px] rounded-xl border border-line bg-surface p-3 shadow-[0_12px_32px_rgba(30,20,40,0.16)] ${place.right ? 'right-0' : 'left-0'} ${place.up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <div className="mb-2 flex items-center gap-1">
            <button type="button" onClick={() => setMode(mode === 'days' ? 'years' : 'days')} className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-display text-[15px] font-semibold hover:bg-brand-soft">
              {mode === 'years' ? 'Pick a year' : mode === 'months' ? view.y : `${MONTHS[view.m]} ${view.y}`}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`text-muted transition-transform ${mode === 'days' ? '' : 'rotate-180'}`}><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {mode === 'days' && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand">‹</button>
                <button type="button" onClick={() => step(1)} aria-label="Next month" className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand">›</button>
              </>
            )}
          </div>

          {mode === 'years' && (
            <div ref={yearList} className="grid max-h-[232px] grid-cols-4 gap-1 overflow-y-auto pr-1">
              {years.map((y) => (
                <button key={y} type="button" data-on={y === view.y} onClick={() => { setView((v) => ({ ...v, y })); setMode('months') }} className={`${cell} ${y === view.y ? on : ''}`}>{y}</button>
              ))}
            </div>
          )}

          {mode === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => (
                <button key={m} type="button" onClick={() => { setView((v) => ({ ...v, m: i })); setMode('days') }} className={`${cell} h-11 ${i === view.m ? on : ''}`}>{m.slice(0, 3)}</button>
              ))}
            </div>
          )}

          {mode === 'days' && (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-bold tracking-wide text-muted uppercase">{DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
                {Array.from({ length: count }, (_, i) => {
                  const v = iso(view.y, view.m, i + 1)
                  return (
                    <button key={v} type="button" disabled={!allowed(v)} onClick={() => choose(v)} className={`${cell} ${v === value ? on : v === today ? 'border border-brand text-brand' : ''}`}>{i + 1}</button>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[13px] font-semibold">
                {allowed(today) && !birthday ? <button type="button" onClick={() => choose(today)} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-soft">Today</button> : <span />}
                {!required && value && <button type="button" onClick={() => choose('')} className="rounded-lg px-2 py-1 text-muted hover:bg-s2">Clear</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
