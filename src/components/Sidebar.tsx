'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export type NavItem = { href: string; label: string }

export function Sidebar({ section, items, user, logout }: { section: string; items: NavItem[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  // The longest nav link that matches the current path is the active one.
  const match = items
    .filter((it) => path === it.href || path.startsWith(it.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  const isActive = (href: string) => href === match
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:hidden">
        <button onClick={() => setOpen(!open)} className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold" aria-label="Menu">
          Menu
        </button>
        <Image src="/mukkani-logo.png" alt="Mukkani" width={96} height={46} priority />
      </div>
      <aside
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-60 flex-col gap-1 border-r border-line bg-side px-4 py-6 md:sticky md:top-0 md:flex md:h-screen`}
      >
        <div className="px-2 pb-5">
          <Image src="/mukkani-logo.png" alt="Mukkani" width={150} height={72} priority />
        </div>
        <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-widest text-side-muted uppercase">{section}</div>
        {items.map((it) => {
          const on = isActive(it.href)
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${on ? 'bg-side-active font-semibold text-brand' : 'font-medium text-side-muted hover:bg-s2 hover:text-ink'}`}
            >
              <span className={`size-4 rounded border-[1.5px] ${on ? 'border-brand bg-brand' : 'border-side-muted'}`} />
              {it.label}
            </Link>
          )
        })}
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 rounded-[10px] bg-s2 p-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {user.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{user.name}</span>
            <span className="block text-xs text-side-muted">{user.role}</span>
          </span>
          <form action={logout}>
            <button className="text-xs font-semibold text-side-muted hover:text-brand">Log out</button>
          </form>
        </div>
      </aside>
    </>
  )
}
