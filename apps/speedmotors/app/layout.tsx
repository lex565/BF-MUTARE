import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import { GroupBar } from '@pineberry/ui'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
})

/* Mono does real work on this site: it sets the service list and the spec
   rows, which is what makes them read as a workshop's paperwork. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Speed Motor Engineering — engine, gearbox and suspension work',
    template: '%s — Speed Motor Engineering',
  },
  description:
    'Engine and gearbox overhauls, suspension, brakes, clutches and hybrid systems. A working repair shop in Zimbabwe, trading since 1996.',
  keywords: [
    'engine overhaul Zimbabwe',
    'gearbox repair Zimbabwe',
    'car mechanic Zimbabwe',
    'suspension repair',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'Speed Motor Engineering',
    title: 'Speed Motor Engineering — since 1996',
    description:
      'Engine and gearbox overhauls, suspension, brakes, clutches and hybrid systems.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZW" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <GroupBar />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
