import Image from 'next/image'

/**
 * One product photograph, drawn the same way on every surface.
 *
 * WHY THIS IS ONE COMPONENT AND NOT FOUR COPIES
 *
 * Product photos were rendered three different ways and omitted entirely on
 * two more. The marketplace list and the storefront grid drew no image at all,
 * so the only real product on the platform appeared as a line of text with a
 * price. The shop catalogue drew it 480x320 and the product page 800x800, both
 * with `object-cover`.
 *
 * WHY object-contain, NOT object-cover
 *
 * `object-cover` fills the box by cropping whatever does not fit. That is the
 * right choice for a decorative banner and the wrong one for a product: the
 * first real photograph uploaded to this platform is 1280x1121, a near-square
 * catalogue shot of folded garments, and a 3:2 box with `cover` cuts the top
 * and bottom off the item somebody is trying to sell.
 *
 * Merchants photograph stock on a phone, in a shop, in whatever aspect the
 * camera happened to be in. The platform cannot assume a shape. `contain` on
 * a neutral ground shows the whole item every time and letterboxes the
 * difference, which is the trade a shopper wants: seeing all of a product
 * slightly smaller beats seeing most of it slightly larger.
 *
 * WHY sizes IS SET
 *
 * Without it `next/image` assumes the image occupies the full viewport width
 * and serves a 3840px variant to a phone showing a 180px card. Customers in
 * Mutare pay for that data by the megabyte, which is the whole point of
 * section 50 of the brief. These values describe the real grid: four across on
 * a large screen, two on a tablet, one on a phone.
 */
export function ProductPhoto({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string | null
  alt: string
  /** Set on the single largest image above the fold, never on a grid. */
  priority?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-paper-sunk ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 45vw, 92vw"
          className="object-contain"
        />
      ) : (
        /* An empty box rather than a placeholder graphic. A shape that looks
           like a missing image tells the customer the site is broken; a plain
           tinted panel reads as a product without a photograph, which is what
           it is. */
        <span className="absolute inset-0 flex items-center justify-center text-micro uppercase tracking-label text-ink-faint">
          No photo yet
        </span>
      )}
    </div>
  )
}
