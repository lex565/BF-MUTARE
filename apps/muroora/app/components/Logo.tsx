import Image from 'next/image'

/**
 * Muroora Mart's own logo artwork, unmodified apart from a trim.
 *
 * Unlike BF Mutare's, this file arrived with a correct alpha channel - zero
 * opaque white pixels - so nothing was knocked out. It was only cropped to its
 * bounding box, because the source had a lot of empty canvas that would
 * otherwise have shrunk the mark inside its box.
 *
 * Left as a raster rather than traced to vector: the wordmark is two colours
 * with a basket illustration and a set tagline, so a trace would be large and
 * would risk distorting letterforms the client has already signed off.
 */
export function Logo({ className = 'h-9' }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Muroora Mart - quality goods, great value"
      width={1085}
      height={393}
      priority
      className={`w-auto ${className}`}
    />
  )
}
