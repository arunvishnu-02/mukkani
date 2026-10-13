import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

// Ids are UUID columns. An id from the address bar that is not a UUID makes Postgres reject the
// query, so a read with such an id answers "nothing found" instead of an error page.
const NOTHING: Record<string, unknown> = { findUnique: null, findFirst: null, findMany: [], count: 0 }

// Keep connections open between clicks (opening one costs several trips to the database) and stay
// under the 15 connections Supabase's session pooler allows when two server processes run.
const POOL = { connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 60_000 }

function client() {
  return new PrismaClient({ adapter: new PrismaPg(POOL) }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          try {
            return await query(args)
          } catch (e) {
            const err = e as { message?: string; meta?: unknown }
            if (operation in NOTHING && `${err.message} ${JSON.stringify(err.meta)}`.includes('invalid input syntax for type uuid')) return NOTHING[operation]
            throw e
          }
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof client> }

export const db = globalForPrisma.prisma ?? client()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
