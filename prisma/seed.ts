// Seed: regions and the first admin always; demo users and customers only with SEED_DEMO=1.
//   ADMIN_PASSWORD=...  npx tsx prisma/seed.ts
//   SEED_DEMO=1         npx tsx prisma/seed.ts
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../src/generated/prisma/client'

const db = new PrismaClient({ adapter: new PrismaMariaDb((process.env.DATABASE_URL ?? '').replace(/^mysql:\/\//, 'mariadb://')) })
const IST = 'Asia/Kolkata'
const day = (off: number) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(Date.now() + off * 86_400_000))}T00:00:00Z`)
const add = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
const sunday = (d: Date) => d.getUTCDay() === 0
const nextDelivery = (d: Date) => (sunday(d) ? add(d, 1) : d)

// The date that makes today delivery day n of a pack (Mon-Sat, Sunday holiday), skipping `leave` extra days.
function startForDay(n: number, leave = 0) {
  let d = day(0)
  if (sunday(d)) d = add(d, -1)
  for (let k = 1; k < n + leave; ) {
    d = add(d, -1)
    if (!sunday(d)) k++
  }
  return d
}

// The delivery regions from the plan. Approximate centres; admin can correct them in Team + regions.
const REGIONS: [string, number, number][] = [
  ['Srirangam', 10.862, 78.693],
  ['Junction', 10.796, 78.685],
  ['Mannachanallur', 10.905, 78.705],
  ['Andavan College', 10.855, 78.71],
]
const SOURCES: Record<string, string> = { WHATSAPP: 'WhatsApp', INSTA_DM: 'Instagram DM', INSTA_COMMENT: 'Instagram comment', GBM: 'Google Business', CALL: 'Phone call' }
const SLOTS = ['6:30 to 7:00', '7:00 to 7:30', '7:30 to 8:00']

async function main() {
  if ((await db.region.count()) === 0) await db.region.createMany({ data: REGIONS.map(([name, lat, lng]) => ({ name, lat, lng })) })

  const adminPw = process.env.ADMIN_PASSWORD ?? (process.env.SEED_DEMO ? 'admin123' : undefined)
  if (adminPw && !(await db.user.findUnique({ where: { username: 'admin' } }))) {
    await db.user.create({ data: { name: 'Arun G', username: 'admin', role: 'ADMIN', passwordHash: await bcrypt.hash(adminPw, 10) } })
    console.log('Created admin user "admin"')
  }
  if (!process.env.SEED_DEMO) return
  if ((await db.lead.count()) > 0) return console.log('Leads exist, demo data skipped')

  const mk = async (name: string, username: string, role: 'SALES' | 'KITCHEN', pw: string, phone: string) =>
    db.user.upsert({ where: { username }, update: {}, create: { name, username, role, phone, passwordHash: await bcrypt.hash(pw, 10) } })
  const divya = await mk('Divya R', 'divya', 'SALES', 'sales123', '98430 11223')
  const karthik = await mk('Karthik M', 'karthik', 'SALES', 'sales123', '98430 44556')
  const kitchen = await mk('Murugan K', 'kitchen', 'KITCHEN', 'kitchen123', '98430 77889')
  const admin = await db.user.findUniqueOrThrow({ where: { username: 'admin' } })
  for (const r of await db.region.findMany()) await db.region.update({ where: { id: r.id }, data: { ownerId: r.name === 'Junction' ? karthik.id : divya.id } })
  const regions = await db.region.findMany({ orderBy: { name: 'asc' } })
  const reg = (i: number) => regions[i % regions.length]

  type Kind =
    | { k: 'follow'; next: number; calls?: string[] }
    | { k: 'ni'; reason: string }
    | { k: 'trial'; on: number; status: 'BOOKED' | 'DELIVERED'; paid?: boolean }
    | { k: 'trialDone'; result: 'FOLLOW_UP' | 'NOT_INTERESTED' }
    | { k: 'monthly'; dayNo: number; leave?: number; bm?: number; paid?: boolean; number?: number; status?: 'PAUSED' | 'INACTIVE' }
  type Demo = [name: string, phone: string, source: string, kind: Kind, avoid?: string, health?: string, birthday?: boolean]
  const people: Demo[] = [
    ['Anand V', '99524 61003', 'INSTA_DM', { k: 'follow', next: 0, calls: ['INTERESTED'] }],
    ['Karthik S', '90031 55120', 'WHATSAPP', { k: 'follow', next: 0 }],
    ['Revathi M', '97890 44211', 'CALL', { k: 'follow', next: -1, calls: ['NO_ANSWER'] }, undefined, 'Diabetic'],
    ['Bhuvana T', '98422 30519', 'GBM', { k: 'follow', next: 2, calls: ['CALL_BACK'] }],
    ['Senthil P', '94435 11872', 'INSTA_COMMENT', { k: 'follow', next: 1 }],
    ['Suresh B', '98940 13377', 'CALL', { k: 'ni', reason: 'Price' }],
    ['Deepa K', '90800 21544', 'INSTA_DM', { k: 'ni', reason: 'Moving away' }],
    ['Meena R', '98431 22017', 'WHATSAPP', { k: 'trial', on: 1, status: 'BOOKED', paid: true }, 'Papaya'],
    ['Lakshmi N', '94433 10928', 'CALL', { k: 'trial', on: 0, status: 'BOOKED', paid: true }, undefined, 'Low sugar'],
    ['Anitha J', '98652 30418', 'GBM', { k: 'trial', on: -1, status: 'DELIVERED', paid: true }, 'Pineapple'],
    ['Gowri V', '94431 90012', 'WHATSAPP', { k: 'trialDone', result: 'FOLLOW_UP' }],
    ['Selvi R', '97515 40027', 'INSTA_DM', { k: 'trialDone', result: 'NOT_INTERESTED' }],
    ['Priya S', '94422 87310', 'WHATSAPP', { k: 'monthly', dayNo: 1, bm: 1 }, 'Papaya', 'Diabetic'],
    ['Ramesh P', '94860 77215', 'CALL', { k: 'monthly', dayNo: 5 }, undefined, undefined, true],
    ['Kavitha S', '99940 18826', 'INSTA_DM', { k: 'monthly', dayNo: 9, leave: 1, bm: 2 }, 'Watermelon'],
    ['Mohan D', '90250 66391', 'GBM', { k: 'monthly', dayNo: 15 }],
    ['Jaya L', '90036 42118', 'WHATSAPP', { k: 'monthly', dayNo: 18, paid: false }, 'Guava'],
    ['Vijay A', '98947 21093', 'CALL', { k: 'monthly', dayNo: 23, bm: 1 }],
    ['Saranya K', '97877 40366', 'INSTA_COMMENT', { k: 'monthly', dayNo: 24, leave: 2 }],
    ['Ganesh R', '94438 76120', 'WHATSAPP', { k: 'monthly', dayNo: 26, number: 2 }],
    ['Uma M', '90034 98701', 'CALL', { k: 'monthly', dayNo: 12, status: 'PAUSED' }],
    ['Prakash N', '98656 12087', 'GBM', { k: 'monthly', dayNo: 7, status: 'INACTIVE' }],
  ]

  let i = 0
  for (const [name, phone, source, kind, avoid, health, birthday] of people) {
    i++
    const owner = i % 3 === 0 ? karthik : divya
    const r = reg(i)
    const pinned = i % 5 !== 0
    const status = kind.k === 'follow' ? 'FOLLOW_UP' : kind.k === 'ni' ? 'NOT_INTERESTED' : kind.k === 'trial' ? 'TRIAL' : kind.k === 'trialDone' ? (kind.result === 'NOT_INTERESTED' ? 'NOT_INTERESTED' : 'FOLLOW_UP') : 'MONTHLY'
    const slot = SLOTS[i % 3]
    const lead = await db.lead.create({
      data: {
        name, phone, source: source as never, status, regionId: r.id, ownerId: owner.id, slot,
        deliveryTime: kind.k === 'monthly' ? slot.split(' to ')[0].replace(':00', ':10').replace(':30', ':40') : null,
        avoidFoods: avoid ?? null, healthNotes: health ?? null,
        dob: birthday ? new Date(Date.UTC(1988, day(0).getUTCMonth(), day(0).getUTCDate())) : new Date(Date.UTC(1975 + i, (i * 5) % 12, 1 + ((i * 7) % 27))),
        notInterestedReason: kind.k === 'ni' ? kind.reason : kind.k === 'trialDone' && kind.result === 'NOT_INTERESTED' ? 'Taste' : null,
        nextFollowUpAt: kind.k === 'follow' ? day(kind.next) : kind.k === 'trialDone' && kind.result === 'FOLLOW_UP' ? day(3) : null,
        customerStatus: kind.k === 'monthly' && kind.status ? kind.status : 'ACTIVE',
        pausedUntil: kind.k === 'monthly' && kind.status === 'PAUSED' ? day(6) : null,
        locationStatus: pinned ? 'PIN_SAVED' : i % 2 ? 'LINK_SENT' : 'MISSING',
        lat: pinned ? r.lat! + (i % 5) * 0.002 : null, lng: pinned ? r.lng! - (i % 3) * 0.002 : null, accuracyM: pinned ? 8 : null,
        address: pinned ? `${i}, ${['2nd', '4th', '6th'][i % 3]} Cross, ${r.name}, Trichy` : null,
        createdAt: new Date(Date.now() - (kind.k === 'monthly' ? 40 : 12 - (i % 10)) * 86_400_000),
      },
    })
    await db.activity.create({ data: { leadId: lead.id, kind: 'lead', text: 'Lead added', detail: `Source: ${SOURCES[source]}`, byId: owner.id } })
    if (kind.k === 'follow') for (const c of kind.calls ?? []) await db.followUp.create({ data: { leadId: lead.id, outcome: c, note: 'Asked about price and timing', byId: owner.id, createdAt: new Date(Date.now() - 86_400_000) } })
    if (kind.k === 'ni') await db.followUp.create({ data: { leadId: lead.id, outcome: 'NOT_INTERESTED', note: kind.reason, byId: owner.id } })
    if (kind.k === 'trial') {
      await db.trialBox.create({ data: { leadId: lead.id, deliveryDate: nextDelivery(day(kind.on)), slot, paid: !!kind.paid, status: kind.status, boxNo: kind.status === 'DELIVERED' ? 40 + i : null, notes: avoid ?? null } })
    }
    if (kind.k === 'trialDone') {
      await db.trialBox.create({ data: { leadId: lead.id, deliveryDate: nextDelivery(day(-5)), slot, paid: true, status: 'DONE', result: kind.result, feedback: kind.result === 'FOLLOW_UP' ? 'Liked it, will decide after salary' : 'Did not like the taste' } })
    }
    if (kind.k === 'monthly') {
      const start = startForDay(kind.dayNo, kind.leave ?? 0)
      if (kind.number === 2) {
        const first = startForDay(kind.dayNo + 26)
        await db.trialBox.create({ data: { leadId: lead.id, deliveryDate: add(first, -2), slot, paid: true, status: 'DONE', result: 'MONTHLY' } })
        await db.package.create({ data: { leadId: lead.id, number: 1, startDate: first, status: 'COMPLETED', paid: true, paidAt: first } })
      } else {
        await db.trialBox.create({ data: { leadId: lead.id, deliveryDate: add(start, -2), slot, paid: true, status: 'DONE', result: 'MONTHLY' } })
      }
      const pkg = await db.package.create({
        data: {
          leadId: lead.id, number: kind.number ?? 1, startDate: start, buttermilkQty: kind.bm ?? 0,
          status: kind.status === 'INACTIVE' ? 'CANCELLED' : 'ACTIVE',
          paid: kind.paid !== false, paidAt: kind.paid !== false ? start : null,
        },
      })
      // Attendance for every delivery day before today; the first `leave` days after the start were absent.
      let absent = kind.leave ?? 0
      let delivered = 0
      for (let d = start; d < day(0) && delivered < kind.dayNo - 1; d = add(d, 1)) {
        if (sunday(d)) continue
        if (kind.status && d >= day(-kind.dayNo + 4)) break
        const st = absent > 0 && d > start ? (absent--, 'ABSENT') : (delivered++, 'DELIVERED')
        const bm = st === 'DELIVERED' && (kind.bm ?? 0) > 0 && [1, 3, 5].includes(d.getUTCDay())
        await db.attendance.create({ data: { leadId: lead.id, date: d, status: st as never, buttermilk: bm, boxBack: st === 'DELIVERED' ? true : null, byId: owner.id } })
      }
      const callDays = (kind.number ?? 1) === 1 ? [1, 5, 15] : [15]
      for (const n of callDays.filter((n) => n < kind.dayNo)) {
        await db.customerCall.create({ data: { leadId: lead.id, packageId: pkg.id, dayNo: n, outcome: n === 5 && i % 2 ? 'ISSUE' : 'HAPPY', note: n === 5 && i % 2 ? 'Box came late twice' : 'Likes the fruits', byId: kitchen.id, createdAt: add(start, Math.round(((n - 1) * 7) / 6)) } })
      }
    }
    if (pinned) await db.activity.create({ data: { leadId: lead.id, kind: 'location', text: 'Location shared by customer', detail: 'Profile updated automatically' } })
  }

  // Alternative boxes: one still out, one collected.
  const monthly = await db.lead.findMany({ where: { status: 'MONTHLY', customerStatus: 'ACTIVE' }, orderBy: { name: 'asc' } })
  await db.altBox.create({ data: { leadId: monthly[0].id, boxNo: 12, givenOn: day(-1) } })
  await db.altBox.create({ data: { leadId: monthly[1].id, boxNo: 27, givenOn: day(-3), collectedOn: day(-2) } })

  // Menu for today and the next delivery day.
  for (const [d, fruits] of [[day(0), 'Papaya, Watermelon, Pomegranate, Guava'], [nextDelivery(day(1)), 'Papaya, Pineapple, Banana, Muskmelon']] as const) {
    if (sunday(d)) continue
    await db.menu.create({ data: { date: d, fruits, salad: 'Sprouts salad', swapFruits: 'Apple, Orange', byId: divya.id } })
  }

  // Stock, wastage and money.
  for (const [fruit, kg] of [['Papaya', 12], ['Watermelon', 18], ['Pomegranate', 6], ['Guava', 5], ['Banana', 8], ['Apple', 2]] as const) {
    await db.stockEntry.create({ data: { date: day(-1), fruit, kind: 'IN', qtyKg: kg, note: 'Gandhi Market', byId: kitchen.id } })
    await db.stockEntry.create({ data: { date: day(-1), fruit, kind: 'USED', qtyKg: Math.round(kg * 0.4), byId: kitchen.id } })
  }
  await db.wastage.create({ data: { date: day(-1), fruit: 'Papaya', cutKg: 5, wasteKg: 0.8, reason: 'Cutting waste', byId: kitchen.id } })
  await db.wastage.create({ data: { date: day(-1), fruit: 'Watermelon', cutKg: 7, wasteKg: 1.5, reason: 'Cutting waste', byId: kitchen.id } })
  await db.wastage.create({ data: { date: day(-1), fruit: 'Guava', cutKg: 2, wasteKg: 0.4, reason: 'Spoiled', byId: kitchen.id } })
  const money: [number, 'PURCHASE' | 'EXPENSE', string, string, string | null, number, string][] = [
    [-1, 'PURCHASE', 'Fruits for the week', 'Fruits', '51 kg', 3150, 'Gandhi Market'],
    [-3, 'PURCHASE', 'Box covers and spoons', 'Packaging', '500 pcs', 1200, 'Sri Ram Plastics'],
    [-4, 'PURCHASE', 'Buttermilk', 'Buttermilk', '40 bottles', 800, 'Aavin'],
    [-6, 'EXPENSE', 'Petrol for delivery bike', 'Fuel / bike', null, 600, 'HP Bunk'],
    [-8, 'EXPENSE', 'Kitchen electricity bill', 'Other bills', null, 1450, 'TNEB'],
  ]
  for (const [off, type, item, category, quantity, amount, paidTo] of money) {
    await db.moneyEntry.create({ data: { date: day(off), type, item, category, quantity, amount, paidTo, byId: admin.id } })
  }
  console.log('Demo data added')
}

main().finally(() => db.$disconnect())
