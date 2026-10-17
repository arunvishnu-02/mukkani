import type { Prisma } from '@/generated/prisma/client'

// The details every lead and customer must have (the same ones the Add lead form asks for).
const NEED = [
  ['phone', 'phone'],
  ['address', 'address'],
  ['regionId', 'region'],
  ['dob', 'date of birth'],
  ['avoidFoods', 'foods to avoid'],
  ['healthNotes', 'health issues'],
] as const

type WithDetails = { phone: string; address: string | null; regionId: string | null; slot: string | null; dob: Date | null; avoidFoods: string | null; healthNotes: string | null }

// What is still to be filled in for this person, in words: ['phone', 'date of birth'].
export function missingDetails(l: WithDetails) {
  return NEED.filter(([k]) => (k === 'phone' ? !l.phone?.trim() : l[k] == null || l[k] === '')).map(([, label]) => label)
}

// Everyone with at least one detail missing.
export const missingWhere: Prisma.LeadWhereInput = {
  OR: [{ phone: '' }, { address: null }, { address: '' }, { regionId: null }, { dob: null }, { avoidFoods: null }, { avoidFoods: '' }, { healthNotes: null }, { healthNotes: '' }],
}
