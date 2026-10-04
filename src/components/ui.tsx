import Link from 'next/link'
import type { Tone } from '@/lib/labels'

const TONE: Record<Tone, string> = {
  sky: 'bg-sky-soft text-sky',
  warn: 'bg-tur-soft text-warn',
  leaf: 'bg-leaf-soft text-leaf',
  muted: 'bg-s2 text-muted',
  red: 'bg-red-soft text-red',
}
const VALUE: Record<Tone | 'ink', string> = {
  sky: 'text-sky',
  warn: 'text-warn',
  leaf: 'text-leaf',
  muted: 'text-muted',
  red: 'text-red',
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {crumb && <div className="mb-1 text-xs font-medium text-muted">{crumb}</div>}
        <h1 className="font-display text-[28px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export function Tile({ label, value, sub, tone = 'ink', big }: { label: string; value: string | number; sub?: string; tone?: Tone | 'ink'; big?: boolean }) {
  return (
    <div className={`card ${big ? 'p-5' : 'px-4.5 py-4'}`}>
      <div className={`${big ? 'text-sm' : 'text-[13px]'} font-semibold text-muted`}>{label}</div>
      <div className={`font-display font-bold ${big ? 'text-5xl' : 'text-3xl'} ${VALUE[tone]}`}>{value}</div>
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
    <section className={`card p-5 ${className}`}>
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
    <div className="inline-flex flex-wrap gap-0.5 rounded-[9px] bg-s2 p-[3px]">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-[7px] px-3.5 py-1.5 text-[13px] ${t.active ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-muted hover:text-ink'}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
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
        {sub && <span className="block whitespace-nowrap text-[11px] text-muted">{sub}</span>}
      </span>
    </span>
  )
  return href ? <Link href={href} className="hover:underline">{body}</Link> : body
}

export function Callout({ children, tone = 'leaf' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium ${TONE[tone]}`}>
      <span className="size-2 shrink-0 rounded-full bg-current" />
      <span className="text-ink">{children}</span>
    </div>
  )
}

export function Bar({ label, value, max, tone = 'leaf' }: { label: string; value: number; max: number; tone?: Tone }) {
  const color = { sky: 'bg-sky', warn: 'bg-tur', leaf: 'bg-leaf', muted: 'bg-muted', red: 'bg-red' }[tone]
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-40 shrink-0">{label}</span>
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
