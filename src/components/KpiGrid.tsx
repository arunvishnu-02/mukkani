'use client'

import Link from 'next/link'
import { useState } from 'react'

export type KpiCard = { key: string; href: string; title: string; group: string; value: string | number; label: string; sub: string; tone: 'sky' | 'warn' | 'leaf' | 'muted' | 'red' | 'brand' }

const TEXT = { sky: 'text-sky', warn: 'text-warn', leaf: 'text-leaf', muted: 'text-muted', red: 'text-red', brand: 'text-brand' }
const number = (v: string | number) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, '')) || 0)

// The All reports dashboard: KPI cards with a filter box, a group filter and a sort order.
export function KpiGrid({ cards }: { cards: KpiCard[] }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [sort, setSort] = useState<'group' | 'name' | 'high' | 'low' | 'attention'>('group')
  const groups = ['All', ...new Set(cards.map((c) => c.group))]
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = cards
    .filter((c) => (group === 'All' || c.group === group) && words.every((w) => `${c.title} ${c.label} ${c.sub} ${c.value}`.toLowerCase().includes(w)))
    .sort((a, b) =>
      sort === 'name' ? a.title.localeCompare(b.title)
        : sort === 'high' ? number(b.value) - number(a.value)
        : sort === 'low' ? number(a.value) - number(b.value)
        : sort === 'attention' ? Number(b.tone === 'red') * 2 + Number(b.tone === 'warn') - (Number(a.tone === 'red') * 2 + Number(a.tone === 'warn'))
        : 0,
    )
  const sections = sort === 'group' ? groups.slice(1).map((g) => [g, shown.filter((c) => c.group === g)] as const).filter(([, list]) => list.length) : [['', shown] as const]
  return (
    <>
      <div className="card flex flex-wrap items-center gap-2.5 px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Filter the cards: leads, stock, money…" aria-label="Filter the cards" className="input w-full py-2 sm:w-72" />
        {groups.length > 2 && (
          <div className="flex gap-1 rounded-lg bg-s2 p-1">
            {groups.map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className={`rounded-md px-3 py-1 text-[13px] font-semibold ${group === g ? 'bg-surface shadow-sm' : 'text-muted'}`}>{g}</button>)}
          </div>
        )}
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-[13px] font-medium text-muted">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input w-auto py-1.5 text-[13px] text-ink">
            <option value="group">By group</option>
            <option value="attention">Needs attention first</option>
            <option value="high">Highest number first</option>
            <option value="low">Lowest number first</option>
            <option value="name">Name A to Z</option>
          </select>
        </label>
        <span className="text-xs text-muted">{shown.length} of {cards.length}</span>
      </div>
      {shown.length === 0 && <p className="px-1 text-sm text-muted">No card matches. Clear the filter to see them all.</p>}
      {sections.map(([g, list]) => (
        <section key={g || 'all'}>
          {g && <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-muted uppercase">{g}</h2>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <Link key={c.key} href={c.href} className="card group flex flex-col px-5 py-4 hover:border-brand hover:shadow-md">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-semibold text-muted">{c.title}</span>
                  <span className="text-[13px] font-semibold text-brand opacity-0 group-hover:opacity-100">Open ›</span>
                </div>
                <div className={`mt-1.5 font-display text-[34px] font-bold leading-none ${TEXT[c.tone]}`}>{c.value}</div>
                <div className="mt-1 text-sm font-semibold">{c.label}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted">{c.sub}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
