'use client'

import { useMemo, useState } from 'react'

type Cell = string | number | null
type Column = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'money' }

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const show = (v: Cell, type: Column['type']) => (v == null || v === '' ? '—' : type === 'date' ? day.format(new Date(`${v}T00:00:00Z`)) : type === 'money' ? `Rs ${num.format(Number(v))}` : type === 'number' ? num.format(Number(v)) : String(v))

// A report table: tap a heading to sort, type to filter the rows shown, download what is on screen as CSV.
export function ReportTable({ columns, rows, fileName }: { columns: Column[]; rows: Record<string, Cell>[]; fileName: string }) {
  const [sort, setSort] = useState<{ key: string; down: boolean } | null>(null)
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const list = words.length ? rows.filter((r) => { const text = columns.map((c) => show(r[c.key], c.type)).join(' ').toLowerCase(); return words.every((w) => text.includes(w)) }) : [...rows]
    if (sort) {
      const sign = sort.down ? -1 : 1
      list.sort((a, b) => {
        const x = a[sort.key], y = b[sort.key]
        if (x == null || x === '') return y == null || y === '' ? 0 : 1 // empty cells stay at the bottom
        if (y == null || y === '') return -1
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true, sensitivity: 'base' })) * sign
      })
    }
    return list
  }, [rows, columns, q, sort])
  const totals = columns.map((c) => (c.type === 'money' ? shown.reduce((a, r) => a + (Number(r[c.key]) || 0), 0) : null))

  function download() {
    const cell = (v: string) => `"${(/^[=+\-@]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
    const lines = [columns.map((c) => cell(c.label)), ...shown.map((r) => columns.map((c) => cell(r[c.key] == null ? '' : String(r[c.key]))))]
    const url = URL.createObjectURL(new Blob(['﻿' + lines.map((l) => l.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${fileName}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Filter these rows: name, phone, any word" aria-label="Filter rows" className="input w-full py-2 sm:w-80" />
        <span className="flex-1 text-[13px] text-muted">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}{sort ? ` · sorted by ${columns.find((c) => c.key === sort.key)?.label} ${sort.down ? '(high to low)' : '(low to high)'}` : ''}</span>
        {sort && <button type="button" onClick={() => setSort(null)} className="btn-secondary btn-sm">Clear sort</button>}
        <button type="button" onClick={download} disabled={shown.length === 0} className="btn-secondary btn-sm disabled:opacity-50">Download CSV</button>
      </div>
      <div className="overflow-x-auto">
        {shown.length === 0 ? <div className="px-5 py-10 text-center text-sm text-muted">{rows.length === 0 ? 'Nothing for these filters. Try a wider date range.' : 'No row matches what you typed.'}</div> : (
          <table className="w-full" data-no-tools>
            <thead>
              <tr>
                {columns.map((c) => {
                  const on = sort?.key === c.key
                  return (
                    <th key={c.key} className="th" aria-sort={on ? (sort.down ? 'descending' : 'ascending') : 'none'}>
                      <button type="button" onClick={() => setSort(on ? (sort.down ? null : { key: c.key, down: true }) : { key: c.key, down: false })} title="Sort" className={`flex items-center gap-1 uppercase tracking-[inherit] hover:text-brand ${on ? 'text-brand' : ''} ${c.type === 'money' || c.type === 'number' ? 'ml-auto' : ''}`}>
                        {c.label}<span aria-hidden className="text-[9px]">{on ? (sort.down ? '▼' : '▲') : '↕'}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} className="align-top">
                  {columns.map((c) => <td key={c.key} className={`td ${c.type === 'money' || c.type === 'number' ? 'text-right tabular-nums' : ''} ${c.type === 'date' ? 'whitespace-nowrap' : 'max-w-72'}`}>{show(r[c.key], c.type)}</td>)}
                </tr>
              ))}
            </tbody>
            {totals.some((t) => t != null) && (
              <tfoot>
                <tr className="border-t-2 border-line bg-s2 font-semibold">
                  {columns.map((c, i) => <td key={c.key} className={`td ${totals[i] != null ? 'text-right tabular-nums' : ''}`}>{totals[i] != null ? `Rs ${num.format(totals[i]!)}` : i === 0 ? 'Total' : ''}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </section>
  )
}
