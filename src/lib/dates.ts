// Dates are stored as Postgres DATE (UTC midnight in Prisma). "Today" means today in India.
const TZ = process.env.APP_TIMEZONE ?? 'Asia/Kolkata'

export function todayKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function day(offsetDays = 0): Date {
  return new Date(`${todayKey(offsetDays)}T00:00:00Z`)
}

export function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00Z`)
}

export function dayInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : ''
}

export function fmtDay(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
}

export function fmtRange(a: Date, b: Date): string {
  const sameMonth = a.getUTCMonth() === b.getUTCMonth()
  return sameMonth ? `${a.getUTCDate()} to ${fmtDay(b)}` : `${fmtDay(a)} to ${fmtDay(b)}`
}

export function fmtTime(d: Date): string {
  const today = todayKey()
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
  if (key === today)
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(d).toLowerCase()
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: TZ }).format(d)
}

export function longToday(): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date())
}
