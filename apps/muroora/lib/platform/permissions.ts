/**
 * What a Musuwo Super Admin can be granted.
 *
 * THE LIST IS HERE, NOT IN THE DATABASE, ON PURPOSE. It grows every time a
 * feature lands, and a permission that does not exist yet should not need a
 * migration to name. The column is text; this file is what makes an arbitrary
 * string impossible to grant, because every write goes through `isPermission`
 * and an unknown value is refused rather than stored.
 *
 * THE RULE THAT MAKES THIS WORTH HAVING: holding SUPER_ADMIN opens the door
 * and nothing else. A new admin with no rows can look at the Control Center
 * and change nothing in it. Every sensitive action names the permission it
 * needs, on the server, before it does anything.
 *
 * The Platform Owner is deliberately absent from this system. They are allowed
 * everything by being the owner, decided in one place in lib/platform/auth.ts.
 * Giving them eighteen rows instead would mean somebody could one day revoke
 * one and lock the owner out of their own platform.
 */

export const PLATFORM_PERMISSIONS = {
  /* ------------------------------------------------- business applications */
  'business_applications.review':
    'Open applications and read them, including internal notes.',
  'business_applications.approve':
    'Approve an application, which creates a live business.',
  'business_applications.reject': 'Reject an application, with a reason.',

  /* ------------------------------------------------------------ businesses */
  'businesses.view': 'See the platform-wide business directory.',
  'businesses.pause': 'Temporarily take a business out of public view.',
  'businesses.suspend':
    'Suspend a business. Higher consequence than pausing and separately granted.',
  /**
   * Separate from approving. Approving says "you may trade here"; verifying
   * says "we have seen your licence", and a customer relies on the second in a
   * way they do not on the first. It should be possible to let somebody
   * onboard businesses without letting them vouch for one.
   */
  'businesses.verify':
    'Record that a business licence has been seen, which shows customers a Verified badge.',

  /* --------------------------------------------------------- accommodation */
  'accommodation.review': 'Review accommodation operators and properties.',
  'accommodation.verify': 'Mark an accommodation property as verified.',

  /* -------------------------------------------------------------- listings */
  'listings.moderate': 'Hide or restore individual listings and products.',

  /* ------------------------------------------------------ reports & safety */
  'reports.review': 'Read safety reports and complaints.',
  'cases.manage': 'Change the status of a safety case and record its outcome.',

  /* ------------------------------------------------------------- analytics */
  'analytics.view': 'See marketplace analytics.',
  'search_monitor.view':
    'See search demand, zero-result queries and ranking behaviour. Read only.',
  'ranking_monitor.view':
    'Inspect why a query ranked the way it did. Does not permit changing it.',
  'delivery_monitor.view': 'Monitor deliveries, handovers and incidents.',

  /* ------------------------------------------------------------- messaging */
  'business_messages.send': 'Send platform messages to businesses.',

  /* ------------------------------------------------------------- sensitive */
  /**
   * Separate from everything else, and it should stay hard to get. This is
   * national ID documents and business registration certificates belonging to
   * real people. Every view is written to the platform audit log with the
   * document and the viewer named.
   */
  'sensitive_documents.view':
    'Open verification documents. Every view is logged against your name.',
} as const

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(
  PLATFORM_PERMISSIONS,
) as PlatformPermission[]

/** Is this string one we actually recognise? Guards every write. */
export function isPermission(value: string): value is PlatformPermission {
  return Object.prototype.hasOwnProperty.call(PLATFORM_PERMISSIONS, value)
}

/**
 * A sensible opening set for a new reviewer.
 *
 * Read, review and request information - everything needed to be useful on day
 * one, and nothing that changes a business's fate. Approving, rejecting,
 * suspending and opening identity documents are all deliberately absent and
 * have to be granted one at a time by the owner, who then has to think about
 * each one.
 */
export const DEFAULT_REVIEWER_PERMISSIONS: PlatformPermission[] = [
  'business_applications.review',
  'businesses.view',
  'analytics.view',
]

/**
 * Permissions grouped for the owner's permission editor, so the screen reads
 * as decisions rather than as eighteen checkboxes in a column.
 */
export const PERMISSION_GROUPS: {
  label: string
  note?: string
  permissions: PlatformPermission[]
}[] = [
  {
    label: 'Business applications',
    permissions: [
      'business_applications.review',
      'business_applications.approve',
      'business_applications.reject',
    ],
  },
  {
    label: 'Businesses',
    permissions: [
      'businesses.view',
      'businesses.verify',
      'businesses.pause',
      'businesses.suspend',
    ],
  },
  {
    label: 'Accommodation',
    permissions: ['accommodation.review', 'accommodation.verify'],
  },
  {
    label: 'Listings and safety',
    permissions: ['listings.moderate', 'reports.review', 'cases.manage'],
  },
  {
    label: 'Monitoring',
    note: 'All read only. None of these permit changing anything.',
    permissions: [
      'analytics.view',
      'search_monitor.view',
      'ranking_monitor.view',
      'delivery_monitor.view',
    ],
  },
  {
    label: 'Communication',
    permissions: ['business_messages.send'],
  },
  {
    label: 'Sensitive',
    note: 'Identity documents belonging to real people. Every view is logged.',
    permissions: ['sensitive_documents.view'],
  },
]
