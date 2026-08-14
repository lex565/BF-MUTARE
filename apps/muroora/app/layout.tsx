import type { Metadata } from 'next'
import { Figtree, IBM_Plex_Mono } from 'next/font/google'
import { GroupBar } from '@pineberry/ui'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
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
    default: 'Muroora Mart — groceries and household goods, Mutare',
    template: '%s — Muroora Mart',
  },
  description:
    'Groceries and household goods in Mutare, with same-day local delivery and a diaspora shopping service that lets family abroad buy the goods directly.',
  keywords: [
    'groceries Mutare',
    'grocery delivery Zimbabwe',
    'diaspora shopping Zimbabwe',
    'send groceries to Zimbabwe',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'Muroora Mart',
    title: 'Muroora Mart — quality goods, great value',
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
        {/* One link back to the parent, above this site's own nav on every
            page. It deliberately does not list the sister companies — see
            packages/ui/src/GroupBar.tsx for why. */}
        <GroupBar />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
