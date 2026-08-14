/**
 * Muroora Mart — business details and content.
 *
 * SOURCE: `D:\DEV\Muroora_Mart\Muroora_Mart_Company_Profile.pdf`, the
 * company's own 2025 profile. Mission, vision, values, product lines, the
 * diaspora programme and the payment ecosystem are all theirs, condensed but
 * not invented.
 *
 * What is NOT in that document, and is therefore null here rather than
 * guessed: a phone number, a WhatsApp number, an email address and a street
 * address. The profile gives the city and nothing more granular.
 */

export const SITE = {
  name: 'Muroora Mart',
  tagline: 'Quality goods, great value.',
  parent: 'Pineberry Holdings',
  founded: 2025,

  /**
   * The name's meaning, in the company's own words. Worth carrying because it
   * explains the whole positioning: the business is the relative who provides.
   */
  nameMeaning:
    'From the Shona word muroora — the family member who supports and provides for the household.',

  city: 'Mutare',
  country: 'Zimbabwe',

  // TODO: all four are missing from the company profile. Ask before launch.
  whatsapp: null as string | null,
  phoneDisplay: null as string | null,
  email: null as string | null,
  street: null as string | null,
} as const

/** The three principles the profile says guide every business decision. */
export const PRINCIPLES = [
  {
    title: 'Accessibility',
    body: 'Making daily necessities available quickly, conveniently, and without geographic constraint for Mutare residents.',
  },
  {
    title: 'Affordability',
    body: 'Sustaining competitive pricing on essential goods to serve households across all income brackets.',
  },
  {
    title: 'Community support',
    body: 'Strengthening transnational family bonds by enabling diaspora-supported household provisioning.',
  },
] as const

/** What is actually on the shelves. */
export const CATEGORIES = [
  {
    title: 'Basic groceries',
    body: 'Maize meal, cooking oil, sugar, salt, rice, flour and legumes.',
  },
  {
    title: 'Packaged food & drink',
    body: 'Canned goods, juices, soft drinks and snack items.',
  },
  {
    title: 'Cleaning supplies',
    body: 'Detergents, disinfectants and surface cleaners.',
  },
  {
    title: 'Personal hygiene',
    body: 'Soaps, shampoos, toothpaste and sanitary items.',
  },
  {
    title: 'Kitchen supplies',
    body: 'Cookware, utensils and storage containers.',
  },
  {
    title: 'Daily-use items',
    body: 'Batteries, candles, light bulbs and miscellaneous consumables.',
  },
] as const

/**
 * The diaspora programme, step by step.
 *
 * This is the company's strongest differentiator and the reason the site
 * exists, so it gets its own page rather than a paragraph. The point it makes
 * is economic: a remittance can lose value to exchange rates, fees and
 * withdrawal liquidity between sender and shelf. Buying the goods directly
 * removes that gap.
 */
export const DIASPORA_STEPS = [
  {
    action: 'Browse the catalogue',
    detail: 'A relative abroad selects goods from the live inventory online.',
  },
  {
    action: 'Confirm the order',
    detail: 'Order summary and the Mutare delivery address are confirmed.',
  },
  {
    action: 'Pay',
    detail: 'Payment is processed through an internationally compatible gateway.',
  },
  {
    action: 'We pick and pack',
    detail: 'The order is picked and packaged at the Mutare store.',
  },
  {
    action: 'We deliver',
    detail: 'The goods go directly to the recipient household in Mutare.',
  },
  {
    action: 'Both of you are told',
    detail: 'Delivery confirmation is sent to the sender and the recipient.',
  },
] as const

/** Payment rails. `live: false` renders as "coming", never as available. */
export const PAYMENTS = [
  {
    name: 'EcoCash',
    detail: 'Zimbabwe’s dominant mobile money platform.',
    live: true,
  },
  {
    name: 'InnBucks',
    detail: 'Digital wallet accepted across major Zimbabwean retailers.',
    live: true,
  },
  {
    name: 'Alipay',
    detail: 'For the Chinese diaspora. Integration in progress.',
    live: false,
  },
  {
    name: 'WeChat Pay',
    detail: 'Cross-border payments from China. Integration in progress.',
    live: false,
  },
] as const

/** Who it is for, from the profile's market segmentation. */
export const SEGMENTS = [
  {
    title: 'Local households',
    body: 'Families in Mutare who need regular access to groceries and consumables. The primary customer.',
  },
  {
    title: 'Busy professionals',
    body: 'Working adults who would rather order online than walk a shop floor, and who want a scheduled delivery window.',
  },
  {
    title: 'Diaspora families',
    body: 'Zimbabweans abroad keeping a household here provisioned, without sending cash and hoping.',
  },
  {
    title: 'Institutional buyers',
    body: 'Small offices, guesthouses and community organisations buying household and cleaning supplies in bulk.',
  },
] as const
