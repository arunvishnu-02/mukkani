'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Stop } from '@/lib/delivery'
import { finishRoundAction, markStopAction, pingAction, planRouteAction, saveSpotAction, undoStopAction } from './actions'
import { DeliveryMap } from './DeliveryMap'
import { Icon } from './Icon'

type Pt = { lat: number; lng: number }
type Route = { order: string[]; legSec: Record<string, number>; path: Pt[]; google: boolean; plannedAt: number }
type Phase = { leadId: string; step: 'delivered' | 'not' } | null
type Toast = { leadId: string; text: string; tone: 'leaf' | 'red' } | null

const REASONS = ['Door locked', 'Customer on leave', 'Not reachable', 'Wrong address', 'Other'] as const
const SERVICE_SEC = 120 // time at each door

const istMin = (d = new Date()) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(d).split(':')
  return Number(h) * 60 + Number(m)
}
const clock = (min: number) => {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
const isoClock = (iso: string) => clock(istMin(new Date(iso)))
const navUrl = (s: Pt) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=two-wheeler`

export function DeliveryApp(props: {
  stops: Stop[]
  leave: { leadId: string; name: string }[]
  mapKey: string | null
  centre: Pt | null
  regionId: string | null
  tracking: boolean
  round: { loginAt: string; finishedAt: string | null } | null
  today: string
}) {
  const { stops, regionId } = props
  const router = useRouter()
  const [pending, start] = useTransition()
  const [me, setMe] = useState<Pt | null>(null)
  const [gps, setGps] = useState<'wait' | 'on' | 'off'>('wait')
  const [route, setRoute] = useState<Route | null>(null)
  const [manual, setManual] = useState<string[] | null>(null)
  const [planning, setPlanning] = useState(false)
  const [phase, setPhase] = useState<Phase>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [now, setNow] = useState(() => istMin())
  const meRef = useRef<Pt | null>(null)

  // Live position from the phone. Only the delivery person and admin ever see it.
  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setGps('off'))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pt = { lat: p.coords.latitude, lng: p.coords.longitude }
        meRef.current = pt
        setMe(pt)
        setGps('on')
      },
      () => setGps('off'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  useEffect(() => {
    if (!props.tracking) return
    const send = () => meRef.current && pingAction(meRef.current).catch(() => {})
    const t = setInterval(send, 30_000)
    const first = setTimeout(send, 3_000)
    return () => (clearInterval(t), clearTimeout(first))
  }, [props.tracking])

  useEffect(() => {
    const t = setInterval(() => setNow(istMin()), 30_000)
    return () => clearInterval(t)
  }, [])

  const todo = useMemo(() => stops.filter((s) => !s.status), [stops])
  const done = useMemo(() => stops.filter((s) => s.status).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')), [stops])

  const plan = useCallback(
    async (order: string[] | null) => {
      setPlanning(true)
      try {
        setRoute(await planRouteAction({ origin: meRef.current, manual: order, regionId }))
      } catch {
        // keep the last route
      } finally {
        setPlanning(false)
      }
    },
    [regionId],
  )

  // First route once GPS answers (or after 6 seconds without it).
  const planned = useRef(false)
  useEffect(() => {
    if (planned.current || todo.length === 0) return
    const t = setTimeout(
      () => {
        if (planned.current) return
        planned.current = true
        plan(null)
      },
      gps === 'wait' ? 6_000 : 0,
    )
    return () => clearTimeout(t)
  }, [gps, todo.length, plan])

  // Stops to do, in route order. Stops without a pin go last.
  const ordered = useMemo(() => {
    const ids = route?.order ?? []
    const byId = new Map(todo.map((s) => [s.leadId, s]))
    const inRoute = ids.map((id) => byId.get(id)).filter((s): s is Stop => !!s)
    const rest = todo.filter((s) => !ids.includes(s.leadId)).sort((a, b) => Number(a.lat == null) - Number(b.lat == null))
    return [...inRoute, ...rest]
  }, [route, todo])

  // Expected arrival at each stop: now + travel + 2 minutes per door.
  const eta = useMemo(() => {
    const out = new Map<string, number>()
    if (!route) return out
    let t = now * 60
    for (const s of ordered) {
      const leg = route.legSec[s.leadId]
      if (leg == null) continue
      t += leg
      out.set(s.leadId, t / 60)
      t += SERVICE_SEC
    }
    return out
  }, [route, ordered, now])

  const active = ordered.find((s) => s.leadId === current) ?? ordered[0] ?? null

  const mark = (s: Stop, delivered: boolean, boxBack: boolean | null, reason: (typeof REASONS)[number] | null) =>
    start(async () => {
      const r = await markStopAction({ leadId: s.leadId, regionId, delivered, boxBack, reason })
      setPhase(null)
      setCurrent(null)
      if (!r.ok) return setToast({ leadId: s.leadId, text: r.error, tone: 'red' })
      if (navigator.vibrate) navigator.vibrate(30)
      setToast({ leadId: s.leadId, text: delivered ? `${s.name}: delivered` : `${s.name}: ${reason}`, tone: delivered ? 'leaf' : 'red' })
      setManual((m) => m?.filter((id) => id !== s.leadId) ?? null)
      router.refresh()
    })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6_000)
    return () => clearTimeout(t)
  }, [toast])

  const undo = (leadId: string) =>
    start(async () => {
      await undoStopAction(leadId, regionId)
      setToast(null)
      router.refresh()
    })

  const move = (leadId: string, dir: -1 | 1) => {
    const ids = ordered.filter((s) => s.lat != null).map((s) => s.leadId)
    const i = ids.indexOf(leadId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setManual(ids)
    plan(ids)
  }

  const saveSpot = (s: Stop) =>
    start(async () => {
      if (!meRef.current) return setToast({ leadId: s.leadId, text: 'Turn on location to save this spot', tone: 'red' })
      await saveSpotAction(s.leadId, meRef.current, regionId)
      setToast({ leadId: '', text: `Pin saved for ${s.name}`, tone: 'leaf' })
      router.refresh()
    })

  const delivered = stops.filter((s) => s.status === 'DELIVERED').length
  const missed = stops.length - todo.length - delivered
  const finished = todo.length === 0 && stops.length > 0
  const pct = stops.length ? Math.round(((stops.length - todo.length) / stops.length) * 100) : 0
  const late = active ? (eta.get(active.leadId) ?? 0) > (active.dueMin ?? 1e9) : false
  const mapStops = useMemo(
    () => [
      ...ordered.filter((s) => s.lat != null).map((s, i) => ({ id: s.leadId, lat: s.lat!, lng: s.lng!, label: String(i + 1), kind: s.leadId === active?.leadId ? ('next' as const) : ('todo' as const) })),
      ...done.filter((s) => s.lat != null).map((s) => ({ id: s.leadId, lat: s.lat!, lng: s.lng!, label: '', kind: s.status === 'DELIVERED' ? ('done' as const) : ('missed' as const) })),
    ],
    [ordered, done, active],
  )
  // Full route in the Google Maps app (works without an API key; up to 9 stops in between).
  const pinned = ordered.filter((s) => s.lat != null)
  const fullRoute = pinned.length
    ? `https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=${pinned[Math.min(pinned.length, 10) - 1].lat},${pinned[Math.min(pinned.length, 10) - 1].lng}${pinned.length > 1 ? `&waypoints=${pinned.slice(0, Math.min(pinned.length, 10) - 1).map((s) => `${s.lat},${s.lng}`).join('|')}` : ''}`
    : null

  return (
    <div className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+190px)]">
      {/* Progress */}
      <section className="px-4 pt-3" aria-label="Today's progress">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Left" value={todo.length} tone="text-brand" />
          <Stat label="Delivered" value={delivered} tone="text-leaf" />
          <Stat label="Missed" value={missed} tone={missed ? 'text-red' : 'text-muted'} />
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-s2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-leaf transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        {props.round && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon name="clock" className="size-4" />
            Started {isoClock(props.round.loginAt)}
            {props.round.finishedAt && <> · Finished {isoClock(props.round.finishedAt)}</>}
          </p>
        )}
      </section>

      {/* Map */}
      <section className="relative mx-4 mt-3 overflow-hidden rounded-2xl border border-line bg-s2" style={{ height: '42dvh', minHeight: 260 }} aria-label="Route map">
        {props.mapKey ? (
          <DeliveryMap apiKey={props.mapKey} me={me} centre={props.centre} stops={mapStops} path={route?.path ?? []} onPick={(id) => ordered.some((s) => s.leadId === id) && setCurrent(id)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Icon name="map" className="size-9 text-muted" />
            <p className="text-sm text-muted">The map turns on once the Google Maps key is added. The list and navigation work now.</p>
            {fullRoute && <a href={fullRoute} target="_blank" rel="noreferrer" className="btn min-h-12">Open route in Google Maps</a>}
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button onClick={() => (setManual(null), plan(null))} disabled={planning || todo.length === 0} className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-semibold shadow-md active:scale-95 disabled:opacity-60" aria-label="Re-plan route">
            <Icon name="refresh" className={`size-4 ${planning ? 'animate-spin' : ''}`} />
            {planning ? 'Planning' : 'Re-plan'}
          </button>
        </div>
        {gps === 'off' && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-red-soft px-3 py-2 text-[13px] font-semibold text-red">Location is off. Allow location for this site so the route starts from you.</div>
        )}
      </section>

      {finished ? (
        <section className="mx-4 mt-4 rounded-2xl border border-leaf bg-leaf-soft p-5 text-center">
          <Icon name="check" className="mx-auto size-10 text-leaf" />
          <h2 className="mt-2 font-display text-xl font-semibold">All done for today</h2>
          <p className="mt-1 text-sm">
            {delivered} delivered{missed ? `, ${missed} missed` : ''}
            {props.round?.finishedAt && <> · finished {isoClock(props.round.finishedAt)}</>}
          </p>
        </section>
      ) : stops.length === 0 ? (
        <section className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <h2 className="font-display text-lg font-semibold">No drops today</h2>
          <p className="mt-1 text-sm text-muted">Nothing to deliver in your region today.</p>
        </section>
      ) : null}

      {/* Up next */}
      {ordered.length > 0 && (
        <section className="mt-4 px-4" aria-label="Stops to do">
          <h2 className="mb-2 flex items-center justify-between text-[13px] font-bold tracking-wide text-muted uppercase">
            <span>Up next · {ordered.length}</span>
            {manual && <span className="normal-case tracking-normal text-brand">Your order</span>}
          </h2>
          <ol className="space-y-2">
            {ordered.map((s, i) => {
              const at = eta.get(s.leadId)
              const isLate = at != null && s.dueMin != null && at > s.dueMin
              const on = s.leadId === active?.leadId
              return (
                <li key={s.leadId} className={`rounded-2xl border bg-surface ${on ? 'border-brand ring-2 ring-brand-soft' : 'border-line'} ${s.altBox ? 'bg-sky-soft' : ''}`}>
                  <div className="flex items-start gap-3 p-3">
                    <button onClick={() => (setCurrent(s.leadId), setPhase(null))} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-label={`Select ${s.name}`}>
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${on ? 'bg-brand text-white' : 'bg-s2 text-ink'}`}>{s.lat == null ? '!' : i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold">{s.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                          {s.timeLabel && <span className={`inline-flex items-center gap-1 ${s.exact ? 'font-semibold text-ink' : ''}`}><Icon name="clock" className="size-3.5" />{s.timeLabel}</span>}
                          {at != null && <span className={isLate ? 'font-semibold text-red' : ''}>· reach {clock(at)}{isLate ? ' (late)' : ''}</span>}
                        </span>
                        <Tags s={s} />
                      </span>
                    </button>
                    {s.lat != null && ordered.length > 1 && (
                      <span className="flex shrink-0 flex-col gap-1">
                        <button onClick={() => move(s.leadId, -1)} disabled={i === 0 || planning} className="flex size-10 items-center justify-center rounded-lg border border-line active:bg-s2 disabled:opacity-30" aria-label={`Move ${s.name} earlier`}><Icon name="up" className="size-5" /></button>
                        <button onClick={() => move(s.leadId, 1)} disabled={i >= pinned.length - 1 || planning} className="flex size-10 items-center justify-center rounded-lg border border-line active:bg-s2 disabled:opacity-30" aria-label={`Move ${s.name} later`}><Icon name="down" className="size-5" /></button>
                      </span>
                    )}
                  </div>
                  {s.lat == null && (
                    <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
                      <span className="flex-1 text-[13px] text-red">No pin. {s.address ?? 'No address'}</span>
                      <button onClick={() => saveSpot(s)} disabled={pending} className="btn-secondary btn-sm min-h-11">Save this spot</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {props.leave.length > 0 && (
        <section className="mt-4 px-4">
          <h2 className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">On leave today · {props.leave.length}</h2>
          <div className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-muted">{props.leave.map((l) => l.name).join(', ')}</div>
        </section>
      )}

      {done.length > 0 && (
        <details className="mt-4 px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-bold tracking-wide text-muted uppercase">Done · {done.length}</summary>
          <ul className="space-y-2">
            {done.map((s) => (
              <li key={s.leadId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className={`flex size-8 items-center justify-center rounded-full ${s.status === 'DELIVERED' ? 'bg-leaf-soft text-leaf' : 'bg-red-soft text-red'}`}>
                  <Icon name={s.status === 'DELIVERED' ? 'check' : 'x'} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="text-[13px] text-muted">
                    {s.status === 'DELIVERED' ? `Delivered${s.boxBack === true ? ' · box back' : s.boxBack === false ? ' · box not back' : ''}` : s.remarks ?? 'Not delivered'}
                    {s.doneAt && ` · ${isoClock(s.doneAt)}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {todo.length > 0 && props.round && !props.round.finishedAt && done.length > 0 && (
        <div className="mt-4 px-4">
          <button onClick={() => start(() => finishRoundAction().then(() => router.refresh()))} className="min-h-11 w-full rounded-xl text-[13px] font-semibold text-muted underline">Stop the round early</button>
        </div>
      )}

      {/* Thumb zone: the current stop and the 2 taps */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-8px_24px_rgba(30,20,40,0.12)]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold leading-6">{active.name}</div>
              <div className="truncate text-[13px] text-muted">
                {active.timeLabel ?? 'No time'}
                {eta.get(active.leadId) != null && <span className={late ? 'font-semibold text-red' : ''}> · reach {clock(eta.get(active.leadId)!)}{late ? ' (late)' : ''}</span>}
                {active.address && ` · ${active.address}`}
              </div>
            </div>
            {active.lat != null && (
              <a href={navUrl({ lat: active.lat, lng: active.lng! })} target="_blank" rel="noreferrer" className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-sky px-4 text-sm font-semibold text-white active:scale-95">
                <Icon name="nav" className="size-5" /> Go
              </a>
            )}
          </div>
          <div className="mt-3" aria-live="polite">
            {phase?.leadId !== active.leadId ? (
              <div className="grid grid-cols-2 gap-2.5">
                <BigButton tone="leaf" onClick={() => setPhase({ leadId: active.leadId, step: 'delivered' })} disabled={pending} icon="check">Delivered</BigButton>
                <BigButton tone="red" outline onClick={() => setPhase({ leadId: active.leadId, step: 'not' })} disabled={pending} icon="x">Not delivered</BigButton>
              </div>
            ) : phase.step === 'delivered' ? (
              <StepTwo title={active.altBox ? `Alternative box #${active.altBox}. Empty box returned?` : 'Empty box returned?'} back={() => setPhase(null)}>
                <div className="grid grid-cols-2 gap-2.5">
                  <BigButton tone="leaf" onClick={() => mark(active, true, true, null)} disabled={pending}>Box returned</BigButton>
                  <BigButton tone="warn" onClick={() => mark(active, true, false, null)} disabled={pending}>Not returned</BigButton>
                </div>
              </StepTwo>
            ) : (
              <StepTwo title="Why not delivered?" back={() => setPhase(null)}>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((r) => (
                    <button key={r} onClick={() => mark(active, false, null, r)} disabled={pending} className={`min-h-12 rounded-xl border border-line px-3 text-[15px] font-semibold active:scale-[0.98] active:bg-red-soft disabled:opacity-60 ${r === 'Other' ? 'col-span-2' : ''}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </StepTwo>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed inset-x-4 z-50 mx-auto flex max-w-[34rem] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.tone === 'leaf' ? 'bg-leaf' : 'bg-red'}`} style={{ top: 'calc(env(safe-area-inset-top) + 68px)' }} role="status">
          <span className="flex-1">{toast.text}</span>
          {toast.leadId && stops.some((s) => s.leadId === toast.leadId) && (
            <button onClick={() => undo(toast.leadId)} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white/20 px-3 active:bg-white/30">
              <Icon name="undo" className="size-4" /> Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <div className={`font-display text-2xl font-bold leading-7 ${tone}`}>{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
    </div>
  )
}

function Tags({ s }: { s: Stop }) {
  const tags: [string, string][] = []
  if (s.trial) tags.push(['Trial box', 'bg-sky-soft text-sky'])
  if (s.altBox) tags.push([`Alt box #${s.altBox}`, 'bg-sky text-white'])
  if (s.bm > 0) tags.push([`Buttermilk ${s.bm}`, 'bg-leaf-soft text-leaf'])
  if (s.swapTo) tags.push([`Swap: ${s.swapTo}`, 'bg-tur-soft text-warn'])
  if (s.dayNo === 1) tags.push(['New', 'bg-brand-soft text-brand'])
  if (!tags.length) return null
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {tags.map(([t, c]) => <span key={t} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{t}</span>)}
    </span>
  )
}

function BigButton({ children, tone, outline, onClick, disabled, icon }: { children: React.ReactNode; tone: 'leaf' | 'red' | 'warn'; outline?: boolean; onClick: () => void; disabled?: boolean; icon?: 'check' | 'x' }) {
  const solid = { leaf: 'bg-leaf text-white', red: 'bg-red text-white', warn: 'bg-tur text-white' }[tone]
  const line = { leaf: 'border-2 border-leaf text-leaf', red: 'border-2 border-red text-red', warn: 'border-2 border-tur text-warn' }[tone]
  return (
    <button onClick={onClick} disabled={disabled} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-base font-bold transition-transform active:scale-[0.97] disabled:opacity-60 ${outline ? `${line} bg-surface` : solid}`}>
      {icon && <Icon name={icon} className="size-5" />}
      {children}
    </button>
  )
}

function StepTwo({ title, back, children }: { title: string; back: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={back} className="flex size-10 items-center justify-center rounded-lg border border-line active:bg-s2" aria-label="Back">
          <Icon name="back" className="size-5" />
        </button>
        <span className="text-[15px] font-semibold">{title}</span>
      </div>
      {children}
    </div>
  )
}
