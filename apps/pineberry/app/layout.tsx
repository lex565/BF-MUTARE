import type { Metadata } from 'next'
import { Fraunces, Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

/* Fraunces with its optical-size, softness and "wonk" axes exposed. The wonk
   axis is what gives the headlines their slightly off-normal character — it is
   the reason this is Fraunces and not another serif. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
})

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Pineberry Holdings',
    template: '%s — Pineberry Holdings',
  },
  description:
    'Pineberry Holdings is a Zimbabwean holding company. We own and operate a small group of businesses, including BF Mutare and Muroora Mart.',
  metadataBase: new URL('https://pineberryholdings.com'),
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: 'Pineberry Holdings',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZW"
      className={`${fraunces.variable} ${schibsted.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
