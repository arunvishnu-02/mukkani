'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Keeps every screen current: fresh data and red numbers every minute, and at once when the tab is opened again.
// It never refreshes while someone is typing or has changed a form that is not saved yet.
export function AutoRefresh({ every = 60 }: { every?: number }) {
  const router = useRouter()
  useEffect(() => {
    let dirty = false
    let last = Date.now()
    const onInput = (e: Event) => { if ((e.target as HTMLElement).closest('form')) dirty = true }
    const onSubmit = () => { dirty = false }
    const busy = () => {
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      return dirty || typing || document.querySelector('[role="dialog"]') != null
    }
    const refresh = () => {
      if (document.visibilityState !== 'visible' || busy()) return
      last = Date.now()
      router.refresh()
    }
    const timer = setInterval(refresh, every * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > 15_000) refresh() }
    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('change', onInput, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [router, every])
  return null
}
