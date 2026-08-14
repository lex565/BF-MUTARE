import type { Metadata } from 'next'
import { Bebas_Neue, Figtree, IBM_Plex_Mono } from 'next/font/google'
import { GroupBar } from '@pineberry/ui'
import { Nav } from '@/app/components/Nav'
import { Footer } from '@/app/components/Footer'
import './globals.css'

/* A condensed display face for the headlines — it is the closest thing in a
   web-safe library to the bold, stacked lettering the brand document's
   "Afro-urban fusion" aesthetic calls for, and it lets a headline run large
   without eating the page. Body copy stays in a humanist sans so long text
   is still comfortable. */
const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
})

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
    default: '420 Liquor Store — Time to Toast | Mutare, Zimbabwe',
    template: '%s — 420 Liquor Store',
  },
  description:
    'A licensed liquor store in Mutare built around the 4:20 pause. Premium spirits, wine and Zimbabwean craft, plus tasting nights and cultural evenings. Over 18s only.',
  keywords: [
    'liquor store Mutare',
    'bottle store Zimbabwe',
    'whiskey Mutare',
    'Zimbabwean craft spirits',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    siteName: '420 Liquor Store',
    title: '420 Liquor Store — Time to Toast',
    description:
      'A licensed liquor store in Mutare built around the 4:20 pause. Over 18s only.',
  },
  robots: { index: true, follow: true },
  other: {
    /* Standard signal to content filters that this page sells alcohol. Cheap
       to add, and the right thing for a licensed retailer. */
    rating: 'adult',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZW"
      className={`${bebas.variable} ${figtree.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <GroupBar />
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
