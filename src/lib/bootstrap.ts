import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// The delivery regions from the plan. Approximate centres; admin can correct them in Team + regions.
const REGIONS: [string, number, number][] = [
  ['Srirangam', 10.862, 78.693],
  ['Junction', 10.796, 78.685],
  ['Mannachanallur', 10.905, 78.705],
  ['Andavan College', 10.855, 78.71],
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
