/**
 * BF Mutare — department heads.
 *
 * ⚠ EVERY NAME AND BIO BELOW IS A PLACEHOLDER.
 *
 * The old codebase contained four names attached to Unsplash stock portraits
 * and generic one-line bios, which means they were almost certainly invented
 * by whatever generated that site rather than supplied by anyone at BF Mutare.
 * Putting an unverified name and job title on a live company website is not a
 * thing to guess at, so nothing has been carried over.
 *
 * Send me, for each head: full name, exact job title, one or two sentences in
 * their own words, and a photograph. Until then the section renders a clearly
 * marked placeholder rather than a fake person.
 *
 * `photo: null` renders initials on a tinted panel — which is a perfectly
 * respectable look, so there is no rush on portraits.
 */

export interface DepartmentHead {
  /** Tab id — also the URL hash, so keep it short and stable. */
  id: string
  department: string
  /** One line describing what the department actually does. */
  remit: string
  name: string | null
  title: string | null
  bio: string | null
  photo: string | null
  /** Optional direct line. Falls back to the main company contact. */
  email?: string | null
}

export const DEPARTMENTS: DepartmentHead[] = [
  {
    id: 'sales',
    department: 'Sales',
    remit: 'Matching customers to vehicles, quoting, and closing the handover.',
    name: null, // TODO
    title: null, // TODO — e.g. "Head of Sales"
    bio: null, // TODO
    photo: null, // TODO — /team/sales.jpg
  },
  {
    id: 'marketing',
    department: 'Marketing',
    remit: 'How BF Mutare shows up — listings, socials, and the shopfront.',
    name: null, // TODO
    title: null, // TODO
    bio: null, // TODO
    photo: null, // TODO
  },
  {
    id: 'logistics',
    department: 'Logistics',
    remit: 'Shipping, port clearance, duty, and getting the car to its owner.',
    name: null, // TODO
    title: null, // TODO
    bio: null, // TODO
    photo: null, // TODO
  },
  {
    id: 'it',
    department: 'IT',
    remit: 'Systems, records and the tooling the rest of the business runs on.',
    name: null, // TODO
    title: null, // TODO
    bio: null, // TODO
    photo: null, // TODO
  },
  {
    id: 'drivers',
    department: 'Drivers',
    remit: 'Collection, delivery and moving vehicles safely across the country.',
    name: null, // TODO
    title: null, // TODO
    bio: null, // TODO
    photo: null, // TODO
  },
]

/** Initials for the portrait fallback. */
export const initialsOf = (name: string | null) =>
  name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : '—'
