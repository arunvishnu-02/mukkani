'use client'

import { useSyncExternalStore } from 'react'

// Today's date and the time in India, kept current while the page is open.
const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const now = () => fmt.format(new Date()).replace(/\b(am|pm)\b/, (m) => m.toUpperCase())
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}

export function Clock() {
  const text = useSyncExternalStore(subscribe, now, () => '')
  return <div className="h-5 text-right text-[13px] font-semibold text-muted">{text}</div>
}
