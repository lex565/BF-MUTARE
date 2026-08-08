import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
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
    default: 'BF Mutare — Japanese vehicle imports, Zimbabwe',
    template: '%s — BF Mutare',
  },
  description:
    'BF Mutare imports vehicles from Japan to order and delivers them to owners across Zimbabwe. Spread the cost over up to 24 months.',
  // TODO: confirm the domain. The old codebase used bfmutare.co.zw.
  metadataBase: new URL('https://bfmutare.co.zw'),
  keywords: [
    'car import Zimbabwe',
    'Japanese cars Zimbabwe',
    'vehicle import Mutare',
    'buy car Mutare',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'BF Mutare',
    title: 'BF Mutare — Japanese vehicle imports, Zimbabwe',
    description:
      'We import vehicles from Japan and deliver them to owners across Zimbabwe. Up to 24 months to pay.',
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
