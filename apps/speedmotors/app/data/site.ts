/**
 * Speed Motor Engineering — business details and content.
 *
 * SOURCE: `D:\DEV\Speed Motors\Website and Promts\Speed Motors FINAL SITE.txt`,
 * the company's previous site. The services and the 1996 founding date are
 * theirs.
 *
 * NOT carried over from that file, deliberately:
 *   - The team section. It listed "John Doe", "Jane Smith", "Mike Williams"
 *     and "Emily Rodriguez" against generic avatar icons. Those are template
 *     placeholders, not employees, and putting them on a live site would be
 *     inventing four people.
 *   - The WhatsApp link, which pointed at the literal string YOURPHONENUMBER.
 *   - The hero video, a 27MB stock clip of somebody else's workshop.
 */

export const SITE = {
  name: 'Speed Motors',
  fullName: 'Speed Motor Engineering',
  tagline: 'Expert service for every ride.',
  parent: 'Pineberry Holdings',
  founded: 1996,

  country: 'Zimbabwe',
  // TODO: the previous site never stated a town or an address. Confirm.
  city: null as string | null,
  street: null as string | null,

  // TODO: all missing. The old site's WhatsApp link was "YOURPHONENUMBER".
  whatsapp: null as string | null,
  phoneDisplay: null as string | null,
  email: null as string | null,
} as const

/** Years trading, computed rather than written down so it never goes stale. */
export const yearsTrading = (): number =>
  new Date().getFullYear() - SITE.founded

/**
 * The seven services, in the company's own words.
 *
 * Ordered by what the shop is known for rather than alphabetically: the engine
 * and gearbox work leads because that is the job people drive across town for,
 * and general servicing sits last because every garage does it.
 */
export interface Service {
  title: string
  body: string
}

export const SERVICES: Service[] = [
  {
    title: 'Engine & gearbox overhaul',
    body: 'Complete engine and transmission rebuilds, using proper equipment and proper measurement rather than guesswork.',
  },
  {
    title: 'Suspension systems',
    body: 'Suspension repair and maintenance for ride comfort and handling — which on most roads here is not a luxury item.',
  },
  {
    title: 'Brake services',
    body: 'Full brake system inspection, repair and replacement. The one job nobody should be shopping around on price for.',
  },
  {
    title: 'Clutch systems',
    body: 'Clutch repair and replacement for manual vehicles of any make and model.',
  },
  {
    title: 'Hybrid solutions',
    body: 'Service and repair for hybrid vehicles, covering both the electric side and the petrol engine.',
  },
  {
    title: 'Tune-ups',
    body: 'Getting an engine back to running the way it is supposed to, rather than the way it has drifted into.',
  },
  {
    title: 'General service',
    body: 'Routine maintenance and the ordinary jobs that keep a car out of the workshop for the bigger ones.',
  },
]

/**
 * Why bring a car here rather than anywhere else.
 *
 * The old site had a generic "Why Choose Us" with warranty and satisfaction
 * boilerplate. This is rewritten around the one thing that is actually
 * distinctive and verifiable: the shop has been doing this since 1996.
 */
export const REASONS = [
  {
    title: 'Nearly thirty years of it',
    body: 'Trading since 1996. Long enough to have seen the fault before, and long enough that the diagnosis is not a guess billed by the hour.',
  },
  {
    title: 'Engine work is the core',
    body: 'Plenty of places will do a service. Fewer will take the head off and do it properly. This shop is built around the heavy jobs.',
  },
  {
    title: 'You get told what is wrong',
    body: 'What the fault is, what it takes to fix it, and what it will cost — before the spanners come out, not after.',
  },
]
