import type { Metadata } from 'next'
import { Figtree, IBM_Plex_Mono } from 'next/font/google'
import { siteUrl } from '@pineberry/ui'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
import { StaffBar } from '@/app/components/StaffBar'
import { IdleGuard } from '@/app/components/IdleGuard'
import { RecoveryRedirect } from '@/app/components/RecoveryRedirect'
import './globals.css'

/* Figtree rather than the group's Archivo: it is rounder and reads friendlier
   at the same weight, which is what a neighbourhood grocer wants and what a
   car importer does not. The structural tokens are still shared, so the family
   resemblance holds. */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Musuwo - local businesses, products and services',
    template: '%s - Musuwo',
  },
  description:
    'Discover local businesses, products, food, accommodation and services through Musuwo. Muroora Mart is the founding merchant.',
  /* Without this, Next resolves Open Graph and canonical URLs against
     localhost at build time. Read from the shared brand record. */
  metadataBase: new URL(siteUrl('muroora-mart')),
  keywords: [
    'groceries Mutare',
    'grocery delivery Zimbabwe',
    'diaspora shopping Zimbabwe',
    'send groceries to Zimbabwe',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'Musuwo',
    title: 'Musuwo - your gateway to local businesses',
    description:
      'Groceries and household goods in Mutare, with same-day delivery and a diaspora shopping service.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZW"
      className={`${figtree.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        {/* Renders nothing at all unless a staff member is signed in, so the
            customer-facing design is unaffected. */}
        <StaffBar />
        {/* Signs out after 30 minutes idle. Renders nothing when signed out. */}
        <IdleGuard />
        {/* Carries a password-reset fragment to the page that reads it. */}
        <RecoveryRedirect />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
