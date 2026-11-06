'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NavIcon, type IconName } from './NavIcon'

export type NavItem = { href: string; label: string; icon: IconName; group?: string }

export function Sidebar({ section, items, user, logout }: { section: string; items: NavItem[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  // The longest nav link that matches the current path is the active one.
  const match = items
    .filter((it) => path === it.href || path.startsWith(it.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  const isActive = (href: string) => href === match
  const dense = items.length > 12
  const here = items.find((it) => it.href === match)?.label
  // Phone menu: close with Escape, and stop the page behind it from scrolling.
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = ''
    }
  }, [open])
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <button onClick={() => setOpen(!open)} className="flex size-11 items-center justify-center rounded-lg active:bg-s2" aria-label="Open menu" aria-expanded={open} aria-controls="side-nav">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{here ?? section}</span>
        <Image src="/mukkani-mark.png" alt="Mukkani" width={32} height={32} priority className="mr-2 rounded-md" />
      </div>
      {open && <button className="fixed inset-0 z-40 bg-ink/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside
        id="side-nav"
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] flex-col gap-1 border-r border-line bg-side px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),16px)] overflow-y-auto overscroll-contain shadow-xl md:sticky md:top-0 md:z-auto md:flex md:h-screen md:w-60 md:shadow-none`}
      >
        <div className="px-2 pb-5">
          <Image src="/mukkani-logo.png" alt="Mukkani" width={150} height={72} priority />
        </div>
        <div className="px-2 pb-1.5 text-xs font-semibold tracking-widest text-side-muted uppercase">{section}</div>
        {items.map((it, i) => {
          const on = isActive(it.href)
          const head = it.group && it.group !== items[i - 1]?.group
          return (
            <div key={it.href}>
              {head && <div className="px-2 pt-3 pb-1.5 text-xs font-semibold tracking-widest text-side-muted uppercase">{it.group}</div>}
              <Link
                href={it.href}
                onClick={() => setOpen(false)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 md:min-h-0 ${dense ? 'md:py-1.5' : 'md:py-2.5'} text-sm ${on ? 'bg-side-active font-semibold text-brand' : 'font-medium text-side-muted hover:bg-s2 hover:text-ink'}`}
              >
                <NavIcon name={it.icon} />
                {it.label}
              </Link>
            </div>
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
            <button className="tap rounded-md px-2 text-xs font-semibold text-side-muted hover:text-brand">Log out</button>
          </form>
        </div>
      </aside>
    </>
  )
}
