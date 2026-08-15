/**
 * The Pineberry group's companies, as data.
 *
 * This is the single source of truth for the group. The holdings site renders
 * its register from this list, each operating company's own site pulls its
 * palette and its sister-company links from the same entry, and the group bar
 * at the top of every site is generated from it. A company is added here once
 * and appears everywhere.
 *
 * Everything below comes from each company's own profile document, not from
 * guesswork:
 *   - Muroora Mart  → Muroora_Mart_Company_Profile.pdf
 *   - 420           → CLUB 420/420/420.pdf
 *   - Speed Motors  → Website and Promts/Speed Motors FINAL SITE.txt
 *   - BF Mutare     → the 2.0 build, see apps/bfmutare/app/data/site.ts
 */

export type BrandStatus = 'operating' | 'launching' | 'planned'

export interface Brand {
  /** URL-safe id, also used as the CSS theme attribute value. */
  slug: string
  name: string
  /** The legal or full trading name, when it differs from the short one. */
  fullName?: string
  /** One line, said plainly. No mission-statement voice. */
  line: string
  /** Two or three sentences for the company's panel on the holdings site. */
  detail: string
  sector: string
  /** Where it operates from. */
  base: string
  status: BrandStatus
  /** Year founded, when confirmed. Null rather than guessed. */
  founded: number | null
  /**
   * Production URL. Null until the site is actually deployed and reachable —
   * a link in a group bar that 404s is worse than no link, and these get sent
   * to colleagues.
   */
  href: string | null
  /**
   * Local dev port, so the group bar cross-links work while the sites are
   * still being built. Production `href` wins when it exists.
   */
  devPort: number
  /** What the company actually does, as short noun phrases. */
  activities: string[]
  /**
   * Path to the company's logo as served by the HOLDINGS site
   * (`apps/pineberry/public/logos/…`), or null where no artwork exists yet.
   * Null is a real state here, not an oversight: 420's brand document
   * describes a logo — a clock frozen at 4:20 stylised into a bottle — that
   * has never been drawn, so its register entry sets the name as type instead
   * of showing a placeholder box.
   */
  logo: string | null
  palette: {
    ground: string
    ink: string
    accent: string
    /** Secondary signal colour, where the brand has one. */
    support?: string
  }
}

export const BRANDS: Brand[] = [
  {
    slug: 'bf-mutare',
    name: 'BF Mutare',
    line: 'Vehicle imports, delivered across Zimbabwe.',
    detail:
      'BF Mutare sources vehicles overseas to customer order, handles shipping, port clearance and duty, and delivers to owners nationwide. Based in Mutare, operating right around Zimbabwe. It is the group’s longest-running operation and the first to take a website.',
    sector: 'Automotive',
    base: 'Mutare',
    status: 'operating',
    founded: null, // TODO: confirm. 2.0 footers said 2023 in one file, 2025 in another.
    href: 'https://bf-mutare.vercel.app',
    devPort: 3001,
    activities: ['Vehicle sourcing', 'Import & clearing', 'Nationwide delivery'],
    logo: '/logos/bf-mutare.svg',
    palette: {
      ground: '#131210',
      ink: '#f4f1e9',
      accent: '#efc63b', // number-plate yellow
      support: '#d56422', // the logo's orange
    },
  },
  {
    slug: 'muroora-mart',
    name: 'Muroora Mart',
    line: 'Quality goods, great value — delivered in Mutare.',
    detail:
      'A neighbourhood retailer with an online catalogue and same-day delivery across Mutare. Its Diaspora Shopping Programme lets a relative abroad buy the actual groceries and have them delivered to a household here, which turns a remittance into goods rather than into an exchange-rate problem.',
    sector: 'Retail',
    base: 'Mutare',
    status: 'operating',
    founded: 2025,
    href: 'https://muroora-mart.vercel.app',
    devPort: 3002,
    activities: ['Grocery & household', 'Local delivery', 'Diaspora shopping'],
    logo: '/logos/muroora-mart.png',
    palette: {
      ground: '#f7f5ef',
      ink: '#12271b',
      accent: '#f25c13', // sampled from the logo artwork
      support: '#005029', // the logo's deep green
    },
  },
  {
    slug: 'speed-motors',
    name: 'Speed Motors',
    fullName: 'Speed Motor Engineering',
    line: 'Engine, gearbox and suspension work. Since 1996.',
    detail:
      'A working repair shop rather than a parts counter: engine and gearbox overhauls, suspension, brakes, clutches, tune-ups and hybrid systems. It is the oldest business in the group by some distance, and the one people bring a car to when someone else could not fix it.',
    sector: 'Automotive',
    base: 'Zimbabwe', // TODO: confirm the town
    status: 'operating',
    founded: 1996,
    href: 'https://speed-motors-tan.vercel.app',
    devPort: 3003,
    activities: ['Engine & gearbox', 'Suspension & brakes', 'Hybrid systems'],
    logo: '/logos/speed-motors.png',
    palette: {
      ground: '#f1f0ee',
      ink: '#141414', // the logo is pure black, so the ground stays light
      accent: '#1f4e79', // workshop blue, kept clear of BF's yellow
      support: '#c2410c',
    },
  },
  {
    slug: 'club-420',
    name: '420',
    fullName: '420 Liquor Store',
    line: 'Time to Toast.',
    detail:
      'A licensed liquor store in Mutare built around a daily ritual: at 4:20 the work stops and you pour one. Premium spirits and Zimbabwean craft alongside tasting nights and cultural evenings. It reclaims “420” as a moment to pause — the brand is explicit that it is not a cannabis outlet.',
    sector: 'Retail & lifestyle',
    base: 'Mutare',
    status: 'operating',
    founded: 2025,
    href: 'https://club-420.vercel.app',
    devPort: 3004,
    activities: ['Liquor retail', 'Tasting nights', 'Loyalty club'],
    /* No artwork exists. The brand document describes a clock frozen at 4:20
       stylised into a bottle silhouette, but it has never been drawn. */
    logo: null,
    palette: {
      ground: '#0f100d', // matte black
      ink: '#f0ebdd',
      accent: '#c9a227', // warm gold
      support: '#1e5233', // deep green
    },
  },
]

export const brandBySlug = (slug: string): Brand | undefined =>
  BRANDS.find((brand) => brand.slug === slug)

export const operatingBrands = (): Brand[] =>
  BRANDS.filter((brand) => brand.status === 'operating')

/**
 * Where to link a company right now.
 *
 * Production URL if it has one, otherwise its local dev server — so the group
 * bar is clickable while the sites are still being built, and needs no code
 * change once the real domains are set on the records above.
 */
export const brandHref = (brand: Brand): string =>
  brand.href ?? `http://localhost:${brand.devPort}`

/** The parent. Kept here so every site links back to the same place. */
export const PARENT = {
  name: 'Pineberry Holdings',
  href: 'https://pineberry.vercel.app' as string | null, // TODO: swap for pineberryholdings.com once DNS points here
  devPort: 3000,
  line: 'A small group of real businesses in Zimbabwe.',
} as const

export const parentHref = (): string =>
  PARENT.href ?? `http://localhost:${PARENT.devPort}`
