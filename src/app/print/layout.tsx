import { requireUser } from '@/lib/auth'
import { PrintButton } from './PrintButton'

// Printable A4 pages, without the app menu.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div className="min-h-screen bg-bg py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center gap-3 px-2">
        <span className="flex-1 text-sm text-muted">A4 sheet. Use Print, or Save as PDF to send on WhatsApp.</span>
        <PrintButton />
      </div>
      {children}
    </div>
  )
}
