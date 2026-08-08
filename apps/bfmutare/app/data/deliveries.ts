/**
 * BF Mutare — vehicles delivered to customers.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 * This is not a stock list. Every vehicle here has already been imported and
 * handed over to its owner. Nothing on this page is for sale, so there are no
 * prices, no mileage and no "available / sold" status — those fields would
 * imply the car is still going.
 *
 * ── NO DATES, ON PURPOSE ──────────────────────────────────────────────────
 * There are deliberately no timestamps. A handful of dated entries makes a
 * long-running business look like it started last month. Timestamps go in
 * later, once there is enough history behind them to be worth showing.
 *
 * ── TWO TIERS ─────────────────────────────────────────────────────────────
 * FEATURED — vehicles identified from the photographs: make, model, colour and
 *            the trade-plate code are all readable in the image.
 * GALLERY  — the wider body of delivery photos, shown as a wall. Unlabelled
 *            because guessing a model wrong in public is worse than showing
 *            the photo on its own. Label them as you confirm them.
 */

export interface Delivery {
  slug: string
  make: string
  model: string
  variant?: string
  bodyType: 'Hatchback' | 'Sedan' | 'SUV' | 'Kei' | 'Wagon' | 'Bakkie'
  colour: string
  /** Trade plate or registration as photographed. */
  plate: string
  drive: 'RHD' | 'LHD'
  images: string[]
  /** One honest line about the car. No marketing adjectives. */
  note: string
}

export const FEATURED: Delivery[] = [
  {
    slug: 'subaru-impreza-sport-black',
    make: 'Subaru',
    model: 'Impreza',
    variant: 'Sport',
    bodyType: 'Hatchback',
    colour: 'Black',
    plate: 'T 7002',
    drive: 'RHD',
    images: [
      '/featured/impreza-sport-black-01.jpg',
      '/featured/impreza-sport-black-02.jpg',
    ],
    note: 'Symmetrical all-wheel drive — the one that handles the Bvumba road in the rain.',
  },
  {
    slug: 'subaru-impreza-silver',
    make: 'Subaru',
    model: 'Impreza',
    bodyType: 'Hatchback',
    colour: 'Silver',
    plate: 'T 2968',
    drive: 'RHD',
    images: ['/featured/impreza-silver-01.jpg', '/featured/impreza-silver-02.jpg'],
    note: 'Newer shape, LED headlamps, alloys. Straightforward daily car.',
  },
  {
    slug: 'bmw-x1-xdrive-blue',
    make: 'BMW',
    model: 'X1',
    variant: 'xDrive',
    bodyType: 'SUV',
    colour: 'Estoril Blue',
    plate: 'AHN 6714',
    drive: 'RHD',
    images: [
      '/featured/bmw-x1-01.jpg',
      '/featured/bmw-x1-02.jpg',
      '/featured/bmw-x1-interior.jpg',
    ],
    note: 'Registered and on the road. Leather, multifunction wheel, panoramic roof.',
  },
  {
    slug: 'nissan-x-trail-white',
    make: 'Nissan',
    model: 'X-Trail',
    bodyType: 'SUV',
    colour: 'White',
    plate: 'T 0042',
    drive: 'RHD',
    images: [
      '/featured/xtrail-01.jpg',
      '/featured/xtrail-02.jpg',
      '/featured/xtrail-03.jpg',
    ],
    note: 'Family SUV with the ground clearance for gravel roads.',
  },
  {
    slug: 'toyota-aqua-orange',
    make: 'Toyota',
    model: 'Aqua',
    variant: 'Hybrid',
    bodyType: 'Hatchback',
    colour: 'Orange',
    plate: 'T 4381',
    drive: 'RHD',
    images: ['/featured/aqua-01.jpg'],
    note: 'Petrol-electric hybrid. Cheap to run day to day.',
  },
  {
    slug: 'nissan-sylphy-silver',
    make: 'Nissan',
    model: 'Sylphy',
    bodyType: 'Sedan',
    colour: 'Silver',
    plate: 'T 0212',
    drive: 'RHD',
    images: ['/featured/sylphy-01.jpg'],
    note: 'Full-size sedan boot and rear legroom without full-size running costs.',
  },
  {
    slug: 'daihatsu-mira-es',
    make: 'Daihatsu',
    model: 'Mira e:S',
    bodyType: 'Kei',
    colour: 'Champagne',
    plate: 'T 9845',
    drive: 'RHD',
    images: ['/featured/mira-es-01.jpg'],
    note: 'Japanese kei car. Small, cheap on fuel, easy to park in town.',
  },
]

/**
 * The delivery wall. Generated from the photo set — 52 handovers.
 *
 * Add a `label` to any entry once the vehicle is confirmed and it will show on
 * hover instead of the plain frame.
 */
export interface GalleryShot {
  src: string
  label?: string
}

export const GALLERY: GalleryShot[] = Array.from({ length: 52 }, (_, i) => ({
  src: `/deliveries/delivery-${String(i + 1).padStart(2, '0')}.jpeg`,
}))

/* Two confirmed from the photographs. */
GALLERY[3].label = 'Mazda CX-3 — T 0704'

export const bodyTypesDelivered = () =>
  Array.from(new Set(FEATURED.map((vehicle) => vehicle.bodyType)))

export const vehicleBySlug = (slug: string) =>
  FEATURED.find((vehicle) => vehicle.slug === slug)
