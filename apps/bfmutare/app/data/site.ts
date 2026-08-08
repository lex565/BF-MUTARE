/**
 * Business details for BF Mutare.
 *
 * ⚠ EVERY VALUE MARKED `TODO` IS A PLACEHOLDER AND MUST BE REPLACED BEFORE
 *   THIS SITE POINTS AT A DOMAIN. They are wrong on purpose — a plausible but
 *   fake phone number is worse than an obviously empty one, because it ships
 *   silently.
 *
 * Nothing usable was recoverable from the previous codebase: its "contact
 * number" was 263123456789, which is literally the digits 1 to 9.
 *
 * The WhatsApp number must be full international form with no punctuation:
 * Zimbabwe 077 123 4567 becomes 263771234567.
 */

export const SITE = {
  name: 'BF Mutare',
  legalName: 'BF Mutare', // TODO: registered company name
  parent: 'Pineberry Holdings',
  tagline: 'Japanese vehicle imports, delivered across Zimbabwe.',

  whatsapp: '263000000000', // TODO
  phoneDisplay: '+263 00 000 0000', // TODO
  // The old code used bfmutare.co.zw — confirm which domain you actually hold.
  email: 'info@bfmutare.co.zw', // TODO

  address: {
    street: 'TODO — street address',
    city: 'Mutare',
    country: 'Zimbabwe',
  },

  hours: [
    { days: 'Monday – Friday', time: '08:00 – 17:00' }, // TODO: confirm
    { days: 'Saturday', time: '08:00 – 13:00' }, // TODO: confirm
    { days: 'Sunday', time: 'By appointment' }, // TODO: confirm
  ],

  social: {
    facebook: null as string | null, // TODO
    instagram: null as string | null, // TODO
  },
} as const

/**
 * The payment plan — the single strongest hook on the site.
 *
 * ⚠ CONFIRM THE TERMS BEFORE LAUNCH. Advertising credit terms is a claim you
 *   can be held to. `headline` is what appears in the ribbon and hero; the
 *   fields under it are the small print that has to be true. Anything left
 *   null simply does not render, so an unconfirmed detail is omitted rather
 *   than guessed.
 */
export const FINANCE = {
  headline: '24 months to pay',
  /** Short supporting line used next to the headline. */
  support: 'Spread the cost of your import over up to two years.',
  depositFrom: null as string | null, // TODO e.g. '30% deposit'
  /** Keep vague only if it genuinely is; buyers will ask immediately. */
  eligibility: null as string | null, // TODO e.g. 'Subject to approval'
  /** Set true once the terms above are confirmed and signed off. */
  confirmed: false, // TODO
} as const

/**
 * Headline figures.
 *
 * `totalDelivered` is the number that carries the most weight on the whole
 * site, and it is the one thing I must not guess. The company has been running
 * for years without a website, so a made-up figure would almost certainly
 * undersell it — and an invented one that undersells is worse than no figure.
 *
 * Set `totalDelivered` to null and the stat is hidden entirely rather than
 * showing a placeholder. Fill it in and it appears.
 */
export const STATS = {
  totalDelivered: null as number | null, // TODO — vehicles delivered to date
  deliveredThisMonth: null as number | null, // TODO — refreshed monthly
  /** Set once you want a "trading since" line. */
  operatingSince: null as number | null, // TODO — the old site said 2020, unconfirmed
} as const

/** Pre-fills the WhatsApp message so enquiries arrive with context attached. */
export const whatsappLink = (about?: string) => {
  const message = about
    ? `Hi BF Mutare, I'm interested in importing a ${about}. Could you quote me?`
    : "Hi BF Mutare, I'd like to ask about importing a vehicle."
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`
}
