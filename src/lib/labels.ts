import type {
  AttendanceStatus,
  CustomerStatus,
  LeadSource,
  LeadStatus,
  LocationStatus,
  PackageStatus,
  Role,
  TrialStatus,
} from '@/generated/prisma/enums'

export type Tone = 'sky' | 'warn' | 'leaf' | 'muted' | 'red' | 'brand'

// The 4 customer categories (plan doc section 2).
export const LEAD_STATUS: Record<LeadStatus, [string, Tone]> = {
  FOLLOW_UP: ['Follow up', 'warn'],
  TRIAL: ['Trial', 'sky'],
  MONTHLY: ['Monthly pack', 'leaf'],
  NOT_INTERESTED: ['Not interested', 'muted'],
}

export const CUSTOMER_STATUS: Record<CustomerStatus | 'ABSENT', [string, Tone]> = {
  ACTIVE: ['Active', 'leaf'],
  ABSENT: ['Absent', 'warn'],
  PAUSED: ['Paused', 'sky'],
  INACTIVE: ['Inactive', 'muted'],
}

export const TRIAL_STATUS: Record<TrialStatus, [string, Tone]> = {
  BOOKED: ['Booked', 'sky'],
  DELIVERED: ['Awaiting result', 'warn'],
  DONE: ['Done', 'muted'],
}

export const TRIAL_RESULT: Record<string, [string, Tone]> = {
  MONTHLY: ['Monthly pack', 'leaf'],
  FOLLOW_UP: ['Follow up', 'warn'],
  NOT_INTERESTED: ['Not interested', 'muted'],
}

export const PACKAGE_STATUS: Record<PackageStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'leaf'],
  COMPLETED: ['Completed', 'muted'],
  CANCELLED: ['Stopped', 'red'],
}

export const ATTENDANCE: Record<AttendanceStatus, [string, Tone]> = {
  DELIVERED: ['Delivered', 'leaf'],
  ABSENT: ['Absent', 'warn'],
  NOT_DELIVERED: ['Not delivered', 'red'],
}

export const LOCATION_STATUS: Record<LocationStatus, [string, Tone]> = {
  MISSING: ['Missing', 'red'],
  LINK_SENT: ['Link sent', 'warn'],
  PIN_SAVED: ['Pin saved', 'leaf'],
}

export const SOURCE: Record<LeadSource, string> = {
  WHATSAPP: 'WhatsApp',
  INSTA_DM: 'Instagram DM',
  INSTA_COMMENT: 'Instagram comment',
  GBM: 'Google Business',
  CALL: 'Phone call',
  OTHER: 'Other',
}

export const ROLE: Record<Role, [string, Tone]> = {
  ADMIN: ['Admin', 'leaf'],
  SALES: ['Sales', 'sky'],
  KITCHEN: ['Kitchen manager', 'warn'],
}

// Call register results for leads (plan doc section 4). The first three need a next call date.
export const LEAD_CALL: [string, string][] = [
  ['INTERESTED', 'Interested'],
  ['NO_ANSWER', 'No answer'],
  ['CALL_BACK', 'Call back later'],
  ['TRIAL', 'Book trial'],
  ['MONTHLY', 'Monthly pack'],
  ['NOT_INTERESTED', 'Not interested'],
]
export const NEEDS_NEXT_CALL = ['INTERESTED', 'NO_ANSWER', 'CALL_BACK']

// Kitchen manager calls to monthly customers.
export const CUSTOMER_CALL: Record<string, [string, Tone]> = {
  HAPPY: ['Happy', 'leaf'],
  ISSUE: ['Has an issue', 'red'],
  NO_ANSWER: ['No answer', 'muted'],
  RENEWAL: ['Renewal call', 'brand'],
}
export const RENEWAL: Record<string, [string, Tone]> = {
  YES: ['Renewing', 'leaf'],
  NO: ['Not renewing', 'red'],
  UNDECIDED: ['Not decided', 'warn'],
}

export const NOT_INTERESTED_REASONS = ['Price', 'Moving away', 'Health', 'Taste', 'Timing', 'Other']
export const WASTE_REASONS = ['Cutting waste', 'Spoiled', 'Other'] as const
export const MONEY_CATEGORIES = ['Fruits', 'Vegetables', 'Packaging', 'Buttermilk', 'Salary', 'Rent', 'Fuel / bike', 'Other bills']

export const PACKAGE_DAYS = 26
export const BOX_NUMBERS = 100

export const rupees = (n: number) => `Rs ${n.toLocaleString('en-IN')}`
