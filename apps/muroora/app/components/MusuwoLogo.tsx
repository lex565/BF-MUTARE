import Image from 'next/image'

/**
 * The Musuwo wordmark: the mark plus the name set beside it.
 *
 * `className` lands on the wrapper rather than the image, so a caller can
 * change the gap, the alignment or the text size without the mark and the
 * word drifting apart from each other.
 */
export function MusuwoLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/musuwo-logo.png"
        alt="Musuwo"
        width={54}
        height={54}
        className="size-12 object-contain"
        priority
      />
      <span className="font-display text-h3 font-extrabold tracking-tight text-ink">
        Musuwo
      </span>
    </span>
  )
}
