import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'

// Everything the admin can change in Settings. Stored as text in the Setting table; defaults below.
export const DEFAULTS = {
  monthlyPrice: '3430',
  trialPrice: '200',
  buttermilkPrice: '299',
  slots: '6:30 to 7:00\n7:00 to 7:30\n7:30 to 8:00',
  fruits: 'Papaya\nWatermelon\nBanana\nPomegranate\nGuava\nApple\nMango\nGrapes\nPineapple\nMuskmelon\nOrange\nSapota',
  lowStockKg: '3',
  reviewLink: 'https://share.google/TvL4e1RGLlg3p1xAK',
  paymentQrId: '',
  msgReminder:
    'Hi {name}, your Mukkani monthly package ends on {endDate} (day 26 of 26). Our team will call you that day about next month. Stay healthy! - Team Mukkani',
  msgRenewal:
    'Hi {name}, thank you for continuing with Mukkani! Please pay Rs {amount} for next month using this QR code. Once the payment is done, please share the screenshot. - Team Mukkani',
  msgBirthday: 'Happy birthday {name}! Wishing you a healthy and happy year ahead. - Team Mukkani',
  msgReview: 'Hi {name}, thank you for being with Mukkani! It would mean a lot if you could share a Google review: {link} - Team Mukkani',
  msgReport: 'Hi {name}, here is your Mukkani monthly report for {from} to {to}. Thank you for eating healthy with us! - Team Mukkani',
  letter:
    'Dear {name},\n\nThank you for choosing Mukkani for your daily fruit and salad box. Every box is cut fresh in our kitchen each morning and delivered to your door before 8 AM.\n\nWe hope these 26 days have helped you eat healthier. Your next 26 days can start right after your last box. Just reply YES on WhatsApp to continue.\n\nWith warm wishes,\nTeam Mukkani',
  businessPhone: '744 844 6067',
  fssai: '22424592000619',
  address: '28 Sanathi St, Agilandeswari Medical 2nd Floor, Thiruvanaikovil, Trichy 620005',
}

export type SettingKey = keyof typeof DEFAULTS
export type Settings = Record<SettingKey, string>

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany()
  const out = { ...DEFAULTS }
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value
  return out
})

export const lines = (s: string) =>
  s
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean)

export async function appSettings() {
  const s = await getSettings()
  return {
    raw: s,
    monthlyPrice: Number(s.monthlyPrice) || 3430,
    trialPrice: Number(s.trialPrice) || 200,
    buttermilkPrice: Number(s.buttermilkPrice) || 299,
    slots: lines(s.slots),
    fruits: lines(s.fruits),
    lowStockKg: Number(s.lowStockKg) || 3,
  }
}
