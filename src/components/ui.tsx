import Link from 'next/link'
import type { Tone } from '@/lib/labels'

const TONE: Record<Tone, string> = {
  sky: 'bg-sky-soft text-sky',
  warn: 'bg-tur-soft text-warn',
  leaf: 'bg-leaf-soft text-leaf',
  muted: 'bg-s2 text-muted',
  red: 'bg-red-soft text-red',
  brand: 'bg-brand-soft text-brand',
}
const VALUE: Record<Tone | 'ink', string> = {
  sky: 'text-sky',
  warn: 'text-warn',
  leaf: 'text-leaf',
  muted: 'text-muted',
  red: 'text-red',
  brand: 'text-brand',
  ink: 'text-ink',
}

export function Chip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

export function StatusChip({ map, value }: { map: Record<string, [string, Tone]>; value: string }) {
  const [label, tone] = map[value] ?? [value, 'muted']
  return <Chip label={label} tone={tone} />
}

export function PageHeader({ title, sub, crumb, children }: { title: string; sub?: string; crumb?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1">
        {crumb && <div className="mb-1 text-xs font-medium text-muted">{crumb}</div>}
        <h1 className="font-display text-2xl font-bold leading-tight text-balance sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm leading-5 text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">{children}</div>}
    </div>
  )
}

export function Tile({ label, value, sub, tone = 'ink', big }: { label: string; value: string | number; sub?: string; tone?: Tone | 'ink'; big?: boolean }) {
  return (
    <div className={`card ${big ? 'p-4 sm:p-5' : 'px-4 py-3.5 sm:px-4.5 sm:py-4'}`}>
      <div className={`${big ? 'text-sm' : 'text-[13px]'} font-semibold text-muted`}>{label}</div>
      <div className={`font-display font-bold tabular-nums ${big ? 'text-4xl sm:text-5xl' : 'text-[26px] sm:text-3xl'} ${VALUE[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Tiles({ children, cols }: { children: React.ReactNode; cols: number }) {
  const c: Record<number, string> = { 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${c[cols] ?? ''}`}>{children}</div>
}

export function Card({ title, sub, right, children, className = '' }: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            {sub && <p className="text-[13px] text-muted">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Tabs({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
    <div className="inline-flex gap-0.5 rounded-[9px] bg-s2 p-[3px] sm:flex-wrap">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={`tap flex shrink-0 items-center whitespace-nowrap rounded-[7px] px-3.5 py-1.5 text-[13px] ${t.active ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-muted hover:text-ink'}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
    </nav>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const init = name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {init}
    </span>
  )
}

export function Who({ name, sub, href }: { name: string; sub?: string | null; href?: string }) {
  const body = (
    <span className="flex items-center gap-2.5">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block whitespace-nowrap font-semibold">{name}</span>
        {sub && <span className="block whitespace-nowrap text-xs text-muted">{sub}</span>}
      </span>
    </span>
  )
  return href ? <Link href={href} className="hover:underline">{body}</Link> : body
}

export function Callout({ children, tone = 'leaf' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] leading-5 font-medium ${TONE[tone]}`}>
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-current" />
      <span className="text-ink">{children}</span>
    </div>
  )
}

export function Bar({ label, value, max, tone = 'leaf' }: { label: string; value: number; max: number; tone?: Tone }) {
  const color = { sky: 'bg-sky', warn: 'bg-tur', leaf: 'bg-leaf', muted: 'bg-muted', red: 'bg-red', brand: 'bg-brand' }[tone]
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-28 shrink-0 truncate sm:w-40">{label}</span>
      <span className="h-2 flex-1 rounded bg-s2">
        <span className={`block h-2 rounded ${color}`} style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="w-10 text-right font-semibold">{value}</span>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted">{children}</div>
}

// Right-hand panel over the page (Figma drawers). Closing is a link back to the list.
export function Drawer({ title, sub, close, children, wide }: { title: string; sub?: React.ReactNode; close: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45" role="dialog" aria-modal="true" aria-label={title}>
      <Link href={close} className="flex-1" aria-label="Close" scroll={false} />
      <div className={`h-full w-full ${wide ? 'max-w-[560px]' : 'max-w-[460px]'} overflow-y-auto overscroll-contain bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-xl sm:p-6`}>
        <div className="sticky -top-4 z-10 -mx-4 mb-4 flex items-start gap-3 bg-surface px-4 pt-1 pb-2 sm:-top-6 sm:-mx-6 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {sub && <p className="text-[13px] text-muted">{sub}</p>}
          </div>
          <Link href={close} scroll={false} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-s2 hover:text-ink" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

// One-tap choice chips backed by radio buttons, so forms work without JavaScript.
export function Pills({ name, options, value, required, tones }: { name: string; options: [string, string][]; value?: string | null; required?: boolean; tones?: Record<string, Tone> }) {
  const on: Record<Tone, string> = {
    leaf: 'peer-checked:border-leaf peer-checked:bg-leaf',
    red: 'peer-checked:border-red peer-checked:bg-red',
    warn: 'peer-checked:border-tur peer-checked:bg-tur',
    sky: 'peer-checked:border-sky peer-checked:bg-sky',
    muted: 'peer-checked:border-muted peer-checked:bg-muted',
    brand: 'peer-checked:border-brand peer-checked:bg-brand',
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <label key={v} className="relative cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={value === v} required={required} className="peer sr-only" />
          <span className={`pill block rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] font-medium whitespace-nowrap transition-colors peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-soft ${on[tones?.[v] ?? 'brand']}`}>{l}</span>
        </label>
      ))}
    </div>
  )
}

export function Progress({ value, max, tone = 'brand' }: { value: number; max: number; tone?: Tone }) {
  const color = { sky: 'bg-sky', warn: 'bg-tur', leaf: 'bg-leaf', muted: 'bg-muted', red: 'bg-red', brand: 'bg-brand' }[tone]
  return (
    <span className="block h-1.5 w-full min-w-14 rounded bg-s2">
      <span className={`block h-1.5 rounded ${color}`} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </span>
  )
}

export function WaLink({ href, children = 'WhatsApp', small }: { href: string; children?: React.ReactNode; small?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`tap inline-flex items-center justify-center gap-2 rounded-lg bg-leaf font-semibold text-white hover:opacity-90 active:scale-[0.98] ${small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm'}`}>
      {children}
    </a>
  )
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null
  return <div role="alert" className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[13px] font-medium text-red">{error}</div>
}

// Multi-select chips backed by checkboxes.
export function Checks({ name, options, values }: { name: string; options: string[]; values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o} className="relative cursor-pointer">
          <input type="checkbox" name={name} value={o} defaultChecked={values.includes(o)} className="peer sr-only" />
          <span className="pill block rounded-full border border-line px-3 py-1 text-[13px] font-medium transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand-soft">{o}</span>
        </label>
      ))}
    </div>
  )
}
