/**
 * Business details for BF Mutare.
 *
 * SOURCE: recovered from the 2.0 build in
 * `D:\DEV\Website\BF MUTARE 2.0\` — specifically
 * `BF MUTARE CURRENTLY WORKING SITE.txt` and `BF MUTARE BASE 2.0.txt`.
 * Those two files were written a week apart and agree on every value below,
 * which is why these are treated as confirmed rather than as placeholders.
 *
 * This replaces the earlier placeholder set, where the contact number was
 * 263123456789 — literally the digits 1 to 9.
 *
 * The WhatsApp number is full international form with no punctuation:
 * 077 485 0107 becomes 263774850107.
 */

export const SITE = {
  name: 'BF Mutare',
  legalName: 'BF Mutare', // TODO: registered company name, if it differs
  parent: 'Pineberry Holdings',
  /* Not "Japanese vehicle imports" — the client sources from more than Japan,
     so naming one country understates the business and is a claim that is not
     true. Kept country-neutral until they say which markets to name. */
  tagline: 'Vehicle imports, delivered across Zimbabwe.',

  whatsapp: '263774850107',
  /**
   * WhatsApp's own short link for the business account. Kept because it is
   * what is printed on the Facebook and Instagram profiles, so it is the link
   * customers may already have saved. `whatsappLink()` below uses the number
   * instead, because a number accepts a pre-filled message reliably.
   */
  whatsappShortLink: 'https://wa.me/message/KOBL2NSXHUMAL1',
  phoneDisplay: '+263 774 850 107',
  email: 'bfmutare@gmail.com',

  address: {
    street: 'Suite 6C, Belmont Building, 2nd Avenue & Second Street',
    city: 'Mutare',
    country: 'Zimbabwe',
  },

  /** Office coordinates, carried over from the 2.0 map marker. */
  coords: { lat: -18.973351, lng: 32.670067 },

  hours: [
    { days: 'Monday – Friday', time: '09:00 – 17:00' },
    { days: 'Saturday', time: '09:00 – 13:00' },
    { days: 'Sunday', time: 'Closed' },
  ],

  social: {
    facebook: 'https://www.facebook.com/share/1Ai3JN7Lrd/',
    instagram: 'https://www.instagram.com/beforward_mutare',
    tiktok: 'https://www.tiktok.com/@beforward_mutare',
  },

  /**
   * The Be Forward stock list the 2.0 hero pointed at, which is where the name
   * and the @beforward_mutare handles come from. It is ONE of the sources, not
   * the only one — the site copy is deliberately country-neutral. Left as a
   * live link rather than rebuilt locally: their stock changes daily and no
   * copy of it here could keep up.
   */
  inventoryUrl: 'https://www.beforward.jp/stocklist/',
} as const

/**
 * The payment plan — the single strongest hook on the site.
 *
 * The headline is confirmed: "up to 24 months to pay" ran on the 2.0 hero.
 * The small print under it is NOT confirmed, and advertising credit terms is a
 * claim you can be held to, so anything still null simply does not render.
 */
export const FINANCE = {
  headline: '24 months to pay',
  support: 'Spread the cost of your import over up to two years.',
  depositFrom: null as string | null, // TODO e.g. '30% deposit'
  eligibility: null as string | null, // TODO e.g. 'Subject to approval'
  /** Set true once deposit and eligibility above are confirmed. */
  confirmed: false, // TODO
} as const

/**
 * Headline figures.
 *
 * Still null, still hidden rather than guessed. The 2.0 build carried no
 * counts either, so there was nothing to recover. The company has traded for
 * years without a website, so an invented figure would almost certainly
 * undersell it.
 */
export const STATS = {
  totalDelivered: null as number | null, // TODO — vehicles delivered to date
  deliveredThisMonth: null as number | null, // TODO — refreshed monthly
  operatingSince: null as number | null, // TODO — 2.0 footer said 2023, earlier draft said 2025
} as const

/** Pre-fills the WhatsApp message so enquiries arrive with context attached. */
export const whatsappLink = (about?: string) => {
  const message = about
    ? `Hi BF Mutare, I'm interested in importing a ${about}. Could you quote me?`
    : "Hi BF Mutare, I'd like to ask about importing a vehicle."
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`
}

/** Google Maps link for the office. Cheaper than shipping a map library. */
export const mapLink = `https://www.google.com/maps/search/?api=1&query=${SITE.coords.lat},${SITE.coords.lng}`
