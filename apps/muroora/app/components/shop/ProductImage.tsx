import Image from 'next/image'

interface ProductImageProps {
  image?: { path: string; alt: string | null }
  name: string
  priority?: boolean
  className?: string
}

const isDisplayablePath = (path: string): boolean =>
  path.startsWith('/') || path.startsWith('https://')

export function ProductImage({
  image,
  name,
  priority = false,
  className = '',
}: ProductImageProps) {
  if (!image || !isDisplayablePath(image.path)) {
    return (
      <div
        className={`relative flex aspect-square items-end overflow-hidden bg-[linear-gradient(145deg,var(--color-paper-sunk),var(--color-accent-wash))] p-5 ${className}`}
        role="img"
        aria-label={`${name} - photograph coming soon`}
      >
        <span
          aria-hidden
          className="absolute -right-10 -top-10 size-32 rounded-full border-[18px] border-support/10"
        />
        <span className="max-w-[12ch] font-display text-h4 font-bold leading-tight text-support">
          {name}
        </span>
      </div>
    )
  }

  return (
    <div className={`relative aspect-square overflow-hidden bg-paper-sunk ${className}`}>
      <Image
        src={image.path}
        alt={image.alt || name}
        fill
        priority={priority}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  )
}
