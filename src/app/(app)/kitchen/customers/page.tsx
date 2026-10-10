import { requireUser } from '@/lib/auth'
import { CustomersView } from '@/components/CustomersView'

export default async function KitchenCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['KITCHEN'])
  return <CustomersView base="/kitchen/customers" sp={await searchParams} kitchen />
}
