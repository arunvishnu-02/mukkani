'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Gives every list in the app the same two tools without each screen building them:
// tap a column heading to sort (again to reverse, a third time for the original order),
// and a "Filter this list" box above any list with six or more rows.
// It works on the rows already on screen. Tables that sort themselves opt out with data-no-tools.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function cellText(td: Element | undefined) {
  if (!td) return ''
  const field = td.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([type=hidden]):not([type=checkbox]), select')
  if (field && field.value) return field.value
  return (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
}

// A value to sort by: numbers ("Rs 1,200", "14.7 kg", "89%"), dates ("Mon, 12 Oct", "12 Oct 2026") or plain text.
function sortKey(text: string): number | string {
  const t = text.toLowerCase()
  if (!t || t === '—' || t === '-') return ''
  const date = /(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?: (\d{4}))?/.exec(t)
  if (date) return Number(date[3] ?? new Date().getFullYear()) * 10000 + (MONTHS.indexOf(date[2]) + 1) * 100 + Number(date[1])
  const num = t.replace(/rs|,|kg|km|%|\s/g, '')
  if (/^-?\d+(\.\d+)?$/.test(num)) return Number(num)
  const lead = /^-?\d+(\.\d+)?/.exec(t.replace(/^rs\s*/, '').replace(/,/g, ''))
  if (lead && /^(rs\s*)?-?[\d,.]+\s*(of|\/|·)/.test(t)) return Number(lead[0])
  return t
}

function enhance(table: HTMLTableElement) {
  if (table.dataset.tools || table.closest('[data-no-tools]') || table.hasAttribute('data-no-tools')) return
  const body = table.tBodies[0]
  const heads = [...(table.tHead?.rows[0]?.cells ?? [])]
  if (!body || heads.length === 0 || body.rows.length < 2) return
  table.dataset.tools = '1'
  const rows = () => [...body.rows]
  rows().forEach((r, i) => { r.dataset.order = String(i) })

  let state: { col: number; down: boolean } | null = null
  const marks: HTMLSpanElement[] = []
  heads.forEach((th, col) => {
    if (!th.innerText.trim() || th.querySelector('a, button, input')) return
    const mark = document.createElement('span')
    mark.textContent = ' ↕'
    mark.style.cssText = 'font-size:9px;opacity:.55'
    marks[col] = mark
    th.appendChild(mark)
    th.style.cursor = 'pointer'
    th.title = 'Sort'
    th.addEventListener('click', () => {
      state = state?.col !== col ? { col, down: false } : state.down ? null : { col, down: true }
      marks.forEach((m) => { if (m) { m.textContent = ' ↕'; m.style.opacity = '.55'; m.style.color = '' } })
      const list = rows()
      if (!state) list.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
      else {
        const sign = state.down ? -1 : 1
        mark.textContent = state.down ? ' ▼' : ' ▲'
        mark.style.opacity = '1'
        mark.style.color = 'var(--color-brand)'
        const keyed = list.map((r) => ({ r, k: sortKey(cellText(r.cells[col])) }))
        keyed.sort((a, b) => {
          if (a.k === '') return b.k === '' ? 0 : 1 // empty cells stay at the bottom
          if (b.k === '') return -1
          return (typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), 'en', { numeric: true, sensitivity: 'base' })) * sign
        })
        list.splice(0, list.length, ...keyed.map((x) => x.r))
      }
      list.forEach((r) => body.appendChild(r))
    })
  })

  if (body.rows.length >= 6) {
    const bar = document.createElement('div')
    bar.dataset.tableTools = '1'
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 20px;border-top:1px solid var(--color-line)'
    const input = document.createElement('input')
    input.type = 'search'
    input.placeholder = 'Filter this list: type a name, number or any word'
    input.setAttribute('aria-label', 'Filter this list')
    input.className = 'input'
    input.style.cssText = 'max-width:340px;padding-top:7px;padding-bottom:7px;font-size:13px'
    const count = document.createElement('span')
    count.style.cssText = 'font-size:12px;color:var(--color-muted)'
    count.textContent = `${body.rows.length} rows · tap a heading to sort`
    input.addEventListener('input', () => {
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean)
      let shown = 0
      for (const r of rows()) {
        const text = [...r.cells].map((c) => cellText(c)).join(' ').toLowerCase()
        const ok = words.every((w) => text.includes(w))
        r.style.display = ok ? '' : 'none'
        if (ok) shown++
      }
      count.textContent = words.length ? `${shown} of ${body.rows.length} rows` : `${body.rows.length} rows · tap a heading to sort`
    })
    bar.append(input, count)
    table.parentElement?.insertBefore(bar, table)
  }
}

export function TableTools() {
  const path = usePathname()
  const query = useSearchParams().toString()
  useEffect(() => {
    const run = () => document.querySelectorAll<HTMLTableElement>('main table').forEach(enhance)
    // Wait until React has finished taking over the page: changing the list earlier makes it redraw the page.
    let timer = setTimeout(run, 900)
    // Lists that arrive later (after the loading placeholder, or after a save) are picked up too.
    const main = document.querySelector('main')
    const watch = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 600) })
    if (main) watch.observe(main, { childList: true, subtree: true })
    return () => { watch.disconnect(); clearTimeout(timer) }
  }, [path, query])
  return null
}
