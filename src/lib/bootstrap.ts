import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// Approximate centres. Admin can correct them in Users + regions.
const REGIONS: [string, number, number][] = [
  ['Trichy', 10.805, 78.6856],
  ['Srirangam', 10.862, 78.693],
  ['Thillai Nagar', 10.827, 78.683],
  ['K.K. Nagar', 10.77, 78.71],
  ['Woraiyur', 10.828, 78.67],
]

// Runs when the server starts, so a fresh database (e.g. on Hostinger) gets the regions and a first admin
// without anyone running a seed command. It only creates what is missing and never changes existing data.
export async function bootstrap() {
  if ((await db.region.count()) === 0) await db.region.createMany({ data: REGIONS.map(([name, lat, lng]) => ({ name, lat, lng })) })
  const pw = process.env.ADMIN_PASSWORD
  if (pw && (await db.user.count({ where: { role: 'ADMIN' } })) === 0) {
    await db.user.create({ data: { name: 'Admin', username: 'admin', role: 'ADMIN', passwordHash: await bcrypt.hash(pw, 10) } })
    console.log('Created admin user "admin"')
  }
}
