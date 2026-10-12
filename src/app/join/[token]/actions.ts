'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { isDay, parseDay } from '@/lib/dates'
import { submitLeadInvite } from '@/lib/workflow'

// The public form a new customer fills in. No login: the link's token is the key.
export async function submitInvite(form: FormData) {
  const text = (k: string, max = 300) => { const v = String(form.get(k) ?? '').trim().slice(0, max); return v === '' ? null : v }
  const num = (k: string) => { const v = Number(form.get(k)); return form.get(k) && Number.isFinite(v) ? v : null }
  const token = z.string().min(4).max(40).parse(text('token'))
  const back = (msg: string): never => redirect(`/join/${token}?error=${encodeURIComponent(msg)}`)
  const name = text('name', 80)
  const phone = text('phone', 20)
  if (!name) return back('Please enter your name')
  if (!phone || phone.replace(/\D/g, '').length < 10) return back('Please enter your 10-digit phone number')
  const need: [string, string][] = [['address', 'your address'], ['regionId', 'your area'], ['slot', 'your delivery time'], ['dob', 'your date of birth'], ['avoidFoods', 'the foods you do not eat (type None if nothing)'], ['healthNotes', 'any health condition (type None if nothing)']]
  for (const [k, what] of need) if (!text(k)) return back(`Please fill in ${what}`)
  const lat = num('lat')
  const lng = num('lng')
  const pin = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const region = text('regionId')
  const r = await submitLeadInvite(token, {
    name,
    phone,
    altPhone: text('altPhone', 20),
    address: text('address'),
    dob: isDay(text('dob')) ? parseDay(text('dob')!) : null,
    slot: text('slot', 40),
    avoidFoods: text('avoidFoods'),
    healthNotes: text('healthNotes'),
    regionId: region && z.string().uuid().safeParse(region).success ? region : null,
    lat: pin ? lat : null,
    lng: pin ? lng : null,
    accuracy: pin ? num('accuracy') : null,
  })
  if (!r.ok) return back(r.error)
  redirect(`/join/${token}?done=1`)
}
