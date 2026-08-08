/**
 * Pineberry Holdings — company details.
 *
 * ⚠ VALUES MARKED `TODO` ARE PLACEHOLDERS. Replace before this points at a
 *   real domain. A plausible-looking fake number is worse than an empty one
 *   because it ships without anyone noticing.
 */

export const SITE = {
  name: 'Pineberry Holdings',
  legalName: 'Pineberry Holdings', // TODO: registered entity name
  /** One sentence. A holding company should be able to say what it is. */
  summary:
    'Pineberry Holdings owns and operates a small group of businesses in Zimbabwe.',

  email: 'hello@pineberryholdings.com', // TODO
  phoneDisplay: '+263 00 000 0000', // TODO

  address: {
    city: 'Mutare', // TODO: confirm — head office may be Harare
    country: 'Zimbabwe',
  },

  /** Founded year drives the "since" line. Set to null to hide it. */
  founded: null as number | null, // TODO
} as const
