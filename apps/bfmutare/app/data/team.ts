/**
 * BF Mutare — the team.
 *
 * SOURCE: the 2.0 build, `BF MUTARE CURRENTLY WORKING SITE.txt`, lines 505-569.
 * Names, roles and quotes are carried over verbatim; the client has confirmed
 * this section is correct.
 *
 * This replaces the five blank placeholder departments that were here before.
 * The earlier codebase (pre-2.0) had four invented names on Unsplash stock
 * portraits — none of that was ever carried over, and none of it is here.
 *
 * PHOTOS: 2.0 pointed at `/Company Images/Mischek.jpg`, `Rufaro.jpg`,
 * `Musi 2.jpg`, `tanaka.jpg` and `Uncle Dave.jpg`. That folder is not on this
 * machine — C:, D: and E: were all searched — so every `photo` is null and the
 * initials panel renders instead. Drop the five files into
 * `public/team/` and set the paths and they appear; nothing else changes.
 */

export interface TeamMember {
  /** Tab id — also the URL hash, so keep it short and stable. */
  id: string
  department: string
  /** One line describing what the department actually does. */
  remit: string
  name: string | null
  title: string | null
  bio: string | null
  photo: string | null
  /** The pill tags from the 2.0 cards. Two per person. */
  tags: string[]
  /** Optional direct line. Falls back to the main company contact. */
  email?: string | null
}

export const DEPARTMENTS: TeamMember[] = [
  {
    id: 'sales',
    department: 'Sales',
    remit: 'Matching customers to vehicles, quoting, and closing the handover.',
    name: 'Mishcek',
    title: 'Sales Expert',
    bio: 'The one who makes sure you get the perfect vehicle, every single time.',
    photo: null, // /Company Images/Mischek.jpg — file not on this machine
    tags: ['Drives the best deals', '10+ years experience'],
  },
  {
    id: 'marketing',
    department: 'Marketing',
    remit: 'How BF Mutare shows up — listings, socials, and the shopfront.',
    name: 'Rufaro',
    title: 'Marketing Guru',
    bio: 'Our laid-back marketing maestro. Rufaro quietly works his magic to make sure you know all about BF Mutare.',
    photo: null, // /Company Images/Rufaro.jpg — file not on this machine
    tags: ['Burns the car culture', 'Creative strategist'],
  },
  {
    id: 'logistics',
    department: 'Logistics',
    remit: 'Shipping, port clearance, duty, and getting the car to its owner.',
    name: 'Musi',
    title: 'Logistics Wizard',
    bio: "If you're wondering where your car is, or where anything is for that matter, Musi knows. He's always on the move, connecting the dots across the country.",
    photo: null, // /Company Images/Musi 2.jpg — file not on this machine
    tags: ['Coordinates the chaos', 'Global network'],
  },
  {
    id: 'systems',
    department: 'Information Systems',
    remit: 'Systems, records and the tooling the rest of the business runs on.',
    name: 'Tanaka Alex',
    title: 'Information Systems Specialist',
    bio: 'The one who ensures all our digital gears are turning smoothly behind the scenes.',
    photo: null, // /Company Images/tanaka.jpg — file not on this machine
    /* ⚠ These two tags are carried over exactly as they stand in the 2.0
       markup, but they describe a pricing role, not a systems one — almost
       certainly a copy-paste left over from an earlier card. Left unchanged
       because the client confirmed this section as correct; say the word and
       they become something like 'Keeps the records straight' / 'Builds the
       tooling'. */
    tags: ['Market trends expert', 'Pricing specialist'],
  },
  {
    id: 'accounts',
    department: 'Accounts',
    remit: 'Invoicing, payments, and the money side of every import.',
    name: 'Uncle Dave',
    title: 'Accounting Specialist',
    bio: 'The financial backbone of BF Mutare.',
    photo: null, // /Company Images/Uncle Dave.jpg — file not on this machine
    tags: ['Financial wizard', 'Global financial network'],
  },
  {
    id: 'transport',
    department: 'Transport',
    remit: 'Collection, delivery and moving vehicles safely across the country.',
    name: 'Fortune',
    title: 'Transport Specialist',
    bio: 'Our humble delivery champion. Fortune is the heart of getting your car to you.',
    /* 2.0 used a stock businessman illustration here rather than a photograph
       of Fortune, so there was nothing real to carry over. */
    photo: null,
    tags: ['Delivers the goods', 'Customs clearance'],
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
