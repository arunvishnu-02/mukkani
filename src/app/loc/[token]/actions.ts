'use server'

import { z } from 'zod'
import { saveSharedLocation } from '@/lib/workflow'

export async function shareLocation(token: string, lat: number, lng: number, accuracy: number | null) {
  const p = z
    .object({ token: z.string().min(4).max(40), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().nullable() })
    .parse({ token, lat, lng, accuracy })
  return saveSharedLocation(p.token, p.lat, p.lng, p.accuracy)
}
