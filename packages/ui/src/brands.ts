/**
 * The Pineberry group's companies, as data.
 *
 * The holdings site renders from this list, and each operating company's own
 * site pulls its palette from the same entry — so a colour is changed in one
 * place and both sites agree.
 */

export type BrandStatus = 'operating' | 'launching' | 'planned'

export interface Brand {
  /** URL-safe id, also used as the CSS theme attribute value. */
  slug: string
  name: string
  /** One line, said plainly. No mission-statement voice. */
  line: string
  /** Two or three sentences for the company's panel on the holdings site. */
  detail: string
  sector: string
  /** Where it operates from. */
  base: string
  status: BrandStatus
  /** Live site, or null when the company trades without one. */
  href: string | null
  /** What the company actually does, as short noun phrases. */
  activities: string[]
  palette: {
    ground: string
    ink: string
    accent: string
  }
}

export const BRANDS: Brand[] = [
  {
    slug: 'bf-mutare',
    name: 'BF Mutare',
    line: 'Japanese vehicle imports, delivered across Zimbabwe.',
    detail:
      'BF Mutare sources vehicles from Japan to customer order, handles shipping, port clearance and duty, and delivers to owners nationwide. It is the group’s longest-running operation and the first to take a website.',
    sector: 'Automotive',
    base: 'Mutare',
    status: 'operating',
    href: 'https://bfmutare.co.zw',
    activities: ['Vehicle sourcing', 'Import & clearing', 'Nationwide delivery'],
    palette: {
      ground: '#131210',
      ink: '#f4f1e9',
      accent: '#efc63b',
    },
  },
  {
    slug: 'muroora-mart',
    name: 'Muroora Mart',
    line: 'Retail, trading now.',
    // TODO: replace with a real description of what Muroora Mart sells.
    detail:
      'Muroora Mart is trading and does not yet have a website of its own. Details to be confirmed.',
    sector: 'Retail',
    base: 'Zimbabwe', // TODO: confirm town
    status: 'operating',
    href: null,
    activities: ['Retail'],
    palette: {
      ground: '#f6f3ec',
      ink: '#17150f',
      accent: '#2f5d46',
    },
  },
  {
    slug: 'speed-motors',
    name: 'Speed Motors',
    line: 'Motor trade, trading now.',
    // TODO: replace with a real description of what Speed Motors does.
    detail:
      'Speed Motors is trading and does not yet have a website of its own. Details to be confirmed.',
    sector: 'Automotive',
    base: 'Zimbabwe', // TODO: confirm town
    status: 'operating',
    href: null,
    activities: ['Motor trade'],
    palette: {
      ground: '#f6f3ec',
      ink: '#17150f',
      accent: '#1f4e79',
    },
  },
]

export const brandBySlug = (slug: string): Brand | undefined =>
  BRANDS.find((brand) => brand.slug === slug)

export const operatingBrands = (): Brand[] =>
  BRANDS.filter((brand) => brand.status === 'operating')
