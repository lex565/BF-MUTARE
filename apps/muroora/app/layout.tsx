import type { Metadata } from 'next'
import { Figtree, IBM_Plex_Mono } from 'next/font/google'
import { siteUrl } from '@pineberry/ui'
import { brand } from '@/lib/brand'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
import { StaffBar } from '@/app/components/StaffBar'
import { IdleGuard } from '@/app/components/IdleGuard'
import { RecoveryRedirect } from '@/app/components/RecoveryRedirect'
import { BetaBanner } from '@/app/components/BetaBanner'
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

/* Musuwo and Muroora Mart are separate websites from one codebase, so the
   title, description and site name follow whichever this deployment is. Two
   sites sharing one set of Open Graph tags would have every Muroora link
   preview as Musuwo when shared on WhatsApp, which is where most of these
   links are actually sent. See lib/brand.ts. */
export const metadata: Metadata = {
  title: {
    default: `${brand.name} - ${brand.tagline}`,
    template: `%s - ${brand.name}`,
  },
  description: brand.description,
  /* Without this, Next resolves Open Graph and canonical URLs against
     localhost at build time. NEXT_PUBLIC_SITE_URL is set per deployment so
     each site canonicalises to its own domain; the group record is the
     fallback. */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? siteUrl('muroora-mart'),
  ),
  keywords: [
    'groceries Mutare',
    'grocery delivery Zimbabwe',
    'diaspora shopping Zimbabwe',
    'send groceries to Zimbabwe',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: brand.name,
    title: `${brand.name} - ${brand.tagline}`,
    description: brand.description,
  },
  robots: { index: true, follow: true },
  /**
   * Per brand, because app/icon.png is one file for the whole application and
   * this application is two websites. See lib/brand.ts.
   */
  icons: {
    icon: [{ url: brand.icon, type: 'image/png' }],
    apple: [{ url: brand.appleIcon, sizes: '180x180', type: 'image/png' }],
  },
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
        {/* Renders nothing once dismissed, and nothing on /beta itself. */}
        <BetaBanner />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
