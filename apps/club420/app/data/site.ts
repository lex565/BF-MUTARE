/**
 * 420 Liquor Store — business details and content.
 *
 * SOURCE: `D:\DEV\CLUB 420\420\420.pdf`, the company's own brand document.
 * The origin story, vision, mission, values, tagline, product lines, events
 * and the legal position are all theirs, condensed but not invented.
 *
 * TWO THINGS THAT ARE NOT OPTIONAL ON THIS SITE, both from that document:
 *
 * 1. The brand explicitly reclaims "420" as a time of day — the moment work
 *    stops — and is explicit that it is NOT a cannabis outlet: "It does not
 *    endorse or associate with the sale of cannabis or illicit substances."
 *    Any design or copy that winks at the other meaning contradicts the
 *    client's own stated position and creates a legal problem for a licensed
 *    retailer. See the LEGAL block below, which is rendered on every page.
 *
 * 2. It sells alcohol. The document names responsible consumption as a core
 *    value and an 18-45 target market, so the age line and the drink-aware
 *    note are part of the brief, not decoration.
 *
 * NOT carried over from the earlier HTML draft in the same folder: three
 * invented customer testimonials, six product cards with invented USD prices,
 * and a phone number (+263 20 420 4200) that is patterned on the brand name
 * rather than being a real line.
 */

export const SITE = {
  name: '420',
  fullName: '420 Liquor Store',
  tagline: 'Time to Toast.',
  parent: 'Pineberry Holdings',
  founded: 2025,
  legalStructure: 'Private Limited Company (Pvt Ltd)',

  city: 'Mutare',
  country: 'Zimbabwe',

  /** Nobody may buy here under this age. Rendered, not just stored. */
  minimumAge: 18,

  // TODO: the brand document carries no contact details, and the earlier HTML
  // draft's number was a placeholder patterned on the brand name. Ask.
  whatsapp: null as string | null,
  phoneDisplay: null as string | null,
  email: null as string | null,
  street: null as string | null,
} as const

/**
 * The legal and positioning statement. Rendered site-wide.
 *
 * This is close to verbatim from the brand document because it is the kind of
 * sentence that should not be paraphrased by anyone other than the client.
 */
export const LEGAL = {
  licensed:
    '420 Liquor Store is fully licensed under Zimbabwean law and adheres to the guidelines of the Liquor Licensing Board.',
  notCannabis:
    'It does not endorse or associate with the sale of cannabis or any illicit substance. Here, 420 is a time of day.',
  responsible:
    'We ask customers to drink responsibly, and we will not serve anyone under 18.',
} as const

/** The origin, in the founders' own framing. */
export const STORY = {
  lead: 'It started as a joke between two friends.',
  paragraphs: [
    'Two people working together in Mutare. Every day at around twenty past four one of them would look up, chuckle, and say “Haaa, it’s 4:20 Mafia” — the signal to stop work, refresh, and just breathe for a moment.',
    'That habit turned into a way of thinking about balance: knowing when to grind, and knowing when to pause and celebrate life. The store is that pause, made into a business.',
    'The number has a wider history too. “4:20” started in San Rafael, California in the 1970s, and it is usually attached to cannabis. What carried across for us was not the substance but the spirit — freedom, celebration, and not taking the day so seriously that you never put it down.',
    'So here, 420 is a time on a clock. It is the moment to unwind, raise a glass, and appreciate the day.',
  ],
  founderQuote:
    '420 is more than a number. It’s a pause, a moment, a toast. We’re building a brand that represents that pause in Zimbabwean style: bold, tasteful, and responsibly celebratory.',
  founderAttribution: 'The founding team, 420 Liquor',
} as const

export const VISION =
  'To become Zimbabwe’s most culturally expressive and socially conscious liquor store — a brand where every bottle marks a moment to celebrate, reflect, and connect.'

export const MISSION =
  'To offer a premium retail experience rooted in Zimbabwean spirit and global lifestyle inspiration, providing carefully selected drinks while promoting responsible consumption, community engagement, and memorable shared moments.'

export const VALUES = [
  {
    title: 'Celebration',
    body: 'Every day has a 4:20. Make it count, and take a break from the hustle.',
  },
  {
    title: 'Authenticity',
    body: 'Curating real, high-quality brands that reflect heritage and taste.',
  },
  {
    title: 'Community',
    body: 'Creating social spaces and experiences that bring people together.',
  },
  {
    title: 'Respect',
    body: 'Honouring local culture, the law, and the wellbeing of our customers.',
  },
  {
    title: 'Responsibility',
    body: 'Advocating for informed and mindful drinking, every time.',
  },
] as const

/**
 * What the store sells.
 *
 * No prices. The earlier draft carried six invented USD figures, and a price
 * on a website that is wrong at the counter is worse than no price at all.
 */
export const RANGE = [
  {
    title: 'Whiskey',
    body: 'Aged stock from Scotland, Ireland, the States and closer to home.',
  },
  {
    title: 'Gin',
    body: 'Small-batch botanicals, including African-inspired profiles.',
  },
  { title: 'Vodka', body: 'Clean, cold, and the base of most of the round.' },
  { title: 'Rum', body: 'Light through to dark, for the long evenings.' },
  { title: 'Cognac', body: 'For the toast that is actually marking something.' },
  {
    title: 'Wine',
    body: 'Reds, whites and sparkling, weighted towards Southern Africa.',
  },
  {
    title: 'Zimbabwean craft',
    body: 'Local spirits and brews. The shelf we are proudest of.',
  },
  {
    title: 'Barware & merch',
    body: 'Glassware, accessories and branded pieces for the home bar.',
  },
] as const

/** Events, as the brand document lists them. */
export const EXPERIENCES = [
  {
    time: 'Every day, 16:20',
    title: 'The 4:20 happy hour',
    body: 'The ritual the whole place is named after. Work stops, the price drops, and the room fills up for an hour.',
  },
  {
    time: 'Monthly',
    title: 'Tasting nights',
    body: 'Sit down with premium spirits and somebody who can tell you what you are drinking and why it tastes like that.',
  },
  {
    time: 'Seasonal',
    title: 'Cultural evenings',
    body: 'Zimbabwean music, food and people, with the drinks as the excuse rather than the point.',
  },
  {
    time: 'Ongoing',
    title: 'The loyalty club',
    body: 'Rewards on what you already buy, birthday perks, and first sight of the deals.',
  },
] as const
