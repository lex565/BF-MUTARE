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

  /**
   * Null, not a placeholder string.
   *
   * This was 'hello@pineberryholdings.com' and it was rendered in the footer
   * of every page as a large mailto link. That domain does not resolve, so any
   * mail sent to it bounces — a visitor who tried to make contact got silence
   * and assumed they had been ignored. A visible "not published yet" is a far
   * better outcome than an address that quietly fails.
   */
  email: null as string | null, // TODO: a real address on a domain that exists
  phoneDisplay: null as string | null, // TODO: was +263 00 000 0000

  address: {
    city: 'Mutare', // TODO: confirm — head office may be Harare
    country: 'Zimbabwe',
  },

  /** Founded year drives the "since" line. Set to null to hide it. */
  founded: null as number | null, // TODO
} as const
