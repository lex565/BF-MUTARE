/**
 * Provider types and the shape of a readiness check.
 *
 * SEPARATE FROM registration.ts, AND THE SPLIT IS LOad-BEARING. That module
 * imports the database client, which reaches `fs`. The registration form is a
 * client component and needs the list of provider types to draw the first
 * screen - importing it from there dragged the whole database layer into the
 * browser bundle and the build failed with "Can't resolve 'fs'".
 *
 * So anything both sides need lives here, and this file imports nothing.
 */

export type ProviderType =
  | 'INDIVIDUAL_SELLER'
  | 'INFORMAL_BUSINESS'
  | 'REGISTERED_BUSINESS'
  | 'SERVICE_PROVIDER'
  | 'ACCOMMODATION_PROVIDER'

/**
 * The first question, in the applicant's words rather than ours.
 *
 * "Informal" is a word Musuwo uses internally; a person selling from a stall
 * does not describe herself that way. The labels are what somebody would say
 * about themselves, and the blurb underneath does the classifying.
 *
 * "A small business, not registered" is deliberately followed by "This is
 * normal and welcome" - the single most likely reason somebody abandons this
 * screen is fearing that not having papers disqualifies them.
 */
export const PROVIDER_TYPES: {
  value: ProviderType
  label: string
  blurb: string
}[] = [
  {
    value: 'INDIVIDUAL_SELLER',
    label: 'Just me',
    blurb:
      'You sell on your own, in your own name. Cooking, baking, buying and reselling, crafts.',
  },
  {
    value: 'INFORMAL_BUSINESS',
    label: 'A small business, not registered',
    blurb:
      'A real business with a name and maybe staff, but no company papers. This is normal and welcome.',
  },
  {
    value: 'REGISTERED_BUSINESS',
    label: 'A registered company',
    blurb: 'You have a certificate of incorporation or registration.',
  },
  {
    value: 'SERVICE_PROVIDER',
    label: 'I provide a service',
    blurb:
      'Tutoring, plumbing, hair, repairs, transport. You go to the customer or they come to you.',
  },
  {
    value: 'ACCOMMODATION_PROVIDER',
    label: 'I have rooms to let',
    blurb: 'A boarding house, lodge, student rooms or a place to stay.',
  },
]

export interface Requirement {
  requirement: string
  label: string
  note: string | null
  isMandatory: boolean
  met: boolean
}

export interface Readiness {
  providerType: ProviderType | null
  requirements: Requirement[]
  /** Mandatory items still missing. Empty means submission is allowed. */
  missing: Requirement[]
  canSubmit: boolean
}
