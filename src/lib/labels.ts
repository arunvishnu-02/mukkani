import type { LeadSource, LeadStatus, LocationStatus, PackageStatus, Role } from '@/generated/prisma/enums'

export type Tone = 'sky' | 'warn' | 'leaf' | 'muted' | 'red'

export const LEAD_STATUS: Record<LeadStatus, [string, Tone]> = {
  NEW: ['New Lead', 'sky'],
  CONTACTED: ['Contacted', 'sky'],
  FOLLOW_UP: ['Follow-Up Required', 'warn'],
  NOT_INTERESTED: ['Not Interested', 'muted'],
  TRIAL_REQUESTED: ['Trial Box Requested', 'warn'],
  TRIAL_ACTIVE: ['Trial Box Active', 'leaf'],
  CONVERTED: ['Monthly Package Converted', 'leaf'],
  LOST: ['Lost Lead', 'red'],
}

export const PACKAGE_STATUS: Record<PackageStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'leaf'],
  PAUSED: ['Paused', 'warn'],
  COMPLETED: ['Completed', 'muted'],
  CANCELLED: ['Cancelled', 'red'],
}

export const LOCATION_STATUS: Record<LocationStatus, [string, Tone]> = {
  MISSING: ['Missing', 'red'],
  LINK_SENT: ['Link sent', 'warn'],
  PIN_SAVED: ['Pin saved', 'leaf'],
}

export const SOURCE: Record<LeadSource, string> = {
  CALL: 'Call',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Referral',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  WALK_IN: 'Walk-in',
}

export const ROLE: Record<Role, [string, Tone]> = {
  ADMIN: ['Admin', 'leaf'],
  SALES: ['Sales', 'sky'],
  KITCHEN: ['Kitchen manager', 'warn'],
}

// Package names and delivery slots are placeholders until Arun sends the real ones.
export const PACKAGE_TYPES = ['Monthly · Breakfast', 'Monthly · Lunch', 'Monthly · Lunch + dinner']
export const SLOTS = ['6:30 to 7:00', '7:00 to 7:30', '7:30 to 8:00']
