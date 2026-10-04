import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@/generated/prisma/client'

// DATABASE_URL looks like mysql://user:password@host:3306/database (Hostinger MySQL is MariaDB).
export function mariadbUrl(url = process.env.DATABASE_URL ?? '') {
  return url.replace(/^mysql:\/\//, 'mariadb://')
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaMariaDb(mariadbUrl()) })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
