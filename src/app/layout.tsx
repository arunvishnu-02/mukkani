import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, JetBrains_Mono, Public_Sans } from 'next/font/google'
import './globals.css'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['600', '700'] })
const sans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', weight: ['500'] })

export const metadata: Metadata = { title: 'Mukkani CRM', description: 'Leads, trial boxes and monthly customers' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#132119' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
