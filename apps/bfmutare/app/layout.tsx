import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import { siteUrl } from '@pineberry/ui'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
import './globals.css'

/* Archivo's width axis is exposed so headlines can run expanded without
   pulling in a second display family. */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
})

/* Mono is not decoration here — it sets the spec blocks on car cards, which is
   what makes them read as stock listings rather than product tiles. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'BF Mutare — vehicle imports, Zimbabwe',
    template: '%s — BF Mutare',
  },
  description:
    'BF Mutare imports vehicles to order and delivers them to owners across Zimbabwe. Based in Mutare, operating countrywide. Spread the cost over up to 24 months.',
  /* Read from the shared brand record rather than hardcoded. This was
     https://bfmutare.co.zw, a domain that does not resolve — which meant every
     canonical URL and every Open Graph image path on the site pointed at
     nothing. */
  metadataBase: new URL(siteUrl('bf-mutare')),
  keywords: [
    'car import Zimbabwe',
    'vehicle import Mutare',
    'car dealer Mutare',
    'buy car Zimbabwe',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'BF Mutare',
    title: 'BF Mutare — vehicle imports, Zimbabwe',
    description:
      'We import vehicles to order and deliver them to owners across Zimbabwe. Based in Mutare, operating countrywide. Up to 24 months to pay.',
    // TODO: an OG image. It must be a PNG or JPG at 1200x630 — Facebook,
    // WhatsApp and X all ignore SVG, so the logo file cannot be used here.
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZW" className={`${archivo.variable} ${plexMono.variable}`}>
      {/* Nav and footer live in the layout so they persist across route
          changes — the pages are separate, the furniture is not. */}
      <body className="flex min-h-dvh flex-col">
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
