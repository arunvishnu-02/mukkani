import { requireUser } from '@/lib/auth'
import { CustomersView } from '@/components/CustomersView'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  return <CustomersView base="/customers" sp={await searchParams} kitchen={false} />
}
