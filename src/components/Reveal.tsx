'use client'

import { useEffect, useRef, useState } from 'react'

// Shows its children only while a radio or select called `name` in the same form has one of `values`.
export function Reveal({ name, values, initial, children }: { name: string; values: string[]; initial?: string | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState(initial ?? null)
  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    const read = () => {
      const el = form.elements.namedItem(name)
      setValue(el && 'value' in el ? (el as unknown as { value: string }).value : null)
    }
    read()
    form.addEventListener('change', read)
    return () => form.removeEventListener('change', read)
  }, [name])
  return (
    <div ref={ref} className={value != null && values.includes(value) ? 'space-y-3.5' : 'hidden'}>
      {children}
    </div>
  )
}
