// Seed: regions and the first admin always; demo users and customers only with SEED_DEMO=1.
//   ADMIN_PASSWORD=...  npx tsx prisma/seed.ts
//   SEED_DEMO=1         npx tsx prisma/seed.ts
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const IST = 'Asia/Kolkata'
const day = (off: number) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(Date.now() + off * 86_400_000))}T00:00:00Z`)

// Approximate centres. Admin can correct them in Users + regions.
const REGIONS: [string, number, number][] = [
  ['Trichy', 10.805, 78.6856],
  ['Srirangam', 10.862, 78.693],
  ['Thillai Nagar', 10.827, 78.683],
  ['K.K. Nagar', 10.77, 78.71],
  ['Woraiyur', 10.828, 78.67],
]

async function main() {
  for (const [name, lat, lng] of REGIONS) await db.region.upsert({ where: { name }, update: {}, create: { name, lat, lng } })

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
  const murugan = await mk('Murugan K', 'kitchen', 'KITCHEN', 'kitchen123', '98430 77889')
  const r = Object.fromEntries((await db.region.findMany()).map((x) => [x.name, x]))
  await db.region.update({ where: { id: r['Trichy'].id }, data: { ownerId: divya.id } })
  await db.region.update({ where: { id: r['Srirangam'].id }, data: { ownerId: divya.id } })

  type L = [string, string, string, string, string, string?]
  const leads: L[] = [
    ['Meena R', '98431 22017', 'Srirangam', 'REFERRAL', 'TRIAL_REQUESTED', 'Low-oil lunch'],
    ['Karthik S', '90031 55120', 'Thillai Nagar', 'WHATSAPP', 'CONTACTED'],
    ['Anand V', '99524 61003', 'Trichy', 'INSTAGRAM', 'NEW'],
    ['Revathi M', '97890 44211', 'K.K. Nagar', 'CALL', 'FOLLOW_UP', 'Diabetic-friendly menu'],
    ['Priya S', '94422 87310', 'Srirangam', 'FACEBOOK', 'CONVERTED', 'No sugar'],
    ['Lakshmi Narayanan', '94433 10928', 'Trichy', 'CALL', 'TRIAL_REQUESTED', 'Low-oil, no onion'],
    ['Suresh B', '98940 13377', 'Woraiyur', 'WALK_IN', 'NOT_INTERESTED'],
    ['Deepa K', '90800 21544', 'Thillai Nagar', 'WEBSITE', 'LOST'],
    ['Anitha J', '98652 30418', 'Trichy', 'CALL', 'TRIAL_ACTIVE', 'Diabetic friendly'],
    ['Gowri V', '94431 90012', 'Thillai Nagar', 'REFERRAL', 'TRIAL_ACTIVE', 'Millet dosa'],
    ['Ramesh P', '94860 77215', 'Thillai Nagar', 'CALL', 'CONVERTED'],
    ['Kavitha S', '99940 18826', 'Srirangam', 'WHATSAPP', 'CONVERTED', 'Less salt'],
    ['Mohan D', '90250 66391', 'K.K. Nagar', 'REFERRAL', 'CONVERTED'],
    ['Jaya L', '90036 42118', 'Trichy', 'INSTAGRAM', 'CONVERTED', 'Millet only'],
    ['Selvi R', '97515 40027', 'Woraiyur', 'CALL', 'TRIAL_REQUESTED', 'Less spicy'],
  ]
  const slots = ['6:30 to 7:00', '7:00 to 7:30', '7:30 to 8:00']
  let i = 0
  for (const [name, phone, region, source, status, food] of leads) {
    i++
    const owner = i % 2 ? divya : karthik
    const pinned = i % 4 !== 0
    const reg = r[region]
    const lead = await db.lead.create({
      data: {
        name, phone, source: source as never, status: status as never, foodNotes: food ?? null, regionId: reg.id, ownerId: owner.id,
        slot: slots[i % 3], nextFollowUpAt: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'TRIAL_ACTIVE'].includes(status) ? day((i % 3) - 1) : null,
        locationStatus: pinned ? 'PIN_SAVED' : i % 8 === 0 ? 'LINK_SENT' : 'MISSING',
        lat: pinned ? reg.lat! + (i % 5) * 0.002 : null, lng: pinned ? reg.lng! - (i % 3) * 0.002 : null, accuracyM: pinned ? 8 : null,
        address: pinned ? `${i}, ${['2nd', '4th', '6th'][i % 3]} Cross, ${region}, Trichy` : null,
        createdAt: new Date(Date.now() - (20 - i) * 86_400_000),
      },
    })
    await db.activity.create({ data: { leadId: lead.id, kind: 'lead', text: 'Lead added', detail: `Source: ${source.toLowerCase()}`, byId: owner.id } })
    if (status === 'TRIAL_REQUESTED') await db.trialBox.create({ data: { leadId: lead.id, startDate: day(i === 15 ? 0 : 1), endDate: day(i === 15 ? 6 : 7), status: i === 15 ? 'PREPARING' : 'PENDING', assignedToId: murugan.id, notes: food } })
    if (status === 'TRIAL_ACTIVE') await db.trialBox.create({ data: { leadId: lead.id, startDate: day(-3), endDate: day(i === 10 ? 0 : 3), status: 'TRIAL_ACTIVE', assignedToId: murugan.id, notes: food } })
    if (status === 'CONVERTED') {
      await db.trialBox.create({ data: { leadId: lead.id, startDate: day(-40 + i), endDate: day(-34 + i), status: 'COMPLETED', result: 'CONVERTED', assignedToId: murugan.id } })
      await db.package.create({ data: { leadId: lead.id, packageType: 'Monthly package', startDate: day(-33 + i), status: i === 13 ? 'PAUSED' : 'ACTIVE' } })
    }
    if (pinned) await db.activity.create({ data: { leadId: lead.id, kind: 'location', text: 'Location shared by customer', detail: 'Profile updated automatically' } })
  }
  console.log('Demo data added')
}

main().finally(() => db.$disconnect())
